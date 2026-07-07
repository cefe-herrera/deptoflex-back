import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { AuditService } from '../../common/services/audit.service';
import { EmailService } from '../email/email.service';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_ROLE_SELECT = {
  roleId: true,
  assignedAt: true,
  assignedBy: true,
  role: { select: { id: true, name: true, description: true } },
  assignedByUser: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
} as const;

const ROLE_AUDIT_ACTIONS = ['ROLE_ASSIGNED', 'ROLE_REASSIGNED', 'ROLE_REMOVED'];

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private auditService: AuditService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  private getRegisterBaseUrl(): string {
    const configured = this.configService.get<string>('app.frontendUrl')?.replace(/\/$/, '');
    if (configured && !configured.includes('localhost')) {
      return configured;
    }
    return 'https://weflex.com.ar';
  }

  buildRegistrationLink(email?: string): string {
    const base = `${this.getRegisterBaseUrl()}/register`;
    const normalized = email?.trim().toLowerCase();
    if (!normalized) return base;
    return `${base}?email=${encodeURIComponent(normalized)}`;
  }

  async assertEmailAvailable(email: string): Promise<string> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email: normalized, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }
    return normalized;
  }

  async getRegistrationInvitationLink(email?: string) {
    let normalized: string | undefined;
    if (email?.trim()) {
      normalized = await this.assertEmailAvailable(email);
    }
    return { link: this.buildRegistrationLink(normalized) };
  }

  async sendRegistrationInvitation(email: string) {
    const normalized = await this.assertEmailAvailable(email);
    const link = this.buildRegistrationLink(normalized);
    const sent = await this.emailService.sendRegistrationInvitationEmail(normalized, link);
    if (!sent) {
      throw new ServiceUnavailableException('No se pudo enviar el email de invitación');
    }
    return { link, sent: true, email: normalized };
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = {
      deletedAt: null,
      ...(search?.trim()
        ? {
            OR: [
              { email: { contains: search.trim(), mode: 'insensitive' as const } },
              { firstName: { contains: search.trim(), mode: 'insensitive' as const } },
              { lastName: { contains: search.trim(), mode: 'insensitive' as const } },
              {
                professionalProfile: {
                  OR: [
                    { firstName: { contains: search.trim(), mode: 'insensitive' as const } },
                    { lastName: { contains: search.trim(), mode: 'insensitive' as const } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          emailVerified: true,
          isActive: true,
          createdAt: true,
          userRoles: { select: USER_ROLE_SELECT },
          professionalProfile: { select: { firstName: true, lastName: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        userRoles: { select: USER_ROLE_SELECT },
        professionalProfile: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getRoleAuditTrail(userId: string) {
    await this.findOne(userId);
    return this.auditService.findForEntity('User', userId, ROLE_AUDIT_ACTIONS);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, email: true, isActive: true, updatedAt: true },
    });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  async assignRole(
    userId: string,
    roleId: number,
    assignedBy: string,
    ipAddress?: string,
  ) {
    await this.findOne(userId);

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });

    const userRole = await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId, assignedBy },
      update: { assignedBy, assignedAt: new Date() },
      select: USER_ROLE_SELECT,
    });

    await this.auditService.log({
      actorId: assignedBy,
      entityType: 'User',
      entityId: userId,
      action: existing ? 'ROLE_REASSIGNED' : 'ROLE_ASSIGNED',
      metadata: {
        roleId: role.id,
        roleName: role.name,
        targetUserId: userId,
      },
      ipAddress,
    });

    await this.tokenService.revokeAllUserSessions(userId);
    return userRole;
  }

  async removeRole(
    userId: string,
    roleId: number,
    removedBy: string,
    ipAddress?: string,
  ) {
    await this.findOne(userId);

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    if (role.name === 'USER') {
      throw new BadRequestException('No se puede quitar el rol base USER');
    }

    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (!existing) throw new NotFoundException('El usuario no tiene ese rol');

    await this.auditService.log({
      actorId: removedBy,
      entityType: 'User',
      entityId: userId,
      action: 'ROLE_REMOVED',
      metadata: {
        roleId: role.id,
        roleName: role.name,
        targetUserId: userId,
        previousAssignedBy: existing.assignedBy,
        previousAssignedAt: existing.assignedAt.toISOString(),
      },
      ipAddress,
    });

    await this.prisma.userRole.delete({ where: { userId_roleId: { userId, roleId } } });
    await this.tokenService.revokeAllUserSessions(userId);
  }
}
