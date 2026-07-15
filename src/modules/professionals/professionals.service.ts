import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

import { AmbassadorDocumentType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CommissionRatesService } from '../commissions/commission-rates.service';

import { MediaService } from '../media/media.service';

import { AmbassadorAccessService } from '../../common/services/ambassador-access.service';

import { AuditService } from '../../common/services/audit.service';

import { AMBASSADOR_AUDIT_ACTIONS } from '../../common/services/ambassador-audit-actions';

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

    private audit: AuditService,

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

      include: {
        user: { select: { email: true } },
        companyMemberships: { include: { companyProfile: true } },
        ambassadorDocuments: { select: { documentType: true, createdAt: true } },
      },

    });

    if (!profile) throw new NotFoundException('Professional profile not found');

    return profile;

  }



  /**
   * Confirma UN documento de embajador apenas el usuario lo sube, en vez de
   * esperar al envío final de toda la solicitud. Así, si falla la subida de
   * otro documento más adelante, este ya queda guardado y no hay que
   * repetirlo. Cada intento (éxito o fallo) queda en el audit log.
   */
  async confirmAmbassadorDocument(
    userId: string,
    documentType: AmbassadorDocumentType,
    mediaFileId: string,
  ) {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Professional profile not found');

    if (profile.status === 'ACTIVE') {
      throw new ConflictException('Already an active ambassador');
    }

    try {
      await this.mediaService.attachAmbassadorDocuments(profile.id, userId, [
        { mediaFileId, documentType },
      ]);
    } catch (err) {
      await this.audit.log({
        actorId: userId,
        entityType: 'ProfessionalProfile',
        entityId: profile.id,
        action: AMBASSADOR_AUDIT_ACTIONS.DOCUMENT_UPLOAD_FAILED,
        metadata: {
          documentType,
          mediaFileId,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }

    await this.audit.log({
      actorId: userId,
      entityType: 'ProfessionalProfile',
      entityId: profile.id,
      action: AMBASSADOR_AUDIT_ACTIONS.DOCUMENT_UPLOAD_CONFIRMED,
      metadata: { documentType, mediaFileId },
    });

    return { confirmed: true, documentType };
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

    const requiredDocTypes = isCompany
      ? [AmbassadorDocumentType.CUIT_CERTIFICATE, AmbassadorDocumentType.FOUNDING_DOCUMENT]
      : [AmbassadorDocumentType.DNI_FRONT, AmbassadorDocumentType.DNI_BACK, AmbassadorDocumentType.SELFIE];

    // Documentos que el cliente pueda seguir mandando en este mismo request
    // (compatibilidad con versiones viejas del wizard). Lo normal hoy es que
    // ya hayan sido confirmados antes, uno por uno, vía
    // POST /professionals/me/ambassador-documents/:documentType/confirm.
    const providedDocs = isCompany
      ? [
          dto.cuitCertificateMediaFileId
            ? { mediaFileId: dto.cuitCertificateMediaFileId, documentType: AmbassadorDocumentType.CUIT_CERTIFICATE }
            : null,
          dto.foundingDocMediaFileId
            ? { mediaFileId: dto.foundingDocMediaFileId, documentType: AmbassadorDocumentType.FOUNDING_DOCUMENT }
            : null,
        ]
      : [
          dto.dniFrontMediaFileId
            ? { mediaFileId: dto.dniFrontMediaFileId, documentType: AmbassadorDocumentType.DNI_FRONT }
            : null,
          dto.dniBackMediaFileId
            ? { mediaFileId: dto.dniBackMediaFileId, documentType: AmbassadorDocumentType.DNI_BACK }
            : null,
          dto.selfieMediaFileId
            ? { mediaFileId: dto.selfieMediaFileId, documentType: AmbassadorDocumentType.SELFIE }
            : null,
        ];

    for (const doc of providedDocs) {
      if (!doc) continue;
      try {
        await this.mediaService.attachAmbassadorDocuments(profile.id, userId, [doc]);
      } catch (err) {
        await this.audit.log({
          actorId: userId,
          entityType: 'ProfessionalProfile',
          entityId: profile.id,
          action: AMBASSADOR_AUDIT_ACTIONS.DOCUMENT_UPLOAD_FAILED,
          metadata: {
            documentType: doc.documentType,
            mediaFileId: doc.mediaFileId,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        // No aborta acá: seguimos intentando el resto y recién al final
        // reportamos, con precisión, qué documentos faltan de verdad.
      }
    }

    const attachedDocs = await this.prisma.ambassadorDocument.findMany({
      where: { professionalProfileId: profile.id },
      select: { documentType: true },
    });
    const attachedTypes = new Set(attachedDocs.map((d) => d.documentType));
    const missingDocTypes = requiredDocTypes.filter((t) => !attachedTypes.has(t));

    if (missingDocTypes.length > 0) {
      await this.audit.log({
        actorId: userId,
        entityType: 'ProfessionalProfile',
        entityId: profile.id,
        action: AMBASSADOR_AUDIT_ACTIONS.REQUEST_FAILED,
        metadata: { reason: 'missing_documents', missingDocTypes },
      });
      throw new BadRequestException(
        `Falta subir o confirmar: ${missingDocTypes.join(', ')}. Volvé a intentarlo desde la app.`,
      );
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

    const result = await this.prisma.$transaction(async (tx) => {

      const updatedProfile = await tx.professionalProfile.findUniqueOrThrow({ where: { userId } });

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

    await this.audit.log({
      actorId: userId,
      entityType: 'ProfessionalProfile',
      entityId: profile.id,
      action: AMBASSADOR_AUDIT_ACTIONS.REQUEST_SUBMITTED,
      metadata: { personType: dto.personType },
    });

    return result;

  }



  async verify(id: string, actorId?: string) {

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

    await this.audit.log({
      actorId: actorId ?? null,
      entityType: 'ProfessionalProfile',
      entityId: id,
      action: AMBASSADOR_AUDIT_ACTIONS.REQUEST_APPROVED,
      metadata: {},
    });

    return { message: 'Ambassador approved' };

  }



  async reject(id: string, actorId?: string) {

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

    await this.audit.log({
      actorId: actorId ?? null,
      entityType: 'ProfessionalProfile',
      entityId: id,
      action: AMBASSADOR_AUDIT_ACTIONS.REQUEST_REJECTED,
      metadata: {},
    });

    return { message: 'Ambassador rejected' };

  }



  async suspend(id: string, actorId?: string) {

    const profile = await this.findOne(id);

    if (profile.status !== 'ACTIVE') {
      throw new BadRequestException('Solo se pueden suspender embajadores activos');
    }

    await this.ambassadorAccess.revokeAgencyAccess(id, profile.userId);

    const suspended = await this.prisma.professionalProfile.update({
      where: { id },
      data: { status: 'SUSPENDED', ambassadorRequestedAt: null, isVerified: false },
    });

    await this.audit.log({
      actorId: actorId ?? null,
      entityType: 'ProfessionalProfile',
      entityId: id,
      action: AMBASSADOR_AUDIT_ACTIONS.REQUEST_SUSPENDED,
      metadata: {},
    });

    return suspended;

  }

  /**
   * Reconstruye, para el admin, qué pasó con una solicitud de embajador:
   * la línea de tiempo de audit logs (subidas, fallos, aprobación, etc.) +
   * los archivos que el usuario llegó a subir a storage pero que nunca se
   * confirmaron como documento (pista de un envío fallido a mitad de camino).
   */
  async getActivity(id: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!profile) throw new NotFoundException('Professional profile not found');

    const [events, orphanFiles] = await Promise.all([
      this.audit.findForEntity('ProfessionalProfile', id),
      this.mediaService.findOrphanAmbassadorUploads(profile.id, profile.userId),
    ]);

    return {
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        metadata: e.metadata,
        createdAt: e.createdAt,
        actor: e.user
          ? { id: e.user.id, email: e.user.email, name: `${e.user.firstName} ${e.user.lastName}`.trim() }
          : null,
      })),
      orphanFiles,
    };
  }

}

