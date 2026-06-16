import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { findNextAvailableStart } from './flex-availability.util';
import { CommissionRatesService } from '../commissions/commission-rates.service';
import { CreatePropertyFlexDto } from './dto/create-property-flex.dto';
import { UpdatePropertyFlexDto } from './dto/update-property-flex.dto';
import { QueryPropertyFlexDto } from './dto/query-property-flex.dto';
import { PropertyStatus } from '@prisma/client';

@Injectable()
export class PropertyFlexService {
  constructor(
    private prisma: PrismaService,
    private commissionRates: CommissionRatesService,
  ) {}

  async create(dto: CreatePropertyFlexDto) {
    const { address, monthlyRate, depositAmount, commissionRate, reservationPaymentAmount, ...rest } = dto;
    return this.prisma.propertyFlex.create({
      data: {
        ...rest,
        monthlyRate: String(monthlyRate),
        ...(depositAmount != null && { depositAmount: String(depositAmount) }),
        ...(commissionRate != null && { commissionRate: String(commissionRate) }),
        ...(reservationPaymentAmount != null && { reservationPaymentAmount: String(reservationPaymentAmount) }),
        ...(address && { address: { create: address } }),
      },
      include: { address: true },
    });
  }

  async findAll(query: QueryPropertyFlexDto) {
    const { page = 1, limit = 20, companyId, status, type, city, bedrooms, bathrooms, maxMonthlyRate } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(companyId && { companyId }),
      ...(status && { status }),
      ...(type && { type }),
      ...(city && { address: { city: { contains: city, mode: 'insensitive' } } }),
      ...(bedrooms != null && { bedrooms }),
      ...(bathrooms != null && { bathrooms }),
      ...(maxMonthlyRate != null && { monthlyRate: { lte: String(maxMonthlyRate) } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.propertyFlex.findMany({
        where,
        skip,
        take: limit,
        include: {
          address: true,
          images: { where: { isPrimary: true }, include: { mediaFile: true }, take: 1 },
          pricingPlans: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { minMonths: 'asc' }] },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.propertyFlex.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const propertyFlex = await this.prisma.propertyFlex.findFirst({
      where: { id, deletedAt: null },
      include: {
        address: true,
        amenities: { include: { amenity: true } },
        images: { include: { mediaFile: true }, orderBy: { sortOrder: 'asc' } },
        pricingPlans: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { minMonths: 'asc' }] },
      },
    });
    if (!propertyFlex) throw new NotFoundException('PropertyFlex not found');
    return propertyFlex;
  }

  async update(id: string, dto: UpdatePropertyFlexDto) {
    await this.findOne(id);
    const { address, monthlyRate, depositAmount, commissionRate, reservationPaymentAmount, ...rest } = dto;
    const updated = await this.prisma.propertyFlex.update({
      where: { id },
      data: {
        ...rest,
        ...(monthlyRate != null && { monthlyRate: String(monthlyRate) }),
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
