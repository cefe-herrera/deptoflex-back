import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AmbassadorDocumentType,
  BookingStatus,
  CommissionSettlementStatus,
  CommissionStatus,
  PersonType,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { MarkSettlementPaidDto } from './dto/mark-settlement-paid.dto';
import {
  getMissingAmbassadorDocTypes,
  isAmbassadorDocumentationComplete,
} from '../professionals/ambassador-documents.util';

const ELIGIBLE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];

const COMMISSION_INCLUDE = {
  booking: {
    select: {
      id: true,
      source: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      clientName: true,
      property: { select: { name: true } },
      propertyFlex: { select: { name: true } },
      unit: { select: { name: true } },
    },
  },
} as const;

const SETTLEMENT_INCLUDE = {
  professionalProfile: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      bankCbuCvu: true,
      bankAlias: true,
      bankAccountHolder: true,
      bankName: true,
      user: { select: { email: true } },
    },
  },
  paidBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  commissions: { include: COMMISSION_INCLUDE },
} as const;

@Injectable()
export class CommissionSettlementsService {
  constructor(private prisma: PrismaService) {}

  private eligibleWhere(professionalProfileId?: string): Prisma.CommissionWhereInput {
    return {
      status: CommissionStatus.APPROVED,
      settlementId: null,
      professionalProfileId: professionalProfileId ?? { not: null },
      booking: {
        deletedAt: null,
        status: { in: ELIGIBLE_BOOKING_STATUSES },
      },
    };
  }

  private async assertDocumentationCompleteForProfiles(profileIds: string[]): Promise<void> {
    if (profileIds.length === 0) return;

    const profiles = await this.prisma.professionalProfile.findMany({
      where: { id: { in: profileIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        personType: true,
        documentationApprovedAt: true,
        ambassadorDocuments: { select: { documentType: true } },
      },
    });

    const incomplete = profiles
      .filter((profile) =>
        !isAmbassadorDocumentationComplete(
          profile.personType ?? PersonType.INDIVIDUAL,
          profile.ambassadorDocuments.map((doc) => doc.documentType),
        ),
      )
      .map((profile) => `${profile.firstName} ${profile.lastName}`.trim());

    if (incomplete.length > 0) {
      throw new BadRequestException(
        `Documentación incompleta para liquidar: ${incomplete.join(', ')}. El embajador debe completar su documentación antes de liquidar.`,
      );
    }

    const unapproved = profiles
      .filter((profile) =>
        isAmbassadorDocumentationComplete(
          profile.personType ?? PersonType.INDIVIDUAL,
          profile.ambassadorDocuments.map((doc) => doc.documentType),
        ) && !profile.documentationApprovedAt,
      )
      .map((profile) => `${profile.firstName} ${profile.lastName}`.trim());

    if (unapproved.length > 0) {
      throw new BadRequestException(
        `Documentación pendiente de revisión admin: ${unapproved.join(', ')}. Aprobá la documentación antes de liquidar.`,
      );
    }
  }

  private documentationStatus(
    personType: PersonType | null,
    documentTypes: AmbassadorDocumentType[],
    documentationApprovedAt?: Date | null,
  ) {
    const resolvedPersonType = personType ?? PersonType.INDIVIDUAL;
    const missingDocTypes = getMissingAmbassadorDocTypes(resolvedPersonType, documentTypes);
    const documentationComplete = missingDocTypes.length === 0;
    return {
      documentationComplete,
      missingDocTypes,
      documentationApproved: documentationComplete && !!documentationApprovedAt,
      documentationPendingReview: documentationComplete && !documentationApprovedAt,
    };
  }

  private mapCommission(c: Prisma.CommissionGetPayload<{ include: typeof COMMISSION_INCLUDE }>) {
    const b = c.booking;
    const placeName = b.unit?.name ?? b.property?.name ?? b.propertyFlex?.name ?? 'Reserva';
    return {
      id: c.id,
      bookingId: c.bookingId,
      status: c.status,
      rate: c.rate.toString(),
      baseAmount: c.baseAmount.toString(),
      commissionAmount: c.commissionAmount.toString(),
      currency: c.currency,
      approvedAt: c.approvedAt?.toISOString() ?? null,
      source: b.source,
      bookingStatus: b.status,
      placeName,
      clientName: b.clientName,
      checkInDate: b.checkInDate.toISOString(),
      checkOutDate: b.checkOutDate.toISOString(),
    };
  }

  private mapSettlement(
    s: Prisma.CommissionSettlementGetPayload<{ include: typeof SETTLEMENT_INCLUDE }>,
  ) {
    return {
      id: s.id,
      status: s.status,
      totalAmount: s.totalAmount.toString(),
      currency: s.currency,
      paymentMethod: s.paymentMethod,
      paymentReference: s.paymentReference,
      notes: s.notes,
      paidAt: s.paidAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      ambassador: {
        id: s.professionalProfile.id,
        firstName: s.professionalProfile.firstName,
        lastName: s.professionalProfile.lastName,
        email: s.professionalProfile.user.email,
        bank: {
          cbuCvu: s.professionalProfile.bankCbuCvu,
          alias: s.professionalProfile.bankAlias,
          accountHolder: s.professionalProfile.bankAccountHolder,
          bankName: s.professionalProfile.bankName,
        },
      },
      paidBy: s.paidBy
        ? {
            id: s.paidBy.id,
            email: s.paidBy.email,
            name: [s.paidBy.firstName, s.paidBy.lastName].filter(Boolean).join(' ') || s.paidBy.email,
          }
        : null,
      commissions: s.commissions.map((c) => this.mapCommission(c)),
      commissionCount: s.commissions.length,
    };
  }

  async getSettlementPreview() {
    const commissions = await this.prisma.commission.findMany({
      where: this.eligibleWhere(),
      include: {
        professionalProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            personType: true,
            bankCbuCvu: true,
            bankAlias: true,
            bankAccountHolder: true,
            bankName: true,
            documentationApprovedAt: true,
            ambassadorDocuments: { select: { documentType: true } },
            user: { select: { email: true } },
          },
        },
        ...COMMISSION_INCLUDE,
      },
      orderBy: [{ professionalProfileId: 'asc' }, { createdAt: 'asc' }],
    });

    const byAmbassador = new Map<string, {
      ambassador: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        bank: {
          cbuCvu: string | null;
          alias: string | null;
          accountHolder: string | null;
          bankName: string | null;
        };
        documentationComplete: boolean;
        documentationApproved: boolean;
        documentationPendingReview: boolean;
        missingDocTypes: AmbassadorDocumentType[];
      };
      totalAmount: Decimal;
      currency: string;
      commissions: ReturnType<typeof this.mapCommission>[];
    }>();

    for (const c of commissions) {
      if (!c.professionalProfile) continue;
      const profileId = c.professionalProfile.id;
      let group = byAmbassador.get(profileId);
      if (!group) {
        const docStatus = this.documentationStatus(
          c.professionalProfile.personType,
          c.professionalProfile.ambassadorDocuments.map((doc) => doc.documentType),
          c.professionalProfile.documentationApprovedAt,
        );
        group = {
          ambassador: {
            id: c.professionalProfile.id,
            firstName: c.professionalProfile.firstName,
            lastName: c.professionalProfile.lastName,
            email: c.professionalProfile.user.email,
            bank: {
              cbuCvu: c.professionalProfile.bankCbuCvu,
              alias: c.professionalProfile.bankAlias,
              accountHolder: c.professionalProfile.bankAccountHolder,
              bankName: c.professionalProfile.bankName,
            },
            documentationComplete: docStatus.documentationComplete,
            documentationApproved: docStatus.documentationApproved,
            documentationPendingReview: docStatus.documentationPendingReview,
            missingDocTypes: docStatus.missingDocTypes,
          },
          totalAmount: new Decimal(0),
          currency: c.currency,
          commissions: [],
        };
        byAmbassador.set(profileId, group);
      }
      group.totalAmount = group.totalAmount.add(c.commissionAmount);
      group.commissions.push(this.mapCommission(c));
    }

    const ambassadors = [...byAmbassador.values()].map((g) => ({
      ambassador: g.ambassador,
      totalAmount: g.totalAmount.toString(),
      currency: g.currency,
      commissionCount: g.commissions.length,
      commissions: g.commissions,
    }));

    const grandTotal = ambassadors.reduce(
      (sum, a) => sum.add(new Decimal(a.totalAmount)),
      new Decimal(0),
    );

    return {
      ambassadorCount: ambassadors.length,
      commissionCount: commissions.length,
      grandTotal: grandTotal.toString(),
      currency: ambassadors[0]?.currency ?? 'ARS',
      ambassadors,
    };
  }

  async listPendingValidation() {
    const items = await this.prisma.commission.findMany({
      where: {
        status: CommissionStatus.PENDING_VALIDATION,
        settlementId: null,
        booking: { deletedAt: null },
      },
      include: {
        professionalProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: { select: { email: true } },
          },
        },
        ...COMMISSION_INCLUDE,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      total: items.length,
      items: items.map((c) => ({
        ...this.mapCommission(c),
        ambassador: c.professionalProfile
          ? {
              id: c.professionalProfile.id,
              firstName: c.professionalProfile.firstName,
              lastName: c.professionalProfile.lastName,
              email: c.professionalProfile.user.email,
            }
          : null,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  async createSettlements(dto: CreateSettlementDto) {
    const eligible = await this.prisma.commission.findMany({
      where: this.eligibleWhere(),
      select: {
        id: true,
        professionalProfileId: true,
        commissionAmount: true,
        currency: true,
      },
    });

    const filtered = dto.professionalProfileIds?.length
      ? eligible.filter(
          (c) => c.professionalProfileId && dto.professionalProfileIds!.includes(c.professionalProfileId),
        )
      : eligible;

    if (filtered.length === 0) {
      throw new BadRequestException('No eligible commissions found for settlement');
    }

    const profileIds = [...new Set(
      filtered.map((commission) => commission.professionalProfileId).filter(Boolean) as string[],
    )];
    await this.assertDocumentationCompleteForProfiles(profileIds);

    const byProfile = new Map<string, typeof filtered>();
    for (const c of filtered) {
      if (!c.professionalProfileId) continue;
      const list = byProfile.get(c.professionalProfileId) ?? [];
      list.push(c);
      byProfile.set(c.professionalProfileId, list);
    }

    const createdIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const [profileId, commissions] of byProfile.entries()) {
        const totalAmount = commissions.reduce(
          (sum, c) => sum.add(c.commissionAmount),
          new Decimal(0),
        );
        const settlement = await tx.commissionSettlement.create({
          data: {
            professionalProfileId: profileId,
            status: CommissionSettlementStatus.DRAFT,
            totalAmount,
            currency: commissions[0]?.currency ?? 'ARS',
            notes: dto.notes,
          },
        });
        createdIds.push(settlement.id);
        await tx.commission.updateMany({
          where: { id: { in: commissions.map((c) => c.id) } },
          data: { settlementId: settlement.id },
        });
      }
    });

    const settlements = await this.prisma.commissionSettlement.findMany({
      where: { id: { in: createdIds } },
      include: SETTLEMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return {
      created: settlements.length,
      settlements: settlements.map((s) => this.mapSettlement(s)),
    };
  }

  async findAll(page = 1, limit = 20, status?: CommissionSettlementStatus) {
    const skip = (page - 1) * limit;
    const where: Prisma.CommissionSettlementWhereInput = status ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.commissionSettlement.findMany({
        where,
        skip,
        take: limit,
        include: SETTLEMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.commissionSettlement.count({ where }),
    ]);

    return {
      items: items.map((s) => this.mapSettlement(s)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, requestUser?: { id: string; roles: string[] }) {
    const settlement = await this.prisma.commissionSettlement.findUnique({
      where: { id },
      include: SETTLEMENT_INCLUDE,
    });
    if (!settlement) throw new NotFoundException('Settlement not found');

    const isStaff = requestUser?.roles.some((r) => ['ADMIN', 'OPERATOR'].includes(r));
    if (requestUser && !isStaff) {
      const profile = await this.prisma.professionalProfile.findUnique({
        where: { userId: requestUser.id },
        select: { id: true },
      });
      if (!profile || settlement.professionalProfileId !== profile.id) {
        throw new ForbiddenException('You cannot access this settlement');
      }
    }

    return this.mapSettlement(settlement);
  }

  async findMine(userId: string, page = 1, limit = 20) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      return { items: [], total: 0, page, limit };
    }

    const skip = (page - 1) * limit;
    const where = { professionalProfileId: profile.id };

    const [items, total] = await Promise.all([
      this.prisma.commissionSettlement.findMany({
        where,
        skip,
        take: limit,
        include: SETTLEMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.commissionSettlement.count({ where }),
    ]);

    return {
      items: items.map((s) => this.mapSettlement(s)),
      total,
      page,
      limit,
    };
  }

  async markPaid(id: string, dto: MarkSettlementPaidDto, paidById: string) {
    const settlement = await this.prisma.commissionSettlement.findUnique({
      where: { id },
      include: { commissions: { select: { id: true } } },
    });
    if (!settlement) throw new NotFoundException('Settlement not found');
    if (settlement.status !== CommissionSettlementStatus.DRAFT) {
      throw new BadRequestException('Only draft settlements can be marked as paid');
    }

    await this.assertDocumentationCompleteForProfiles([settlement.professionalProfileId]);

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const commissionIds = settlement.commissions.map((c) => c.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.commissionSettlement.update({
        where: { id },
        data: {
          status: CommissionSettlementStatus.PAID,
          paidAt,
          paidById,
          paymentMethod: dto.paymentMethod,
          paymentReference: dto.paymentReference,
          notes: dto.notes ?? settlement.notes,
        },
      });
      await tx.commission.updateMany({
        where: { id: { in: commissionIds } },
        data: {
          status: CommissionStatus.PAID,
          paidAt,
        },
      });
    });

    return this.findOne(id);
  }

  async cancelDraft(id: string) {
    const settlement = await this.prisma.commissionSettlement.findUnique({
      where: { id },
      include: { commissions: { select: { id: true } } },
    });
    if (!settlement) throw new NotFoundException('Settlement not found');
    if (settlement.status !== CommissionSettlementStatus.DRAFT) {
      throw new BadRequestException('Only draft settlements can be cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.commission.updateMany({
        where: { settlementId: id },
        data: { settlementId: null },
      });
      await tx.commissionSettlement.update({
        where: { id },
        data: { status: CommissionSettlementStatus.CANCELLED },
      });
    });

    return this.findOne(id);
  }
}
