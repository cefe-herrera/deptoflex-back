import {
  ExecutionContext,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import {
  ApiRateLimiterService,
  MAX_FAILED_AUTH_PER_MINUTE,
} from './api-rate-limiter.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import type { ApiUsageService } from './api-usage.service';

describe('ApiKeysService', () => {
  it('genera keys únicas con prefijo visible y hash sha256', () => {
    const a = ApiKeysService.generate();
    const b = ApiKeysService.generate();
    expect(a.key).not.toEqual(b.key);
    expect(a.key.startsWith('dfx_')).toBe(true);
    expect(a.prefix).toEqual(a.key.slice(0, 12));
    expect(a.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ApiKeysService.hash(a.key)).toEqual(a.keyHash);
    expect(ApiKeysService.looksLikeKey(a.key)).toBe(true);
  });

  function makeService(apiKey: unknown) {
    const prisma = {
      apiKey: {
        findUnique: jest.fn().mockResolvedValue(apiKey),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    return { service: new ApiKeysService(prisma as never), prisma };
  }

  const baseKey = (
    overrides: Record<string, unknown> = {},
    clientOverrides = {},
  ) => ({
    id: 'key-1',
    clientId: 'client-1',
    revokedAt: null,
    expiresAt: null,
    client: {
      name: 'Acme',
      status: 'ACTIVE',
      deletedAt: null,
      rpmLimit: 60,
      ...clientOverrides,
    },
    ...overrides,
  });

  it('valida una key activa y cachea el lookup', async () => {
    const { key } = ApiKeysService.generate();
    const { service, prisma } = makeService(baseKey());
    const ctx = await service.validate(key, '1.2.3.4');
    expect(ctx).toEqual({
      clientId: 'client-1',
      clientName: 'Acme',
      apiKeyId: 'key-1',
      rpmLimit: 60,
    });
    await service.validate(key);
    expect(prisma.apiKey.findUnique).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['revocada', baseKey({ revokedAt: new Date() })],
    ['vencida', baseKey({ expiresAt: new Date(Date.now() - 1000) })],
    ['cliente suspendido', baseKey({}, { status: 'SUSPENDED' })],
    ['cliente borrado', baseKey({}, { deletedAt: new Date() })],
    ['inexistente', null],
  ])('rechaza key %s', async (_label, apiKey) => {
    const { service } = makeService(apiKey);
    expect(await service.validate(ApiKeysService.generate().key)).toBeNull();
  });

  it('no consulta la DB si el formato es inválido', async () => {
    const { service, prisma } = makeService(baseKey());
    expect(await service.validate('cualquier-cosa')).toBeNull();
    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
  });
});

describe('ApiRateLimiterService', () => {
  it('permite hasta el límite y reinicia al pasar la ventana', () => {
    const rl = new ApiRateLimiterService();
    const t0 = 1_000_000;
    expect(rl.hit('c', 2, t0)).toMatchObject({ allowed: true, remaining: 1 });
    expect(rl.hit('c', 2, t0 + 1)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(rl.hit('c', 2, t0 + 2)).toMatchObject({
      allowed: false,
      remaining: 0,
    });
    expect(rl.isBlocked('c', 2, t0 + 3)).toBe(true);
    expect(rl.hit('c', 2, t0 + 60_000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
  });

  it('separa buckets por key', () => {
    const rl = new ApiRateLimiterService();
    rl.hit('a', 1);
    expect(rl.hit('b', 1).allowed).toBe(true);
  });
});

describe('ApiKeyGuard', () => {
  function makeContext(headers: Record<string, string>) {
    const req: Record<string, unknown> = {
      headers,
      ip: '9.9.9.9',
      method: 'GET',
      path: '/api/v1/partner/availability',
    };
    const res = { setHeader: jest.fn() };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext;
    return { ctx, req, res };
  }

  const client = {
    clientId: 'c1',
    clientName: 'Acme',
    apiKeyId: 'k1',
    rpmLimit: 2,
  };

  function makeGuard(validateResult: unknown) {
    const keys = { validate: jest.fn().mockResolvedValue(validateResult) };
    const usage = { record: jest.fn() };
    const guard = new ApiKeyGuard(
      keys as never,
      new ApiRateLimiterService(),
      usage as unknown as ApiUsageService,
    );
    return { guard, keys, usage };
  }

  it('rechaza sin header', async () => {
    const { guard } = makeGuard(client);
    await expect(guard.canActivate(makeContext({}).ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('adjunta el cliente y setea headers de rate limit', async () => {
    const { guard } = makeGuard(client);
    const { ctx, req, res } = makeContext({ 'x-api-key': 'dfx_x' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.apiClient).toEqual(client);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);
  });

  it('devuelve 429 y registra el uso al exceder el límite del cliente', async () => {
    const { guard, usage } = makeGuard(client);
    await guard.canActivate(makeContext({ 'x-api-key': 'k' }).ctx);
    await guard.canActivate(makeContext({ 'x-api-key': 'k' }).ctx);
    const err = await guard
      .canActivate(makeContext({ 'x-api-key': 'k' }).ctx)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        endpoint: '/partner/availability',
      }),
    );
  });

  it('no limita el consumo si el cliente no tiene rpmLimit', async () => {
    const { guard } = makeGuard({ ...client, rpmLimit: null });
    for (let i = 0; i < 500; i++) {
      const { ctx, res } = makeContext({ 'x-api-key': 'k' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(res.setHeader).not.toHaveBeenCalled();
    }
  });

  it('bloquea la IP tras demasiados intentos con key inválida', async () => {
    const { guard, keys } = makeGuard(null);
    for (let i = 0; i < MAX_FAILED_AUTH_PER_MINUTE; i++) {
      await guard
        .canActivate(makeContext({ 'x-api-key': 'bad' }).ctx)
        .catch(() => undefined);
    }
    const err = await guard
      .canActivate(makeContext({ 'x-api-key': 'bad' }).ctx)
      .catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(keys.validate).toHaveBeenCalledTimes(MAX_FAILED_AUTH_PER_MINUTE);
  });
});
