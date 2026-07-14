import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';

@Injectable()
export class AmbassadorAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getAmbassadorRoleId(): Promise<number> {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { name: 'AMBASSADOR' } });
    return role.id;
  }

  async grantAmbassadorRole(userId: string): Promise<void> {
    const roleId = await this.getAmbassadorRoleId();
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });
  }

  async revokeAmbassadorRole(userId: string): Promise<void> {
    const roleId = await this.getAmbassadorRoleId();
    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });
  }

  private isApprovedAgencyProfile(profile: { status: string; isVerified: boolean; personType: string | null }) {
    return profile.personType === 'COMPANY' && profile.status === 'ACTIVE' && profile.isVerified;
  }

  async assertCanOperateAsAmbassador(userId: string): Promise<{ profileId: string }> {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        isVerified: true,
        personType: true,
        user: { select: { userRoles: { select: { role: { select: { name: true } } } } } },
      },
    });

    if (!profile) {
      throw new ForbiddenException('Necesitás un perfil profesional para operar como embajador');
    }

    const hasAmbassadorRole = profile.user.userRoles.some((ur) => ur.role.name === 'AMBASSADOR');
    if (!hasAmbassadorRole) {
      throw new ForbiddenException('Se requiere rol de embajador');
    }

    if (profile.status === 'ACTIVE' && profile.isVerified) {
      return { profileId: profile.id };
    }

    const teamMembership = await this.prisma.agencyTeamMember.findFirst({
      where: { userId, isActive: true },
      include: {
        agencyProfile: { select: { id: true, status: true, isVerified: true, personType: true } },
      },
    });

    if (
      teamMembership
      && this.isApprovedAgencyProfile(teamMembership.agencyProfile)
    ) {
      return { profileId: profile.id };
    }

    throw new ForbiddenException('Tu cuenta de embajador no está activa');
  }

  async linkAgencyTeamMemberOnRegister(userId: string, email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const member = await this.prisma.agencyTeamMember.findFirst({
      where: {
        email: { equals: normalized, mode: 'insensitive' },
        userId: null,
        isActive: true,
      },
      include: {
        agencyProfile: { select: { id: true, status: true, isVerified: true, personType: true } },
      },
    });
    if (!member) return;

    const agencyApproved = this.isApprovedAgencyProfile(member.agencyProfile);

    await this.prisma.$transaction(async (tx) => {
      await tx.agencyTeamMember.update({
        where: { id: member.id },
        data: { userId },
      });

      if (member.companyProfileId) {
        const userProfile = await tx.professionalProfile.findUnique({ where: { userId } });
        if (userProfile) {
          await tx.userCompanyMembership.upsert({
            where: {
              professionalProfileId_companyProfileId: {
                professionalProfileId: userProfile.id,
                companyProfileId: member.companyProfileId,
              },
            },
            create: {
              professionalProfileId: userProfile.id,
              companyProfileId: member.companyProfileId,
              role: 'MEMBER',
            },
            update: {},
          });
        }
      }

      if (agencyApproved) {
        const roleId = await this.getAmbassadorRoleId();
        await tx.userRole.upsert({
          where: { userId_roleId: { userId, roleId } },
          create: { userId, roleId },
          update: {},
        });
      }
    });
  }

  async grantAmbassadorRolesForLinkedTeamMembers(agencyProfileId: string): Promise<void> {
    const members = await this.prisma.agencyTeamMember.findMany({
      where: { agencyProfileId, isActive: true, userId: { not: null } },
      select: { userId: true },
    });

    for (const member of members) {
      if (member.userId) {
        await this.grantAmbassadorRole(member.userId);
      }
    }
  }

  async revokeAgencyAccess(agencyProfileId: string, ownerUserId: string): Promise<void> {
    await this.revokeAmbassadorRole(ownerUserId);

    const teamMembers = await this.prisma.agencyTeamMember.findMany({
      where: { agencyProfileId, userId: { not: null } },
      select: { userId: true },
    });

    for (const member of teamMembers) {
      if (member.userId) {
        await this.revokeAmbassadorRole(member.userId);
      }
    }
  }
}
