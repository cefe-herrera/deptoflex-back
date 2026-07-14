import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { TokenService } from '../auth/token.service';
import { AmbassadorAccessService } from '../../common/services/ambassador-access.service';
import { AgencyTeamMemberDto } from './dto/agency-team-member.dto';

const MEMBER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  dni: true,
  phone: true,
  email: true,
  roleInCompany: true,
  isActive: true,
  userId: true,
  invitedAt: true,
  deactivatedAt: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      email: true,
      isActive: true,
      emailVerified: true,
      professionalProfile: { select: { id: true } },
    },
  },
} as const;

@Injectable()
export class AgencyTeamService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    private tokenService: TokenService,
    private ambassadorAccess: AmbassadorAccessService,
  ) {}

  private getRegisterBaseUrl(): string {
    const configured = this.configService.get<string>('app.frontendUrl')?.replace(/\/$/, '');
    if (configured && !configured.includes('localhost')) {
      return configured;
    }
    return 'https://weflex.com.ar';
  }

  private buildRegistrationLink(email: string): string {
    const normalized = email.trim().toLowerCase();
    return `${this.getRegisterBaseUrl()}/register?email=${encodeURIComponent(normalized)}`;
  }

  private mapMember(member: {
    id: string;
    firstName: string;
    lastName: string;
    dni: string;
    phone: string;
    email: string;
    roleInCompany: string;
    isActive: boolean;
    userId: string | null;
    invitedAt: Date | null;
    deactivatedAt: Date | null;
    createdAt: Date;
    user: {
      id: string;
      email: string;
      isActive: boolean;
      emailVerified: boolean;
      professionalProfile: { id: string } | null;
    } | null;
  }, commissions?: {
    total: number;
    paid: number;
    pending: number;
    approved: number;
    count: number;
  }) {
    let accountStatus: 'pending' | 'active' | 'inactive' = 'pending';
    if (!member.isActive || (member.user && !member.user.isActive)) {
      accountStatus = 'inactive';
    } else if (member.userId && member.user) {
      accountStatus = 'active';
    }

    return {
      ...member,
      accountStatus,
      professionalProfileId: member.user?.professionalProfile?.id ?? null,
      commissions: commissions ?? { total: 0, paid: 0, pending: 0, approved: 0, count: 0 },
    };
  }

  private async getMemberCommissionStats(professionalProfileId: string | null | undefined) {
    const empty = { total: 0, paid: 0, pending: 0, approved: 0, count: 0 };
    if (!professionalProfileId) return empty;

    const rows = await this.prisma.commission.findMany({
      where: { professionalProfileId },
      select: { commissionAmount: true, status: true },
    });

    return rows.reduce((acc, row) => {
      const amount = Number(row.commissionAmount);
      acc.total += amount;
      acc.count += 1;
      if (row.status === 'PAID') acc.paid += amount;
      else if (row.status === 'PENDING' || row.status === 'PENDING_VALIDATION') acc.pending += amount;
      else if (row.status === 'APPROVED') acc.approved += amount;
      return acc;
    }, { ...empty });
  }

  private async getAgencyOwnerContext(userId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            userRoles: { include: { role: true } },
          },
        },
        companyMemberships: { include: { companyProfile: true } },
      },
    });

    if (!profile) throw new NotFoundException('Professional profile not found');
    if (profile.personType !== 'COMPANY') {
      throw new ForbiddenException('Solo agencias pueden gestionar cuentas de equipo');
    }
    if (profile.status !== 'ACTIVE' || !profile.isVerified) {
      throw new ForbiddenException('La agencia debe estar aprobada para gestionar cuentas');
    }

    const ownerMembership = profile.companyMemberships.find((m) => m.role === 'OWNER');
    if (!ownerMembership) {
      throw new ForbiddenException('Solo el titular de la agencia puede gestionar cuentas');
    }

    const isAmbassador = profile.user.userRoles.some((ur) => ur.role.name === 'AMBASSADOR');
    if (!isAmbassador) {
      throw new ForbiddenException('Se requiere rol de embajador');
    }

    return {
      profile,
      company: ownerMembership.companyProfile,
    };
  }

  async listTeam(userId: string) {
    const { profile, company } = await this.getAgencyOwnerContext(userId);
    const members = await this.prisma.agencyTeamMember.findMany({
      where: { agencyProfileId: profile.id },
      select: MEMBER_SELECT,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    const items = await Promise.all(
      members.map(async (m) => {
        const stats = await this.getMemberCommissionStats(m.user?.professionalProfile?.id);
        return this.mapMember(m, stats);
      }),
    );

    const summary = items.reduce(
      (acc, m) => ({
        totalMembers: acc.totalMembers + 1,
        activeMembers: acc.activeMembers + (m.accountStatus === 'active' ? 1 : 0),
        pendingMembers: acc.pendingMembers + (m.accountStatus === 'pending' ? 1 : 0),
        inactiveMembers: acc.inactiveMembers + (m.accountStatus === 'inactive' ? 1 : 0),
        totalCommissions: acc.totalCommissions + m.commissions.total,
        paidCommissions: acc.paidCommissions + m.commissions.paid,
        pendingCommissions: acc.pendingCommissions + m.commissions.pending,
      }),
      {
        totalMembers: 0,
        activeMembers: 0,
        pendingMembers: 0,
        inactiveMembers: 0,
        totalCommissions: 0,
        paidCommissions: 0,
        pendingCommissions: 0,
      },
    );

    return {
      agencyName: company.name,
      summary,
      items,
    };
  }

  async addTeamMember(userId: string, dto: AgencyTeamMemberDto) {
    const { profile, company } = await this.getAgencyOwnerContext(userId);
    const email = dto.email.trim().toLowerCase();

    if (email === profile.user.email.toLowerCase()) {
      throw new BadRequestException('No podés invitar tu propio email como miembro del equipo');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existingUser) {
      throw new ConflictException('El email ya tiene una cuenta registrada en Weflex');
    }

    const existingMember = await this.prisma.agencyTeamMember.findFirst({
      where: {
        agencyProfileId: profile.id,
        email: { equals: email, mode: 'insensitive' },
      },
    });

    if (existingMember?.isActive && !existingMember.deactivatedAt) {
      throw new ConflictException('Ya existe un miembro activo con ese email');
    }

    const now = new Date();
    const member = existingMember
      ? await this.prisma.agencyTeamMember.update({
          where: { id: existingMember.id },
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            dni: dto.dni,
            phone: dto.phone,
            email,
            roleInCompany: dto.roleInCompany,
            isActive: true,
            deactivatedAt: null,
            invitedAt: now,
            userId: null,
          },
          select: MEMBER_SELECT,
        })
      : await this.prisma.agencyTeamMember.create({
          data: {
            agencyProfileId: profile.id,
            companyProfileId: company.id,
            firstName: dto.firstName,
            lastName: dto.lastName,
            dni: dto.dni,
            phone: dto.phone,
            email,
            roleInCompany: dto.roleInCompany,
            invitedAt: now,
          },
          select: MEMBER_SELECT,
        });

    const registerLink = this.buildRegistrationLink(email);
    const sent = await this.emailService.sendAgencyMemberInvitationEmail(
      email,
      registerLink,
      company.name,
    );

    return {
      member: this.mapMember(member),
      invitationSent: sent,
      registerLink,
    };
  }

  async inviteAllPendingMembers(agencyProfileId: string): Promise<{ sent: number; failed: number }> {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { id: agencyProfileId },
      include: {
        companyMemberships: { include: { companyProfile: true } },
      },
    });
    if (!profile || profile.personType !== 'COMPANY') {
      return { sent: 0, failed: 0 };
    }

    const company = profile.companyMemberships.find((m) => m.role === 'OWNER')?.companyProfile;
    if (!company) return { sent: 0, failed: 0 };

    const members = await this.prisma.agencyTeamMember.findMany({
      where: { agencyProfileId, userId: null, isActive: true },
    });

    let sent = 0;
    let failed = 0;

    for (const member of members) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email: member.email, deletedAt: null },
      });
      if (existingUser) {
        failed += 1;
        continue;
      }

      const registerLink = this.buildRegistrationLink(member.email);
      const ok = await this.emailService.sendAgencyMemberInvitationEmail(
        member.email,
        registerLink,
        company.name,
      );

      if (ok) {
        sent += 1;
        await this.prisma.agencyTeamMember.update({
          where: { id: member.id },
          data: { invitedAt: new Date() },
        });
      } else {
        failed += 1;
      }
    }

    return { sent, failed };
  }

  async deactivateTeamMember(userId: string, memberId: string) {
    const { profile } = await this.getAgencyOwnerContext(userId);
    const member = await this.prisma.agencyTeamMember.findFirst({
      where: { id: memberId, agencyProfileId: profile.id },
      select: MEMBER_SELECT,
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');

    if (!member.isActive) {
      throw new BadRequestException('El miembro ya está dado de baja');
    }

    const now = new Date();
    const linkedUserId = member.userId;

    await this.prisma.$transaction(async (tx) => {
      await tx.agencyTeamMember.update({
        where: { id: memberId },
        data: { isActive: false, deactivatedAt: now },
      });

      if (linkedUserId) {
        await tx.user.update({
          where: { id: linkedUserId },
          data: { isActive: false },
        });
      }
    });

    if (linkedUserId) {
      await this.tokenService.revokeAllUserSessions(linkedUserId);
      await this.ambassadorAccess.revokeAmbassadorRole(linkedUserId);
    }

    const updated = await this.prisma.agencyTeamMember.findUniqueOrThrow({
      where: { id: memberId },
      select: MEMBER_SELECT,
    });
    return this.mapMember(updated);
  }

  async activateTeamMember(userId: string, memberId: string) {
    const { profile, company } = await this.getAgencyOwnerContext(userId);
    const member = await this.prisma.agencyTeamMember.findFirst({
      where: { id: memberId, agencyProfileId: profile.id },
      select: MEMBER_SELECT,
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');

    if (member.isActive && !member.deactivatedAt) {
      throw new BadRequestException('El miembro ya está activo');
    }

    await this.prisma.agencyTeamMember.update({
      where: { id: memberId },
      data: { isActive: true, deactivatedAt: null },
    });

    if (member.userId) {
      await this.prisma.user.update({
        where: { id: member.userId },
        data: { isActive: true },
      });
      await this.ambassadorAccess.grantAmbassadorRole(member.userId);
    } else {
      const registerLink = this.buildRegistrationLink(member.email);
      await this.emailService.sendAgencyMemberInvitationEmail(
        member.email,
        registerLink,
        company.name,
      );
    }

    const updated = await this.prisma.agencyTeamMember.findUniqueOrThrow({
      where: { id: memberId },
      select: MEMBER_SELECT,
    });
    return this.mapMember(updated);
  }

  async resendInvitation(userId: string, memberId: string) {
    const { profile, company } = await this.getAgencyOwnerContext(userId);
    const member = await this.prisma.agencyTeamMember.findFirst({
      where: { id: memberId, agencyProfileId: profile.id },
      select: MEMBER_SELECT,
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    if (member.userId) {
      throw new BadRequestException('Este miembro ya tiene una cuenta registrada');
    }
    if (!member.isActive) {
      throw new BadRequestException('El miembro está dado de baja');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: member.email, deletedAt: null },
    });
    if (existingUser) {
      throw new ConflictException('El email ya tiene una cuenta registrada en Weflex');
    }

    const registerLink = this.buildRegistrationLink(member.email);
    const sent = await this.emailService.sendAgencyMemberInvitationEmail(
      member.email,
      registerLink,
      company.name,
    );
    if (!sent) {
      throw new ServiceUnavailableException('No se pudo enviar el email de invitación');
    }

    await this.prisma.agencyTeamMember.update({
      where: { id: memberId },
      data: { invitedAt: new Date() },
    });

    return { invitationSent: true, registerLink };
  }

  async removeTeamMember(userId: string, memberId: string) {
    const { profile } = await this.getAgencyOwnerContext(userId);
    const member = await this.prisma.agencyTeamMember.findFirst({
      where: { id: memberId, agencyProfileId: profile.id },
      select: MEMBER_SELECT,
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    if (member.userId) {
      throw new BadRequestException('No se puede eliminar un miembro con cuenta registrada. Usá dar de baja.');
    }

    await this.prisma.agencyTeamMember.delete({ where: { id: memberId } });
    return { removed: true };
  }
}
