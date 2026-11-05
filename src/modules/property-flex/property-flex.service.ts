import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { findNextAvailableStart, type FlexBookedPeriodLike } from './flex-availability.util';
import { CommissionRatesService } from '../commissions/commission-rates.service';
import { CreatePropertyFlexDto } from './dto/create-property-flex.dto';
import { UpdatePropertyFlexDto } from './dto/update-property-flex.dto';
import { QueryPropertyFlexDto } from './dto/query-property-flex.dto';
import { flexSearchWhere } from '../../common/catalog/catalog-search-filters';
import { PropertyStatus } from '@prisma/client';

@Injectable()
export class PropertyFlexService {
  constructor(
    private prisma: PrismaService,
    private commissionRates: CommissionRatesService,
  ) {}

  async create(dto: CreatePropertyFlexDto) {
    const { address, monthlyRate, depositAmount, commissionRate, reservationPaymentAmount, minMonths, ...rest } = dto;
    return this.prisma.propertyFlex.create({
      data: {
        ...rest,
        monthlyRate: String(monthlyRate ?? 0),
        minMonths: minMonths ?? 1,
        ...(depositAmount != null && { depositAmount: String(depositAmount) }),
        ...(commissionRate != null && { commissionRate: String(commissionRate) }),
        ...(reservationPaymentAmount != null && { reservationPaymentAmount: String(reservationPaymentAmount) }),
        ...(address && { address: { create: address } }),
      },
      include: { address: true },
    });
  }

  async findAll(query: QueryPropertyFlexDto) {
    const {
      page = 1,
      limit = 20,
      companyId,
      status,
      type,
      bedrooms,
      bathrooms,
      maxMonthlyRate,
      sortBy = 'availability',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(companyId && { companyId }),
      ...(status && { status }),
      ...(type && { type }),
      ...(bedrooms != null && { bedrooms }),
      ...(bathrooms != null && { bathrooms }),
      ...(maxMonthlyRate != null && { monthlyRate: { lte: String(maxMonthlyRate) } }),
      ...flexSearchWhere(query),
    };

    const include = {
      address: true,
      images: { where: { isPrimary: true }, include: { mediaFile: true }, take: 1 },
      pricingPlans: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' as const }, { minMonths: 'asc' as const }],
        include: { depositRule: true, entryCommissionRule: true },
      },
    };

    const total = await this.prisma.propertyFlex.count({ where });

    if (sortBy === 'availability') {
      const allItems = await this.prisma.propertyFlex.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
      });
      const sorted = await this.enrichAndSortByAvailability(allItems);
      const items = sorted.slice(skip, skip + limit);
      return { items, total, page, limit };
    }

    const items = await this.prisma.propertyFlex.findMany({
      where,
      skip,
      take: limit,
      include,
      orderBy: { createdAt: 'desc' },
    });

    return { items, total, page, limit };
  }

  private async enrichAndSortByAvailability<T extends { id: string; minMonths: number | null }>(
    items: T[],
  ): Promise<Array<T & { availableFrom: string | null }>> {
    if (items.length === 0) return [];

    const from = new Date().toISOString().slice(0, 10);
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + 18);
    const to = horizon.toISOString().slice(0, 10);

    const bookings = await this.prisma.flexBooking.findMany({
      where: {
        propertyFlexId: { in: items.map((item) => item.id) },
        deletedAt: null,
        status: { notIn: ['CANCELLED'] },
        startDate: { lt: new Date(to) },
        endDate: { gt: new Date(from) },
      },
      select: { propertyFlexId: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
    });

    const periodsByProperty = new Map<string, FlexBookedPeriodLike[]>();
    for (const booking of bookings) {
      const periods = periodsByProperty.get(booking.propertyFlexId) ?? [];
      periods.push({
        startDate: booking.startDate.toISOString().slice(0, 10),
        endDate: booking.endDate.toISOString().slice(0, 10),
      });
      periodsByProperty.set(booking.propertyFlexId, periods);
    }

    const enriched = items.map((item) => {
      const periods = periodsByProperty.get(item.id) ?? [];
      const stayMonths = item.minMonths && item.minMonths > 0 ? item.minMonths : 1;
      return {
        ...item,
        availableFrom: findNextAvailableStart(periods, stayMonths, 18),
      };
    });

    enriched.sort((a, b) => {
      if (a.availableFrom == null && b.availableFrom == null) return 0;
      if (a.availableFrom == null) return 1;
      if (b.availableFrom == null) return -1;
      return a.availableFrom.localeCompare(b.availableFrom);
    });

    return enriched;
  }

  async findOne(id: string) {
    const propertyFlex = await this.prisma.propertyFlex.findFirst({
      where: { id, deletedAt: null },
      include: {
        address: true,
        amenities: { include: { amenity: true } },
        images: { include: { mediaFile: true }, orderBy: { sortOrder: 'asc' } },
        pricingPlans: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { minMonths: 'asc' }],
          include: { depositRule: true, entryCommissionRule: true },
        },
      },
    });
    if (!propertyFlex) throw new NotFoundException('PropertyFlex not found');
    return propertyFlex;
  }

  async update(id: string, dto: UpdatePropertyFlexDto) {
    await this.findOne(id);
    const { address, monthlyRate, depositAmount, commissionRate, reservationPaymentAmount, minMonths, ...rest } = dto;
    const updated = await this.prisma.propertyFlex.update({
      where: { id },
      data: {
        ...rest,
        ...(monthlyRate != null && { monthlyRate: String(Math.max(0, monthlyRate)) }),
        ...(minMonths != null && { minMonths }),
        ...(depositAmount != null && { depositAmount: String(depositAmount) }),
        ...(commissionRate != null && { commissionRate: String(commissionRate) }),
        ...(reservationPaymentAmount !== undefined && {
          reservationPaymentAmount: reservationPaymentAmount != null
            ? String(reservationPaymentAmount)
            : null,
        }),
        ...(address && { address: { upsert: { create: address, update: address } } }),
      },
      include: { address: true },
    });

    if (commissionRate != null) {
      await this.commissionRates.recalculateForPropertyFlex(id);
    }

    return updated;
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.propertyFlex.update({
      where: { id },
      data: { deletedAt: new Date(), status: PropertyStatus.INACTIVE },
    });
  }

  async addAmenity(propertyFlexId: string, amenityId: string) {
    await this.findOne(propertyFlexId);
    return this.prisma.propertyFlexAmenity.upsert({
      where: { propertyFlexId_amenityId: { propertyFlexId, amenityId } },
      create: { propertyFlexId, amenityId },
      update: {},
    });
  }

  async removeAmenity(propertyFlexId: string, amenityId: string) {
    await this.prisma.propertyFlexAmenity.delete({
      where: { propertyFlexId_amenityId: { propertyFlexId, amenityId } },
    });
  }

  async checkAvailability(id: string, startDate: string, endDate: string) {
    await this.findOne(id);
    const start = new Date(startDate);
    const end = new Date(endDate);

    const overlapping = await this.prisma.flexBooking.findFirst({
      where: {
        propertyFlexId: id,
        deletedAt: null,
        status: { notIn: ['CANCELLED'] },
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });

    return { available: !overlapping, ...(overlapping && { conflictingBookingId: overlapping.id }) };
  }

  async getBookedPeriods(id: string, from: string, to: string) {
    await this.findOne(id);
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const bookings = await this.prisma.flexBooking.findMany({
      where: {
        propertyFlexId: id,
        deletedAt: null,
        status: { notIn: ['CANCELLED'] },
        startDate: { lt: toDate },
        endDate: { gt: fromDate },
      },
      select: { startDate: true, endDate: true, status: true },
      orderBy: { startDate: 'asc' },
    });

    return {
      periods: bookings.map((b) => ({
        startDate: b.startDate.toISOString().slice(0, 10),
        endDate: b.endDate.toISOString().slice(0, 10),
        status: b.status,
      })),
    };
  }

  async getNextAvailableFrom(id: string, stayMonths?: number) {
    const property = await this.findOne(id);
    const months = stayMonths && stayMonths > 0 ? stayMonths : property.minMonths ?? 1;

    const from = new Date().toISOString().slice(0, 10);
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + 18);
    const to = horizon.toISOString().slice(0, 10);

    const { periods } = await this.getBookedPeriods(id, from, to);
    const availableFrom = findNextAvailableStart(periods, months, 18);

    return { availableFrom, stayMonths: months };
  }
}
