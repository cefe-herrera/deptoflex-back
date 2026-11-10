import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiClientMemberRole, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { TokenService } from '../auth/token.service';
import { AuditService } from '../../common/services/audit.service';
import type { AcceptApiInvitationDto } from './dto/api-organization.dto';

export const API_CLIENT_ROLE = 'API_CLIENT';
const INVITATION_TTL_DAYS = 7;

/** Roles que pueden gestionar keys y usuarios de la organización. */
export const MANAGER_ROLES: ApiClientMemberRole[] = ['OWNER', 'ADMIN'];

export interface ApiMembership {
  memberId: string;
  userId: string;
  role: ApiClientMemberRole;
  client: {
    id: string;
    name: string;
    status: 'ACTIVE' | 'SUSPENDED';
    createdAt: Date;
  };
}

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/**
 * Organizaciones cliente de la API: invitaciones por email, aceptación
 * (alta de cuenta o vinculación de una existente) y gestión de miembros.
 */
@Injectable()
export class ApiOrganizationService {
  private readonly logger = new Logger(ApiOrganizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  // ─── Membresía ─────────────────────────────────────────────────────────────

  /** Membresía del usuario o 403 si no pertenece a ninguna organización activa. */
  async requireMembership(
    userId: string,
    roles?: ApiClientMemberRole[],
  ): Promise<ApiMembership> {
    const member = await this.prisma.apiClientMember.findUnique({
      where: { userId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!member || member.client.deletedAt) {
      throw new ForbiddenException(
        'No pertenecés a ninguna organización de la API',
      );
    }
    if (roles && !roles.includes(member.role)) {
      throw new ForbiddenException('Tu rol no permite realizar esta acción');
    }
    const { id, name, status, createdAt } = member.client;
    return {
      memberId: member.id,
      userId,
      role: member.role,
      client: { id, name, status, createdAt },
    };
  }

  async listMembers(clientId: string) {
    const [members, invitations] = await Promise.all([
      this.prisma.apiClientMember.findMany({
        where: { clientId },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.apiClientInvitation.findMany({
        where: { clientId, acceptedAt: null, revokedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
    ]);
    const now = Date.now();
    return {
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        createdAt: m.createdAt,
        user: m.user,
      })),
      invitations: invitations.map((i) => ({
        ...i,
        expired: i.expiresAt.getTime() <= now,
      })),
    };
  }

  // ─── Invitaciones ──────────────────────────────────────────────────────────

  /**
   * Crea (o reemplaza) una invitación pendiente y envía el email.
   * Devuelve el link para poder compartirlo si el email no llega.
   */
  async invite(params: {
    clientId: string;
    email: string;
    role: ApiClientMemberRole;
    invitedById: string | null;
  }) {
    const email = params.email.trim().toLowerCase();
    const client = await this.prisma.apiClient.findFirst({
      where: { id: params.clientId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Organización no encontrada');

    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
      include: { apiClientMembership: true },
    });
    if (existingUser?.apiClientMembership) {
      throw new ConflictException(
        existingUser.apiClientMembership.clientId === client.id
          ? 'Ese email ya es miembro de la organización'
          : 'Ese email ya pertenece a otra organización de la API',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000);

    const invitation = await this.prisma.$transaction(async (tx) => {
      // Solo una invitación pendiente por email y organización.
      await tx.apiClientInvitation.updateMany({
        where: {
          clientId: client.id,
          email,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      return tx.apiClientInvitation.create({
        data: {
          clientId: client.id,
          email,
          role: params.role,
          tokenHash: hashToken(token),
          invitedById: params.invitedById,
          expiresAt,
        },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    });

    const inviter = params.invitedById
      ? await this.prisma.user.findUnique({
          where: { id: params.invitedById },
          select: { firstName: true, lastName: true },
        })
      : null;
    const inviteLink = `${this.frontendUrl()}/api-invitacion?token=${token}`;
    const sent = await this.email
      .sendApiClientInvitationEmail({
        email,
        organizationName: client.name,
        inviteLink,
        isOwner: params.role === 'OWNER',
        invitedByName: inviter
          ? `${inviter.firstName ?? ''} ${inviter.lastName ?? ''}`.trim() ||
            null
          : null,
        expiresInDays: INVITATION_TTL_DAYS,
      })
      .catch((err) => {
        this.logger.error(`No se pudo enviar la invitación a ${email}: ${err}`);
        return false;
      });

    await this.audit.log({
      actorId: params.invitedById,
      entityType: 'ApiClient',
      entityId: client.id,
      action: 'API_MEMBER_INVITED',
      metadata: { email, role: params.role, invitationId: invitation.id },
    });

    return { invitation, invitationSent: sent, inviteLink };
  }

  async revokeInvitation(
    clientId: string,
    invitationId: string,
    actorId: string,
  ) {
    const inv = await this.prisma.apiClientInvitation.findFirst({
      where: { id: invitationId, clientId, acceptedAt: null, revokedAt: null },
    });
    if (!inv) throw new NotFoundException('Invitación no encontrada');
    await this.prisma.apiClientInvitation.update({
      where: { id: inv.id },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorId,
      entityType: 'ApiClient',
      entityId: clientId,
      action: 'API_INVITATION_REVOKED',
      metadata: { invitationId, email: inv.email },
    });
    return { revoked: true };
  }

  async resendInvitation(
    clientId: string,
    invitationId: string,
    actorId: string,
  ) {
    const inv = await this.prisma.apiClientInvitation.findFirst({
      where: { id: invitationId, clientId, acceptedAt: null, revokedAt: null },
    });
    if (!inv) throw new NotFoundException('Invitación no encontrada');
    return this.invite({
      clientId,
      email: inv.email,
      role: inv.role,
      invitedById: actorId,
    });
  }

  /** Datos públicos de una invitación para mostrar la pantalla de aceptación. */
  async preview(token: string) {
    const inv = await this.findValidInvitation(token);
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: inv.email, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { isActive: true },
    });
    return {
      organizationName: inv.client.name,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt,
      /** true: hay que crear la cuenta (nombre + contraseña). false: iniciar sesión con ese email. */
      requiresAccount: !user?.isActive,
    };
  }

  /**
   * Acepta la invitación.
   * - Sin cuenta activa con ese email: crea (o reactiva) la cuenta con los datos del form.
   * - Con cuenta activa: el que llama tiene que estar logueado con ese email.
   * Devuelve tokens de sesión para entrar directo al panel.
   */
  async accept(
    token: string,
    dto: AcceptApiInvitationDto,
    currentUserId: string | undefined,
    meta: RequestMeta,
  ) {
    const inv = await this.findValidInvitation(token);
    const existing = await this.prisma.user.findFirst({
      where: {
        email: { equals: inv.email, mode: 'insensitive' },
        deletedAt: null,
      },
      include: { apiClientMembership: true },
    });

    if (existing?.apiClientMembership) {
      throw new ConflictException(
        existing.apiClientMembership.clientId === inv.clientId
          ? 'Ya sos miembro de esta organización'
          : 'Tu cuenta ya pertenece a otra organización de la API',
      );
    }

    if (existing?.isActive && existing.id !== currentUserId) {
      throw new UnauthorizedException(
        `Iniciá sesión con ${inv.email} para aceptar la invitación`,
      );
    }

    const needsAccountData = !existing?.isActive;
    if (
      needsAccountData &&
      (!dto.firstName || !dto.lastName || !dto.password)
    ) {
      throw new BadRequestException(
        'Completá nombre, apellido y contraseña para crear tu cuenta',
      );
    }
    const passwordHash = needsAccountData
      ? await argon2.hash(dto.password!, {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
        })
      : null;

    const apiRole = await this.prisma.role.findUnique({
      where: { name: API_CLIENT_ROLE },
    });
    if (!apiRole)
      throw new Error(
        `Falta el rol ${API_CLIENT_ROLE} (correr migraciones/seed)`,
      );

    const now = new Date();
    const userId = await this.prisma.$transaction(async (tx) => {
      let uid: string;
      if (!existing) {
        const created = await tx.user.create({
          data: {
            email: inv.email,
            passwordHash: passwordHash!,
            firstName: dto.firstName,
            lastName: dto.lastName,
            emailVerified: true, // el link llegó a ese email
            emailVerifiedAt: now,
            termsAcceptedAt: now,
          },
        });
        uid = created.id;
      } else {
        uid = existing.id;
        if (needsAccountData) {
          // Cuenta desactivada (p. ej. removida de otra organización): se reactiva.
          await tx.user.update({
            where: { id: uid },
            data: {
              passwordHash: passwordHash!,
              firstName: dto.firstName,
              lastName: dto.lastName,
              isActive: true,
              emailVerified: true,
              emailVerifiedAt: existing.emailVerifiedAt ?? now,
            },
          });
        }
      }

      await tx.apiClientMember.create({
        data: { clientId: inv.clientId, userId: uid, role: inv.role },
      });
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: uid, roleId: apiRole.id } },
        update: {},
        create: {
          userId: uid,
          roleId: apiRole.id,
          assignedBy: inv.invitedById,
        },
      });
      await tx.apiClientInvitation.update({
        where: { id: inv.id },
        data: { acceptedAt: now },
      });
      return uid;
    });

    await this.audit.log({
      actorId: userId,
      entityType: 'ApiClient',
      entityId: inv.clientId,
      action: 'API_INVITATION_ACCEPTED',
      metadata: { invitationId: inv.id, role: inv.role },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    const roles = user.userRoles.map((ur) => ur.role.name);
    const accessToken = this.tokens.generateAccessToken({
      sub: user.id,
      email: user.email,
      roles,
    });
    const { refreshToken, expiresAt } = await this.tokens.createSession(
      user.id,
      meta,
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      expiresAt,
      user: { id: user.id, email: user.email, roles },
    };
  }

  // ─── Miembros ──────────────────────────────────────────────────────────────

  async changeRole(
    clientId: string,
    memberId: string,
    role: ApiClientMemberRole,
    actorId: string,
  ) {
    const member = await this.findMember(clientId, memberId);
    if (member.role === 'OWNER')
      throw new ForbiddenException(
        'No se puede cambiar el rol de la cuenta principal',
      );
    if (member.userId === actorId)
      throw new ForbiddenException('No podés cambiar tu propio rol');
    if (role === 'OWNER') throw new BadRequestException('Rol inválido');

    const updated = await this.prisma.apiClientMember.update({
      where: { id: member.id },
      data: { role },
    });
    await this.audit.log({
      actorId,
      entityType: 'ApiClient',
      entityId: clientId,
      action: 'API_MEMBER_ROLE_CHANGED',
      metadata: { memberId, from: member.role, to: role },
    });
    return updated;
  }

  async removeMember(
    clientId: string,
    memberId: string,
    actorId: string,
    opts: { allowOwner?: boolean } = {},
  ) {
    const member = await this.findMember(clientId, memberId);
    if (member.role === 'OWNER' && !opts.allowOwner) {
      throw new ForbiddenException('No se puede quitar a la cuenta principal');
    }
    if (member.userId === actorId)
      throw new ForbiddenException('No podés quitarte a vos mismo');

    await this.offboardUser(member.userId, member.id);
    await this.audit.log({
      actorId,
      entityType: 'ApiClient',
      entityId: clientId,
      action: 'API_MEMBER_REMOVED',
      metadata: { memberId, userId: member.userId },
    });
    return { removed: true };
  }

  /** Quita a todos los miembros (al eliminar la organización). */
  async removeAllMembers(clientId: string) {
    const members = await this.prisma.apiClientMember.findMany({
      where: { clientId },
    });
    for (const m of members) await this.offboardUser(m.userId, m.id);
    await this.prisma.apiClientInvitation.updateMany({
      where: { clientId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Borra la membresía y el rol API_CLIENT. Si la cuenta existía solo para la
   * API (no le quedan otros roles) se desactiva y se cierran sus sesiones.
   */
  private async offboardUser(userId: string, memberId: string) {
    const apiRole = await this.prisma.role.findUnique({
      where: { name: API_CLIENT_ROLE },
    });
    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.apiClientMember.delete({ where: { id: memberId } }),
    ];
    if (apiRole)
      ops.push(
        this.prisma.userRole.deleteMany({
          where: { userId, roleId: apiRole.id },
        }),
      );
    await this.prisma.$transaction(ops);

    const remainingRoles = await this.prisma.userRole.count({
      where: { userId },
    });
    if (remainingRoles === 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });
    }
    await this.tokens.revokeAllUserSessions(userId);
  }

  private async findMember(clientId: string, memberId: string) {
    const member = await this.prisma.apiClientMember.findFirst({
      where: { id: memberId, clientId },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    return member;
  }

  private async findValidInvitation(token: string) {
    const inv = await this.prisma.apiClientInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { client: { select: { name: true, deletedAt: true } } },
    });
    if (!inv || inv.revokedAt || inv.client.deletedAt) {
      throw new NotFoundException('La invitación no existe o fue cancelada');
    }
    if (inv.acceptedAt)
      throw new GoneException('Esta invitación ya fue aceptada');
    if (inv.expiresAt.getTime() <= Date.now()) {
      throw new GoneException('La invitación venció. Pedí que te la reenvíen.');
    }
    return inv;
  }

  private frontendUrl(): string {
    return (
      this.config.get<string>('app.frontendUrl') ?? 'https://weflex.com.ar'
    ).replace(/\/$/, '');
  }
}
