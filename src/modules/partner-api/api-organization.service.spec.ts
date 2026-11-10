import {
  ConflictException,
  ForbiddenException,
  GoneException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { ApiOrganizationService } from './api-organization.service';

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    apiClient: { findFirst: jest.fn() },
    apiClientMember: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    apiClientInvitation: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'inv-1', email: 'a@b.com' }),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'u-new',
        email: 'a@b.com',
        userRoles: [{ role: { name: 'API_CLIENT' } }],
      }),
      create: jest.fn().mockResolvedValue({ id: 'u-new' }),
      update: jest.fn(),
    },
    role: {
      findUnique: jest.fn().mockResolvedValue({ id: 5, name: 'API_CLIENT' }),
    },
    userRole: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(),
    ...overrides,
  };
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prisma)
      : Promise.all(arg as unknown[]),
  );
  const email = {
    sendApiClientInvitationEmail: jest.fn().mockResolvedValue(true),
  };
  const tokens = {
    generateAccessToken: jest.fn().mockReturnValue('access'),
    createSession: jest
      .fn()
      .mockResolvedValue({ refreshToken: 'refresh', expiresAt: new Date() }),
    revokeAllUserSessions: jest.fn(),
  };
  const audit = { log: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('http://localhost:3001') };
  const service = new ApiOrganizationService(
    prisma as never,
    email as never,
    tokens as never,
    audit as never,
    config as never,
  );
  return { service, prisma, email, tokens };
}

const validInvitation = (over: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  clientId: 'c1',
  email: 'a@b.com',
  role: 'OWNER',
  invitedById: 'admin',
  tokenHash: hash('tok'),
  expiresAt: new Date(Date.now() + 86_400_000),
  acceptedAt: null,
  revokedAt: null,
  client: { name: 'Acme', deletedAt: null },
  ...over,
});

describe('ApiOrganizationService', () => {
  describe('invite', () => {
    it('crea la invitación, manda el email y devuelve el link', async () => {
      const { service, prisma, email } = makeService();
      prisma.apiClient.findFirst.mockResolvedValue({ id: 'c1', name: 'Acme' });
      const res = await service.invite({
        clientId: 'c1',
        email: ' A@B.com ',
        role: 'OWNER',
        invitedById: 'admin',
      });
      expect(prisma.apiClientInvitation.updateMany).toHaveBeenCalled(); // cancela pendientes previas
      expect(email.sendApiClientInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'a@b.com',
          isOwner: true,
          organizationName: 'Acme',
        }),
      );
      expect(res.inviteLink).toMatch(
        /^http:\/\/localhost:3001\/api-invitacion\?token=/,
      );
      expect(res.invitationSent).toBe(true);
    });

    it('rechaza un email que ya pertenece a otra organización', async () => {
      const { service, prisma } = makeService();
      prisma.apiClient.findFirst.mockResolvedValue({ id: 'c1', name: 'Acme' });
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        apiClientMembership: { clientId: 'otra' },
      });
      await expect(
        service.invite({
          clientId: 'c1',
          email: 'a@b.com',
          role: 'VIEWER',
          invitedById: 'x',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('accept', () => {
    it('crea la cuenta si el email no existe y devuelve sesión', async () => {
      const { service, prisma } = makeService();
      prisma.apiClientInvitation.findUnique.mockResolvedValue(
        validInvitation(),
      );
      const res = await service.accept(
        'tok',
        { firstName: 'Ana', lastName: 'Paz', password: 'Secreta123' },
        undefined,
        {},
      );
      const createArgs = prisma.user.create.mock.calls[0] as [
        { data: { email: string; emailVerified: boolean } },
      ];
      expect(createArgs[0].data).toMatchObject({
        email: 'a@b.com',
        emailVerified: true,
      });
      expect(prisma.apiClientMember.create).toHaveBeenCalledWith({
        data: { clientId: 'c1', userId: 'u-new', role: 'OWNER' },
      });
      expect(prisma.userRole.upsert).toHaveBeenCalled();
      expect(res).toMatchObject({
        accessToken: 'access',
        refreshToken: 'refresh',
      });
    });

    it('pide los datos de la cuenta si el email no existe', async () => {
      const { service, prisma } = makeService();
      prisma.apiClientInvitation.findUnique.mockResolvedValue(
        validInvitation(),
      );
      await expect(service.accept('tok', {}, undefined, {})).rejects.toThrow(
        /Completá/,
      );
    });

    it('exige estar logueado con el email si la cuenta ya existe', async () => {
      const { service, prisma } = makeService();
      prisma.apiClientInvitation.findUnique.mockResolvedValue(
        validInvitation(),
      );
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        isActive: true,
        apiClientMembership: null,
      });
      await expect(
        service.accept('tok', {}, 'otro-user', {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('vincula una cuenta existente si está logueado con ese email', async () => {
      const { service, prisma } = makeService();
      prisma.apiClientInvitation.findUnique.mockResolvedValue(
        validInvitation({ role: 'VIEWER' }),
      );
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        isActive: true,
        apiClientMembership: null,
      });
      await service.accept('tok', {}, 'u1', {});
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.apiClientMember.create).toHaveBeenCalledWith({
        data: { clientId: 'c1', userId: 'u1', role: 'VIEWER' },
      });
    });

    it.each([
      ['aceptada', { acceptedAt: new Date() }],
      ['vencida', { expiresAt: new Date(Date.now() - 1000) }],
    ])('rechaza una invitación %s', async (_l, over) => {
      const { service, prisma } = makeService();
      prisma.apiClientInvitation.findUnique.mockResolvedValue(
        validInvitation(over),
      );
      await expect(
        service.accept('tok', {}, undefined, {}),
      ).rejects.toBeInstanceOf(GoneException);
    });
  });

  describe('miembros', () => {
    it('requireMembership filtra por rol', async () => {
      const { service, prisma } = makeService();
      prisma.apiClientMember.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'VIEWER',
        client: {
          id: 'c1',
          name: 'Acme',
          status: 'ACTIVE',
          createdAt: new Date(),
          deletedAt: null,
        },
      });
      await expect(
        service.requireMembership('u1', ['OWNER', 'ADMIN']),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.requireMembership('u1')).resolves.toMatchObject({
        role: 'VIEWER',
      });
    });

    it('no permite quitar a la cuenta principal', async () => {
      const { service, prisma } = makeService();
      prisma.apiClientMember.findFirst.mockResolvedValue({
        id: 'm1',
        userId: 'u2',
        role: 'OWNER',
      });
      await expect(
        service.removeMember('c1', 'm1', 'u1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('al quitar un miembro sin otros roles desactiva la cuenta y cierra sesiones', async () => {
      const { service, prisma, tokens } = makeService();
      prisma.apiClientMember.findFirst.mockResolvedValue({
        id: 'm2',
        userId: 'u2',
        role: 'VIEWER',
      });
      await service.removeMember('c1', 'm2', 'u1');
      expect(prisma.apiClientMember.delete).toHaveBeenCalledWith({
        where: { id: 'm2' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: { isActive: false },
      });
      expect(tokens.revokeAllUserSessions).toHaveBeenCalledWith('u2');
    });

    it('no permite cambiarse el rol a uno mismo', async () => {
      const { service, prisma } = makeService();
      prisma.apiClientMember.findFirst.mockResolvedValue({
        id: 'm1',
        userId: 'u1',
        role: 'ADMIN',
      });
      await expect(
        service.changeRole('c1', 'm1', 'VIEWER', 'u1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
