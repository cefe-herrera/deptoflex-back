import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

import { AmbassadorDocumentType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CommissionRatesService } from '../commissions/commission-rates.service';

import { MediaService } from '../media/media.service';

import { AmbassadorAccessService } from '../../common/services/ambassador-access.service';

import { AgencyTeamService } from './agency-team.service';

import { UpdateProfessionalDto, AdminUpdateProfessionalDto } from './dto/update-professional.dto';

import { RequestAmbassadorDto } from './dto/request-ambassador.dto';

import { AgencyTeamMemberDto } from './dto/agency-team-member.dto';



@Injectable()

export class ProfessionalsService {

  constructor(

    private prisma: PrismaService,

    private commissionRates: CommissionRatesService,

    private mediaService: MediaService,

    private ambassadorAccess: AmbassadorAccessService,

    private agencyTeamService: AgencyTeamService,

  ) {}

  private normalizeTeamMembers(
    members: AgencyTeamMemberDto[] | undefined,
    ownerEmail: string,
  ): AgencyTeamMemberDto[] {
    if (!members?.length) {
      throw new BadRequestException('Debés indicar al menos un miembro del equipo');
    }

    const owner = ownerEmail.trim().toLowerCase();
    const seen = new Set<string>();
    const normalized: AgencyTeamMemberDto[] = [];

    for (const member of members) {
      const email = member.email.trim().toLowerCase();
      if (email === owner) {
        throw new BadRequestException('No podés incluir tu propio email como miembro del equipo');
      }
      if (seen.has(email)) {
        throw new BadRequestException(`El email ${email} está repetido en el equipo`);
      }
      seen.add(email);
      normalized.push({
        ...member,
        email,
        firstName: member.firstName.trim(),
        lastName: member.lastName.trim() || '—',
      });
    }

    return normalized;
  }

  private async assertTeamEmailsAvailable(
    members: AgencyTeamMemberDto[],
    agencyProfileId: string,
  ): Promise<void> {
    for (const member of members) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email: member.email, deletedAt: null },
      });
      if (existingUser) {
        throw new ConflictException(`El email ${member.email} ya tiene una cuenta en Weflex`);
      }

      const onOtherAgency = await this.prisma.agencyTeamMember.findFirst({
        where: {
          email: { equals: member.email, mode: 'insensitive' },
          agencyProfileId: { not: agencyProfileId },
          isActive: true,
        },
      });
      if (onOtherAgency) {
        throw new ConflictException(`El email ${member.email} ya pertenece a otra agencia`);
      }
    }
  }



  async findAll(page = 1, limit = 20) {

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([

      this.prisma.professionalProfile.findMany({

        skip,

        take: limit,

        include: { user: { select: { email: true, isActive: true } } },

        orderBy: { createdAt: 'desc' },

      }),

      this.prisma.professionalProfile.count(),

    ]);

    return { items: items.map((p) => this.mapProfile(p)), total, page, limit };

  }



  private mapProfile<T extends { defaultCommissionRate?: { toString(): string } | null }>(profile: T) {

    return {

      ...profile,

      defaultCommissionRate:

        profile.defaultCommissionRate != null

          ? profile.defaultCommissionRate.toString()

          : null,

    };

  }



  async getProfileIdByUserId(userId: string): Promise<string> {

    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId }, select: { id: true } });

    if (!profile) throw new NotFoundException('Professional profile not found');

    return profile.id;

  }



  async findByUserId(userId: string) {

    const profile = await this.prisma.professionalProfile.findUnique({

      where: { userId },

      include: { user: { select: { email: true } }, companyMemberships: { include: { companyProfile: true } } },

    });

    if (!profile) throw new NotFoundException('Professional profile not found');

    return profile;

  }



  async findOne(id: string) {

    const profile = await this.prisma.professionalProfile.findUnique({

      where: { id },

      include: {

        user: { select: { email: true, isActive: true } },

        ambassadorDocuments: { include: { mediaFile: true } },

        agencyTeamMembers: true,

        companyMemberships: { include: { companyProfile: true } },

      },

    });

    if (!profile) throw new NotFoundException('Professional profile not found');

    return this.mapProfile(profile);

  }



  async update(userId: string, dto: UpdateProfessionalDto) {

    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId } });

    if (!profile) throw new NotFoundException('Professional profile not found');

    return this.prisma.professionalProfile.update({ where: { userId }, data: dto });

  }



  async adminUpdate(id: string, dto: AdminUpdateProfessionalDto) {

    await this.findOne(id);

    const updated = await this.prisma.professionalProfile.update({ where: { id }, data: dto });



    if (dto.defaultCommissionRate != null) {

      await this.commissionRates.recalculateForAmbassador(id);

    }



    return updated;

  }



  async requestAmbassador(userId: string, dto: RequestAmbassadorDto) {

    const profile = await this.prisma.professionalProfile.findUnique({

      where: { userId },

      include: {
        user: { select: { email: true } },
        companyMemberships: { include: { companyProfile: true } },
      },

    });

    if (!profile) throw new NotFoundException('Professional profile not found');



    if (profile.status === 'ACTIVE') {

      throw new ConflictException('Already an active ambassador');

    }

    if (profile.status === 'PENDING' && profile.ambassadorRequestedAt) {

      throw new ConflictException('Ambassador request already submitted');

    }

    const canResubmit = profile.status === 'REJECTED' || profile.status === 'SUSPENDED';
    if (!canResubmit && profile.ambassadorRequestedAt) {
      throw new ConflictException('Ambassador request already submitted');
    }



    const contactEmail = dto.email ?? profile.user.email;

    const isCompany = dto.personType === 'COMPANY';

    const teamMembers = isCompany
      ? this.normalizeTeamMembers(dto.teamMembers, contactEmail)
      : undefined;

    if (isCompany) {
      await this.assertTeamEmailsAvailable(teamMembers!, profile.id);
    }

    const docPayload = isCompany

      ? [

          { mediaFileId: dto.cuitCertificateMediaFileId!, documentType: AmbassadorDocumentType.CUIT_CERTIFICATE },

          { mediaFileId: dto.foundingDocMediaFileId!, documentType: AmbassadorDocumentType.FOUNDING_DOCUMENT },

        ]

      : [

          { mediaFileId: dto.dniFrontMediaFileId!, documentType: AmbassadorDocumentType.DNI_FRONT },

          { mediaFileId: dto.dniBackMediaFileId!, documentType: AmbassadorDocumentType.DNI_BACK },

          { mediaFileId: dto.selfieMediaFileId!, documentType: AmbassadorDocumentType.SELFIE },

        ];

    for (const doc of docPayload) {

      await this.mediaService.ensureUploaded(doc.mediaFileId, userId);

    }

    const profileData = isCompany

      ? {

          personType: dto.personType,

          phone: dto.phone,

          contactEmail,

          dni: dto.cuit,

          legalName: dto.legalName,

          tradeName: dto.tradeName || null,

          fiscalAddress: dto.fiscalAddress,

          realAddress: dto.realAddress,

          firstName: dto.legalName!.slice(0, 100),

          lastName: (dto.tradeName || '—').slice(0, 100),

          city: null,

          province: null,

          ambassadorRequestedAt: new Date(),

          status: 'PENDING' as const,

        }

      : {

          personType: dto.personType,

          phone: dto.phone,

          contactEmail,

          firstName: dto.firstName!,

          lastName: dto.lastName!,

          dni: dto.dni,

          city: dto.city,

          province: dto.province,

          legalName: null,

          tradeName: null,

          fiscalAddress: null,

          realAddress: null,

          ambassadorRequestedAt: new Date(),

          status: 'PENDING' as const,

        };

    const claim = await this.prisma.professionalProfile.updateMany({

      where: {
        userId,
        status: { not: 'ACTIVE' },
        OR: [
          { ambassadorRequestedAt: null },
          { status: { in: ['REJECTED', 'SUSPENDED'] } },
        ],
      },

      data: profileData,

    });

    if (claim.count !== 1) {
      throw new ConflictException('Ambassador request already submitted');
    }

    return this.prisma.$transaction(async (tx) => {

      const updatedProfile = await tx.professionalProfile.findUniqueOrThrow({ where: { userId } });

      for (const doc of docPayload) {

        await tx.mediaFile.update({

          where: { id: doc.mediaFileId },

          data: { status: 'CONFIRMED', confirmedAt: new Date() },

        });

        await tx.ambassadorDocument.upsert({

          where: {

            professionalProfileId_documentType: {

              professionalProfileId: profile.id,

              documentType: doc.documentType,

            },

          },

          create: {

            professionalProfileId: profile.id,

            mediaFileId: doc.mediaFileId,

            documentType: doc.documentType,

          },

          update: { mediaFileId: doc.mediaFileId },

        });

      }

      if (isCompany && teamMembers) {

        let companyId = profile.companyMemberships.find((m) => m.role === 'OWNER')?.companyProfileId ?? null;

        const existingByTaxId = dto.cuit
          ? await tx.companyProfile.findUnique({ where: { taxId: dto.cuit } })
          : null;

        if (existingByTaxId) {
          companyId = existingByTaxId.id;
          await tx.companyProfile.update({
            where: { id: existingByTaxId.id },
            data: {
              name: dto.legalName!,
              address: dto.fiscalAddress,
              phone: dto.phone,
              email: contactEmail,
            },
          });
        } else {
          const company = await tx.companyProfile.create({

            data: {

              name: dto.legalName!,

              taxId: dto.cuit,

              address: dto.fiscalAddress,

              phone: dto.phone,

              email: contactEmail,

            },

          });
          companyId = company.id;
        }

        await tx.userCompanyMembership.upsert({
          where: {
            professionalProfileId_companyProfileId: {
              professionalProfileId: profile.id,
              companyProfileId: companyId!,
            },
          },
          create: {
            professionalProfileId: profile.id,
            companyProfileId: companyId!,
            role: 'OWNER',
          },
          update: { role: 'OWNER' },
        });

        await tx.agencyTeamMember.deleteMany({ where: { agencyProfileId: profile.id } });

        await tx.agencyTeamMember.createMany({

          data: teamMembers.map((member) => ({

            agencyProfileId: profile.id,

            companyProfileId: companyId,

            firstName: member.firstName,

            lastName: member.lastName,

            dni: member.dni,

            phone: member.phone,

            email: member.email,

            roleInCompany: member.roleInCompany,

          })),

        });

      }

      return updatedProfile;

    });

  }



  async verify(id: string) {

    const profile = await this.findOne(id);

    if (profile.status !== 'PENDING' || !profile.ambassadorRequestedAt) {
      throw new BadRequestException('Solo se pueden aprobar solicitudes pendientes');
    }

    const requiredDocs = profile.personType === 'COMPANY'
      ? [AmbassadorDocumentType.CUIT_CERTIFICATE, AmbassadorDocumentType.FOUNDING_DOCUMENT]
      : [
          AmbassadorDocumentType.DNI_FRONT,
          AmbassadorDocumentType.DNI_BACK,
          AmbassadorDocumentType.SELFIE,
        ];

    const presentDocs = new Set(profile.ambassadorDocuments?.map((d) => d.documentType) ?? []);
    for (const docType of requiredDocs) {
      if (!presentDocs.has(docType)) {
        throw new BadRequestException(`Falta documentación requerida: ${docType}`);
      }
    }

    if (profile.personType === 'COMPANY' && (profile.agencyTeamMembers?.length ?? 0) < 1) {
      throw new BadRequestException('La agencia debe tener al menos un miembro de equipo');
    }



    const ambassadorRole = await this.prisma.role.findUniqueOrThrow({ where: { name: 'AMBASSADOR' } });



    await this.prisma.$transaction([

      this.prisma.professionalProfile.update({

        where: { id },

        data: { isVerified: true, verifiedAt: new Date(), status: 'ACTIVE' },

      }),

      this.prisma.userRole.upsert({

        where: { userId_roleId: { userId: profile.userId, roleId: ambassadorRole.id } },

        create: { userId: profile.userId, roleId: ambassadorRole.id },

        update: {},

      }),

    ]);

    await this.ambassadorAccess.grantAmbassadorRolesForLinkedTeamMembers(id);

    if (profile.personType === 'COMPANY') {
      await this.agencyTeamService.inviteAllPendingMembers(id);
    }



    return { message: 'Ambassador approved' };

  }



  async reject(id: string) {

    const profile = await this.findOne(id);

    if (profile.status !== 'PENDING') {
      throw new BadRequestException('Solo se pueden rechazar solicitudes pendientes');
    }

    await this.ambassadorAccess.revokeAgencyAccess(id, profile.userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.agencyTeamMember.deleteMany({ where: { agencyProfileId: id } });
      await tx.userCompanyMembership.deleteMany({ where: { professionalProfileId: id } });

      const ownerMembership = profile.companyMemberships?.find((m) => m.role === 'OWNER');
      if (ownerMembership?.companyProfileId) {
        const otherMembers = await tx.userCompanyMembership.count({
          where: {
            companyProfileId: ownerMembership.companyProfileId,
            professionalProfileId: { not: id },
          },
        });
        if (otherMembers === 0) {
          await tx.companyProfile.delete({ where: { id: ownerMembership.companyProfileId } });
        }
      }

      await tx.professionalProfile.update({
        where: { id },
        data: { status: 'REJECTED', ambassadorRequestedAt: null, isVerified: false, verifiedAt: null },
      });
    });

    return { message: 'Ambassador rejected' };

  }



  async suspend(id: string) {

    const profile = await this.findOne(id);

    if (profile.status !== 'ACTIVE') {
      throw new BadRequestException('Solo se pueden suspender embajadores activos');
    }

    await this.ambassadorAccess.revokeAgencyAccess(id, profile.userId);

    return this.prisma.professionalProfile.update({
      where: { id },
      data: { status: 'SUSPENDED', ambassadorRequestedAt: null, isVerified: false },
    });

  }

}

