import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';

import { AmbassadorDocumentType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CommissionRatesService } from '../commissions/commission-rates.service';

import { MediaService } from '../media/media.service';

import { UpdateProfessionalDto, AdminUpdateProfessionalDto } from './dto/update-professional.dto';

import { RequestAmbassadorDto } from './dto/request-ambassador.dto';



@Injectable()

export class ProfessionalsService {

  constructor(

    private prisma: PrismaService,

    private commissionRates: CommissionRatesService,

    private mediaService: MediaService,

  ) {}



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

      include: { user: { select: { email: true } } },

    });

    if (!profile) throw new NotFoundException('Professional profile not found');



    if (profile.status === 'ACTIVE') {

      throw new ConflictException('Already an active ambassador');

    }

    if (profile.ambassadorRequestedAt) {

      throw new ConflictException('Ambassador request already submitted');

    }



    const contactEmail = dto.email ?? profile.user.email;

    const isCompany = dto.personType === 'COMPANY';

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

    return this.prisma.$transaction(async (tx) => {

      const updatedProfile = await tx.professionalProfile.update({

        where: { userId },

        data: profileData,

      });

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

      if (isCompany) {

        const company = await tx.companyProfile.create({

          data: {

            name: dto.legalName!,

            taxId: dto.cuit,

            address: dto.fiscalAddress,

            phone: dto.phone,

            email: contactEmail,

            memberships: {

              create: {

                professionalProfileId: profile.id,

                role: 'OWNER',

              },

            },

          },

        });

        if (dto.teamMembers?.length) {

          await tx.agencyTeamMember.createMany({

            data: dto.teamMembers.map((member) => ({

              agencyProfileId: profile.id,

              companyProfileId: company.id,

              firstName: member.firstName,

              lastName: member.lastName,

              dni: member.dni,

              phone: member.phone,

              email: member.email,

              roleInCompany: member.roleInCompany,

            })),

          });

        }

      }

      return updatedProfile;

    });

  }



  async verify(id: string) {

    const profile = await this.findOne(id);



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



    return { message: 'Ambassador approved' };

  }



  async reject(id: string) {

    await this.findOne(id);

    return this.prisma.professionalProfile.update({

      where: { id },

      data: { status: 'REJECTED', ambassadorRequestedAt: null },

    });

  }



  async suspend(id: string) {

    await this.findOne(id);

    return this.prisma.professionalProfile.update({ where: { id }, data: { status: 'SUSPENDED' } });

  }

}

