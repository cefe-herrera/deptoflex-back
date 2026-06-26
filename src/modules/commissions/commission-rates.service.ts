import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CommissionStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

type DbClient = PrismaService | Prisma.TransactionClient;

export type CommissionRateSource = 'OVERRIDE' | 'PROPERTY' | 'AMBASSADOR_DEFAULT' | 'ZERO';
export type FlexCommissionRateSource = CommissionRateSource;

const RATE_SOURCE_LABELS: Record<CommissionRateSource, string> = {
  OVERRIDE: 'Acuerdo especial para vos en esta propiedad',
  PROPERTY: 'Tasa de la propiedad',
  AMBASSADOR_DEFAULT: 'Tu tasa por defecto',
  ZERO: 'Sin comisión configurada',
};

@Injectable()
export class CommissionRatesService {
  constructor(private prisma: PrismaService) {}

  async resolveFlexRate(
    propertyFlexId: string,
    professionalProfileId: string | null | undefined,
    db: DbClient = this.prisma,
  ): Promise<Decimal> {
    const { rate } = await this.resolveFlexRateWithSource(propertyFlexId, professionalProfileId, db);
    return rate;
  }

  async resolveFlexRateWithSource(
    propertyFlexId: string,
    professionalProfileId: string | null | undefined,
    db: DbClient = this.prisma,
  ): Promise<{ rate: Decimal; source: FlexCommissionRateSource }> {
    if (professionalProfileId) {
      const override = await db.ambassadorFlexCommission.findUnique({
        where: {
          professionalProfileId_propertyFlexId: {
            professionalProfileId,
            propertyFlexId,
          },
        },
      });
      if (override) return { rate: override.rate, source: 'OVERRIDE' };
    }

    const property = await db.propertyFlex.findUnique({
      where: { id: propertyFlexId },
      select: { commissionRate: true },
    });
    if (property?.commissionRate != null) {
      return { rate: property.commissionRate, source: 'PROPERTY' };
    }

    if (professionalProfileId) {
      const profile = await db.professionalProfile.findUnique({
        where: { id: professionalProfileId },
        select: { defaultCommissionRate: true },
      });
      if (profile && !profile.defaultCommissionRate.isZero()) {
        return { rate: profile.defaultCommissionRate, source: 'AMBASSADOR_DEFAULT' };
      }
    }

    return { rate: new Decimal(0), source: 'ZERO' };
  }

  flexCommissionAmount(monthlyAmount: Decimal, rate: Decimal): Decimal {
    return monthlyAmount.mul(rate).div(100);
  }

  async previewFlexCommissionForUser(
    propertyFlexId: string,
    monthlyAmount: number,
    user: CurrentUserPayload,
  ) {
    const property = await this.prisma.propertyFlex.findFirst({
      where: { id: propertyFlexId, deletedAt: null },
      select: { currency: true },
    });
    if (!property) throw new NotFoundException('PropertyFlex not found');

    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!profile) {
      throw new ForbiddenException('Necesitás un perfil profesional para ver la comisión');
    }

    const { rate, source } = await this.resolveFlexRateWithSource(propertyFlexId, profile.id);
    const rateNum = Number(rate);
    const commissionAmount = this.flexCommissionAmount(new Decimal(monthlyAmount), rate);

    return {
      rate: rateNum,
      rateSource: source,
      rateSourceLabel: RATE_SOURCE_LABELS[source],
      baseAmount: monthlyAmount,
      commissionAmount: Number(commissionAmount),
      currency: property.currency,
    };
  }

  async resolveTemporalRate(
    propertyId: string,
    professionalProfileId: string | null | undefined,
    db: DbClient = this.prisma,
  ): Promise<Decimal> {
    const { rate } = await this.resolveTemporalRateWithSource(propertyId, professionalProfileId, db);
    return rate;
  }

  async resolveTemporalRateWithSource(
    propertyId: string,
    professionalProfileId: string | null | undefined,
    db: DbClient = this.prisma,
  ): Promise<{ rate: Decimal; source: CommissionRateSource }> {
    if (professionalProfileId) {
      const override = await db.ambassadorPropertyCommission.findUnique({
        where: {
          professionalProfileId_propertyId: {
            professionalProfileId,
            propertyId,
          },
        },
      });
      if (override) return { rate: override.rate, source: 'OVERRIDE' };
    }

    const property = await db.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { commissionRate: true },
    });
    if (property?.commissionRate != null) {
      return { rate: property.commissionRate, source: 'PROPERTY' };
    }

    if (professionalProfileId) {
      const profile = await db.professionalProfile.findUnique({
        where: { id: professionalProfileId },
        select: { defaultCommissionRate: true },
      });
      if (profile && !profile.defaultCommissionRate.isZero()) {
        return { rate: profile.defaultCommissionRate, source: 'AMBASSADOR_DEFAULT' };
      }
    }

    return { rate: new Decimal(0), source: 'ZERO' };
  }

  async previewTemporalCommissionForUser(
    propertyId: string,
    totalAmount: number,
    user: CurrentUserPayload,
  ) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { defaultCurrency: true },
    });
    if (!property) throw new NotFoundException('Property not found');

    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!profile) {
      throw new ForbiddenException('Necesitás un perfil profesional para ver la comisión');
    }

    const { rate, source } = await this.resolveTemporalRateWithSource(propertyId, profile.id);
    const rateNum = Number(rate);
    const commissionAmount = (totalAmount * rateNum) / 100;

    return {
      rate: rateNum,
      rateSource: source,
      rateSourceLabel: RATE_SOURCE_LABELS[source],
      baseAmount: totalAmount,
      commissionAmount,
      currency: property.defaultCurrency,
    };
  }

  async getOverview() {
    const [properties, temporalProperties, ambassadors, overrides, temporalOverrides] = await Promise.all([
      this.prisma.propertyFlex.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, status: true, commissionRate: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.property.findMany({
        where: { deletedAt: null, cloudbedsWidgetPropertyId: { not: null } },
        select: { id: true, name: true, status: true, commissionRate: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.professionalProfile.findMany({
        where: { status: { in: ['ACTIVE', 'PENDING'] } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          defaultCommissionRate: true,
          user: { select: { email: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.ambassadorFlexCommission.findMany({
        include: {
          propertyFlex: { select: { id: true, name: true } },
          professionalProfile: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.ambassadorPropertyCommission.findMany({
        include: {
          property: { select: { id: true, name: true } },
          professionalProfile: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return {
      properties,
      temporalProperties,
      ambassadors,
      overrides: overrides.map((o) => ({
        id: o.id,
        propertyFlexId: o.propertyFlexId,
        propertyName: o.propertyFlex.name,
        professionalProfileId: o.professionalProfileId,
        ambassadorName: `${o.professionalProfile.firstName} ${o.professionalProfile.lastName}`.trim(),
        rate: o.rate,
      })),
      temporalOverrides: temporalOverrides.map((o) => ({
        id: o.id,
        propertyId: o.propertyId,
        propertyName: o.property.name,
        professionalProfileId: o.professionalProfileId,
        ambassadorName: `${o.professionalProfile.firstName} ${o.professionalProfile.lastName}`.trim(),
        rate: o.rate,
      })),
    };
  }

  async setPropertyFlexRate(propertyFlexId: string, rate: number) {
    const property = await this.prisma.propertyFlex.findFirst({
      where: { id: propertyFlexId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('PropertyFlex not found');

    const updated = await this.prisma.propertyFlex.update({
      where: { id: propertyFlexId },
      data: { commissionRate: String(rate) },
      select: { id: true, name: true, commissionRate: true },
    });

    await this.recalculateForPropertyFlex(propertyFlexId);
    return updated;
  }

  async upsertAmbassadorOverride(propertyFlexId: string, professionalProfileId: string, rate: number) {
    const [property, profile] = await Promise.all([
      this.prisma.propertyFlex.findFirst({ where: { id: propertyFlexId, deletedAt: null } }),
      this.prisma.professionalProfile.findUnique({ where: { id: professionalProfileId } }),
    ]);
    if (!property) throw new NotFoundException('PropertyFlex not found');
    if (!profile) throw new NotFoundException('Professional profile not found');

    const override = await this.prisma.ambassadorFlexCommission.upsert({
      where: {
        professionalProfileId_propertyFlexId: { professionalProfileId, propertyFlexId },
      },
      create: {
        professionalProfileId,
        propertyFlexId,
        rate: String(rate),
      },
      update: { rate: String(rate) },
      include: {
        propertyFlex: { select: { name: true } },
        professionalProfile: { select: { firstName: true, lastName: true } },
      },
    });

    await this.recalculateForOverride(propertyFlexId, professionalProfileId);
    return override;
  }

  async deleteAmbassadorOverride(propertyFlexId: string, professionalProfileId: string) {
    const existing = await this.prisma.ambassadorFlexCommission.findUnique({
      where: {
        professionalProfileId_propertyFlexId: { professionalProfileId, propertyFlexId },
      },
    });
    if (!existing) throw new NotFoundException('Commission override not found');

    await this.prisma.ambassadorFlexCommission.delete({
      where: { id: existing.id },
    });

    await this.recalculateForOverride(propertyFlexId, professionalProfileId);
    return { message: 'Override removed' };
  }

  async recalculateForPropertyFlex(propertyFlexId: string) {
    const bookings = await this.pendingFlexBookings({ propertyFlexId });
    for (const booking of bookings) {
      await this.recalculateBookingCommission(booking);
    }
  }

  async setPropertyTemporalRate(propertyId: string, rate: number) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('Property not found');

    const updated = await this.prisma.property.update({
      where: { id: propertyId },
      data: { commissionRate: String(rate) },
      select: { id: true, name: true, commissionRate: true },
    });

    await this.recalculateForTemporalProperty(propertyId);
    return updated;
  }

  async upsertAmbassadorPropertyOverride(propertyId: string, professionalProfileId: string, rate: number) {
    const [property, profile] = await Promise.all([
      this.prisma.property.findFirst({ where: { id: propertyId, deletedAt: null } }),
      this.prisma.professionalProfile.findUnique({ where: { id: professionalProfileId } }),
    ]);
    if (!property) throw new NotFoundException('Property not found');
    if (!profile) throw new NotFoundException('Professional profile not found');

    const override = await this.prisma.ambassadorPropertyCommission.upsert({
      where: {
        professionalProfileId_propertyId: { professionalProfileId, propertyId },
      },
      create: {
        professionalProfileId,
        propertyId,
        rate: String(rate),
      },
      update: { rate: String(rate) },
      include: {
        property: { select: { name: true } },
        professionalProfile: { select: { firstName: true, lastName: true } },
      },
    });

    await this.recalculateForTemporalOverride(propertyId, professionalProfileId);
    return override;
  }

  async deleteAmbassadorPropertyOverride(propertyId: string, professionalProfileId: string) {
    const existing = await this.prisma.ambassadorPropertyCommission.findUnique({
      where: {
        professionalProfileId_propertyId: { professionalProfileId, propertyId },
      },
    });
    if (!existing) throw new NotFoundException('Commission override not found');

    await this.prisma.ambassadorPropertyCommission.delete({ where: { id: existing.id } });
    await this.recalculateForTemporalOverride(propertyId, professionalProfileId);
    return { message: 'Override removed' };
  }

  async recalculateForTemporalProperty(propertyId: string) {
    const bookings = await this.pendingTemporalBookings({ propertyId });
    for (const booking of bookings) {
      await this.recalculateTemporalBookingCommission(booking);
    }
  }

  async recalculateForTemporalOverride(propertyId: string, professionalProfileId: string) {
    const bookings = await this.pendingTemporalBookings({ propertyId, professionalProfileId });
    for (const booking of bookings) {
      await this.recalculateTemporalBookingCommission(booking);
    }
  }

  async recalculateForAmbassador(professionalProfileId: string) {
    const [flexBookings, temporalBookings] = await Promise.all([
      this.pendingFlexBookings({ professionalProfileId }),
      this.pendingTemporalBookings({ professionalProfileId }),
    ]);
    for (const booking of flexBookings) {
      await this.recalculateBookingCommission(booking);
    }
    for (const booking of temporalBookings) {
      await this.recalculateTemporalBookingCommission(booking);
    }
  }

  async recalculateForOverride(propertyFlexId: string, professionalProfileId: string) {
    const bookings = await this.pendingFlexBookings({ propertyFlexId, professionalProfileId });
    for (const booking of bookings) {
      await this.recalculateBookingCommission(booking);
    }
  }

  async recalculateAllPendingFlex(): Promise<{ recalculated: number }> {
    const result = await this.recalculateAllPending();
    return { recalculated: result.recalculated };
  }

  async recalculateAllPending(): Promise<{ recalculated: number; flex: number; temporal: number }> {
    const [flexBookings, temporalBookings] = await Promise.all([
      this.pendingFlexBookings({}),
      this.pendingTemporalBookings({}),
    ]);
    for (const booking of flexBookings) {
      await this.recalculateBookingCommission(booking);
    }
    for (const booking of temporalBookings) {
      await this.recalculateTemporalBookingCommission(booking);
    }
    return {
      recalculated: flexBookings.length + temporalBookings.length,
      flex: flexBookings.length,
      temporal: temporalBookings.length,
    };
  }

  private async pendingFlexBookings(where: {
    propertyFlexId?: string;
    professionalProfileId?: string;
  }) {
    return this.prisma.booking.findMany({
      where: {
        propertyFlexId: { not: null },
        ...where,
        commission: { status: CommissionStatus.PENDING },
      },
      select: {
        id: true,
        propertyFlexId: true,
        professionalProfileId: true,
        flexBooking: { select: { monthlyAmount: true } },
      },
    });
  }

  private async pendingTemporalBookings(where: {
    propertyId?: string;
    professionalProfileId?: string;
  }) {
    return this.prisma.booking.findMany({
      where: {
        propertyId: { not: null },
        propertyFlexId: null,
        source: { in: ['CLOUDBEDS', 'DIRECT'] },
        ...where,
        commission: { status: CommissionStatus.PENDING },
      },
      select: {
        id: true,
        propertyId: true,
        professionalProfileId: true,
        totalAmount: true,
      },
    });
  }

  private async recalculateBookingCommission(booking: {
    id: string;
    propertyFlexId: string | null;
    professionalProfileId: string | null;
    flexBooking: { monthlyAmount: Decimal } | null;
  }) {
    if (!booking.propertyFlexId || !booking.flexBooking) return;

    const rate = await this.resolveFlexRate(booking.propertyFlexId, booking.professionalProfileId);
    const monthlyAmount = booking.flexBooking.monthlyAmount;
    const commissionAmount = this.flexCommissionAmount(monthlyAmount, rate);

    await this.prisma.commission.updateMany({
      where: { bookingId: booking.id, status: CommissionStatus.PENDING },
      data: {
        rate,
        baseAmount: monthlyAmount,
        commissionAmount,
      },
    });
  }

  private async recalculateTemporalBookingCommission(booking: {
    id: string;
    propertyId: string | null;
    professionalProfileId: string | null;
    totalAmount: Decimal;
  }) {
    if (!booking.propertyId) return;

    const rate = await this.resolveTemporalRate(booking.propertyId, booking.professionalProfileId);
    const commissionAmount = booking.totalAmount.mul(rate).div(100);

    await this.prisma.commission.updateMany({
      where: { bookingId: booking.id, status: CommissionStatus.PENDING },
      data: {
        rate,
        baseAmount: booking.totalAmount,
        commissionAmount,
      },
    });
  }
}
