import { Injectable, NotFoundException } from '@nestjs/common';
import { CommissionStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CommissionRatesService {
  constructor(private prisma: PrismaService) {}

  async resolveFlexRate(
    propertyFlexId: string,
    professionalProfileId: string | null | undefined,
    db: DbClient = this.prisma,
  ): Promise<Decimal> {
    if (professionalProfileId) {
      const override = await db.ambassadorFlexCommission.findUnique({
        where: {
          professionalProfileId_propertyFlexId: {
            professionalProfileId,
            propertyFlexId,
          },
        },
      });
      if (override) return override.rate;
    }

    const property = await db.propertyFlex.findUnique({
      where: { id: propertyFlexId },
      select: { commissionRate: true },
    });
    if (property?.commissionRate != null) return property.commissionRate;

    if (professionalProfileId) {
      const profile = await db.professionalProfile.findUnique({
        where: { id: professionalProfileId },
        select: { defaultCommissionRate: true },
      });
      if (profile) return profile.defaultCommissionRate;
    }

    return new Decimal(0);
  }

  async getOverview() {
    const [properties, ambassadors, overrides] = await Promise.all([
      this.prisma.propertyFlex.findMany({
        where: { deletedAt: null },
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
    ]);

    return {
      properties,
      ambassadors,
      overrides: overrides.map((o) => ({
        id: o.id,
        propertyFlexId: o.propertyFlexId,
        propertyName: o.propertyFlex.name,
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

  async recalculateForAmbassador(professionalProfileId: string) {
    const bookings = await this.pendingFlexBookings({ professionalProfileId });
    for (const booking of bookings) {
      await this.recalculateBookingCommission(booking);
    }
  }

  async recalculateForOverride(propertyFlexId: string, professionalProfileId: string) {
    const bookings = await this.pendingFlexBookings({ propertyFlexId, professionalProfileId });
    for (const booking of bookings) {
      await this.recalculateBookingCommission(booking);
    }
  }

  async recalculateAllPendingFlex(): Promise<{ recalculated: number }> {
    const bookings = await this.pendingFlexBookings({});
    for (const booking of bookings) {
      await this.recalculateBookingCommission(booking);
    }
    return { recalculated: bookings.length };
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
        totalAmount: true,
      },
    });
  }

  private async recalculateBookingCommission(booking: {
    id: string;
    propertyFlexId: string | null;
    professionalProfileId: string | null;
    totalAmount: Decimal;
  }) {
    if (!booking.propertyFlexId) return;

    const rate = await this.resolveFlexRate(booking.propertyFlexId, booking.professionalProfileId);
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
