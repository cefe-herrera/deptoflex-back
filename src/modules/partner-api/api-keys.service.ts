import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { ApiClientContext } from './partner-api.types';

const KEY_PREFIX = 'dfx_';
/** Largo del prefijo visible guardado en DB (ej. "dfx_a1B2c3D4"). */
const VISIBLE_PREFIX_LENGTH = KEY_PREFIX.length + 8;
/** Cuánto se cachea en memoria una key validada. Una revocación tarda como máximo esto en propagarse a otras instancias. */
const LOOKUP_CACHE_TTL_MS = 30_000;

export interface GeneratedApiKey {
  /** Key en claro. Se muestra una sola vez y no se persiste. */
  key: string;
  prefix: string;
  keyHash: string;
}

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);
  private readonly cache = new Map<
    string,
    { ctx: ApiClientContext; expiresAt: number }
  >();

  constructor(private readonly prisma: PrismaService) {}

  static generate(): GeneratedApiKey {
    const key = `${KEY_PREFIX}${randomBytes(30).toString('base64url')}`;
    return {
      key,
      prefix: key.slice(0, VISIBLE_PREFIX_LENGTH),
      keyHash: ApiKeysService.hash(key),
    };
  }

  static hash(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  static looksLikeKey(value: string): boolean {
    return (
      value.startsWith(KEY_PREFIX) && value.length >= 30 && value.length <= 100
    );
  }

  /**
   * Valida una key en claro. Devuelve el contexto del cliente o null si la key
   * no existe, está revocada/vencida o el cliente está suspendido/borrado.
   */
  async validate(
    rawKey: string,
    ipAddress?: string,
  ): Promise<ApiClientContext | null> {
    if (!ApiKeysService.looksLikeKey(rawKey)) return null;

    const keyHash = ApiKeysService.hash(rawKey);
    const now = Date.now();
    const cached = this.cache.get(keyHash);
    if (cached && cached.expiresAt > now) return cached.ctx;

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { client: true },
    });

    const valid =
      apiKey &&
      !apiKey.revokedAt &&
      (!apiKey.expiresAt || apiKey.expiresAt.getTime() > now) &&
      apiKey.client.status === 'ACTIVE' &&
      !apiKey.client.deletedAt;

    if (!valid) {
      this.cache.delete(keyHash);
      return null;
    }

    const ctx: ApiClientContext = {
      clientId: apiKey.clientId,
      clientName: apiKey.client.name,
      apiKeyId: apiKey.id,
      rpmLimit: apiKey.client.rpmLimit,
    };
    this.cache.set(keyHash, { ctx, expiresAt: now + LOOKUP_CACHE_TTL_MS });

    // lastUsedAt es aproximado: se actualiza como mucho una vez por ventana de caché.
    this.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: {
          lastUsedAt: new Date(now),
          lastUsedIp: ipAddress?.slice(0, 45),
        },
      })
      .catch((err) =>
        this.logger.warn(
          `No se pudo actualizar lastUsedAt de ${apiKey.id}: ${err}`,
        ),
      );

    return ctx;
  }

  /** Invalida el caché local (las demás instancias lo hacen al vencer el TTL). */
  invalidateClient(clientId: string): void {
    for (const [hash, entry] of this.cache) {
      if (entry.ctx.clientId === clientId) this.cache.delete(hash);
    }
  }

  invalidateKey(apiKeyId: string): void {
    for (const [hash, entry] of this.cache) {
      if (entry.ctx.apiKeyId === apiKeyId) this.cache.delete(hash);
    }
  }
}
