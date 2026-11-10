import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { ApiKeysService } from './api-keys.service';
import { ApiUsageService } from './api-usage.service';
import { ApiOrganizationService } from './api-organization.service';
import type {
  CreateApiClientDto,
  CreateApiKeyDto,
  UpdateApiClientDto,
  UsageRangeQueryDto,
} from './dto/api-client.dto';

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

const KEY_SELECT = {
  id: true,
  name: true,
  prefix: true,
  lastUsedAt: true,
  lastUsedIp: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class ApiClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: ApiKeysService,
    private readonly usage: ApiUsageService,
    private readonly audit: AuditService,
    private readonly org: ApiOrganizationService,
  ) {}

  async create(dto: CreateApiClientDto, actorId: string) {
    const client = await this.prisma.apiClient.create({
      data: {
        name: dto.name.trim(),
        contactEmail: dto.contactEmail.trim().toLowerCase(),
        description: dto.description,
        rpmLimit: dto.rpmLimit,
        createdById: actorId,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'ApiClient',
      entityId: client.id,
      action: 'API_CLIENT_CREATED',
    });
    // El email de contacto es la cuenta principal (OWNER) de la organización.
    const { invitationSent, inviteLink } = await this.org.invite({
      clientId: client.id,
      email: client.contactEmail,
      role: 'OWNER',
      invitedById: actorId,
    });
    return { ...client, invitationSent, inviteLink };
  }

  /** Reenvía la invitación de cuenta principal al email de contacto. */
  async resendOwnerInvitation(id: string, actorId: string) {
    const client = await this.get(id);
    return this.org.invite({
      clientId: id,
      email: client.contactEmail,
      role: 'OWNER',
      invitedById: actorId,
    });
  }

  async list() {
    const since = new Date(Date.now() - DEFAULT_RANGE_DAYS * 86_400_000);
    const [clients, usage] = await Promise.all([
      this.prisma.apiClient.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          keys: { select: KEY_SELECT, orderBy: { createdAt: 'desc' } },
          members: { select: { role: true } },
          invitations: {
            where: { role: 'OWNER', acceptedAt: null, revokedAt: null },
            select: { expiresAt: true },
          },
        },
      }),
      this.prisma.apiUsageEvent.groupBy({
        by: ['clientId'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);
    const usageByClient = new Map(
      usage.map((u) => [u.clientId, u._count._all]),
    );

    return clients.map(({ keys, members, invitations, ...c }) => {
      const activeKeys = keys.filter((k) => this.isKeyActive(k));
      const lastUsedAt = keys
        .map((k) => k.lastUsedAt?.getTime() ?? 0)
        .reduce((a, b) => Math.max(a, b), 0);
      return {
        ...c,
        activeKeys: activeKeys.length,
        lastUsedAt: lastUsedAt ? new Date(lastUsedAt) : null,
        requestsLast30d: usageByClient.get(c.id) ?? 0,
        members: members.length,
        /** ACTIVE: la cuenta principal aceptó. PENDING: invitación vigente. EXPIRED/NONE: hay que reenviar. */
        ownerStatus: members.some((m) => m.role === 'OWNER')
          ? 'ACTIVE'
          : invitations.some((i) => i.expiresAt.getTime() > Date.now())
            ? 'PENDING'
            : invitations.length
              ? 'EXPIRED'
              : 'NONE',
      };
    });
  }

  async get(id: string) {
    const client = await this.prisma.apiClient.findFirst({
      where: { id, deletedAt: null },
      include: { keys: { select: KEY_SELECT, orderBy: { createdAt: 'desc' } } },
    });
    if (!client) throw new NotFoundException('Cliente de API no encontrado');
    const team = await this.org.listMembers(id);
    return {
      ...client,
      keys: client.keys.map((k) => ({ ...k, active: this.isKeyActive(k) })),
      ...team,
    };
  }

  async update(id: string, dto: UpdateApiClientDto, actorId: string) {
    await this.get(id);
    const client = await this.prisma.apiClient.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        contactEmail: dto.contactEmail?.trim().toLowerCase(),
        description: dto.description,
        rpmLimit: dto.rpmLimit,
        status: dto.status,
      },
    });
    this.keys.invalidateClient(id);
    await this.audit.log({
      actorId,
      entityType: 'ApiClient',
      entityId: id,
      action: 'API_CLIENT_UPDATED',
      metadata: { ...dto },
    });
    return client;
  }

  async remove(id: string, actorId: string) {
    await this.get(id);
    await this.org.removeAllMembers(id);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.apiKey.updateMany({
        where: { clientId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.apiClient.update({
        where: { id },
        data: { deletedAt: now, status: 'SUSPENDED' },
      }),
    ]);
    this.keys.invalidateClient(id);
    await this.audit.log({
      actorId,
      entityType: 'ApiClient',
      entityId: id,
      action: 'API_CLIENT_DELETED',
    });
    return { deleted: true };
  }

  /** Crea una key nueva. La key en claro solo viaja en esta respuesta. */
  async createKey(clientId: string, dto: CreateApiKeyDto, actorId: string) {
    const client = await this.get(clientId);
    if (client.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'La organización está suspendida: no se pueden generar keys',
      );
    }
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'La fecha de vencimiento tiene que ser futura',
      );
    }

    const generated = ApiKeysService.generate();
    const apiKey = await this.prisma.apiKey.create({
      data: {
        clientId,
        name: dto.name.trim(),
        prefix: generated.prefix,
        keyHash: generated.keyHash,
        expiresAt,
        createdById: actorId,
      },
      select: KEY_SELECT,
    });
    await this.audit.log({
      actorId,
      entityType: 'ApiClient',
      entityId: clientId,
      action: 'API_KEY_CREATED',
      metadata: { apiKeyId: apiKey.id, prefix: apiKey.prefix },
    });
    return {
      ...apiKey,
      key: generated.key,
      warning: 'Guardá esta key ahora: no se puede volver a ver.',
    };
  }

  async revokeKey(clientId: string, keyId: string, actorId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, clientId },
      select: KEY_SELECT,
    });
    if (!key) throw new NotFoundException('API key no encontrada');
    if (key.revokedAt) return key;

    const revoked = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
      select: KEY_SELECT,
    });
    this.keys.invalidateKey(keyId);
    await this.audit.log({
      actorId,
      entityType: 'ApiClient',
      entityId: clientId,
      action: 'API_KEY_REVOKED',
      metadata: { apiKeyId: keyId, prefix: key.prefix },
    });
    return revoked;
  }

  async usageSummary(range: UsageRangeQueryDto, clientId?: string) {
    if (clientId) await this.get(clientId);
    return this.usage.summary({ clientId, ...this.resolveRange(range) });
  }

  async recentEvents(clientId: string, range: UsageRangeQueryDto, limit = 50) {
    await this.get(clientId);
    const { from, to } = this.resolveRange(range);
    return this.prisma.apiUsageEvent.findMany({
      where: { clientId, createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private resolveRange(range: UsageRangeQueryDto): { from: Date; to: Date } {
    const to = range.to ? new Date(range.to) : new Date();
    const from = range.from
      ? new Date(range.from)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 86_400_000);
    if (from >= to)
      throw new BadRequestException('`from` tiene que ser anterior a `to`');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
      throw new BadRequestException(
        `El rango máximo es de ${MAX_RANGE_DAYS} días`,
      );
    }
    return { from, to };
  }

  private isKeyActive(k: {
    revokedAt: Date | null;
    expiresAt: Date | null;
  }): boolean {
    return !k.revokedAt && (!k.expiresAt || k.expiresAt.getTime() > Date.now());
  }
}
