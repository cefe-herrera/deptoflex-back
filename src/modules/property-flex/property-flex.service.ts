import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyFlexDto } from './dto/create-property-flex.dto';
import { UpdatePropertyFlexDto } from './dto/update-property-flex.dto';
import { QueryPropertyFlexDto } from './dto/query-property-flex.dto';
import { PropertyStatus } from '@prisma/client';

@Injectable()
export class PropertyFlexService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePropertyFlexDto) {
    const { address, monthlyRate, depositAmount, ...rest } = dto;
    return this.prisma.propertyFlex.create({
      data: {
        ...rest,
        monthlyRate: String(monthlyRate),
        ...(depositAmount != null && { depositAmount: String(depositAmount) }),
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
      },
    });
    if (!propertyFlex) throw new NotFoundException('PropertyFlex not found');
    return propertyFlex;
  }

  async update(id: string, dto: UpdatePropertyFlexDto) {
    await this.findOne(id);
    const { address, monthlyRate, depositAmount, ...rest } = dto;
    return this.prisma.propertyFlex.update({
      where: { id },
      data: {
        ...rest,
        ...(monthlyRate != null && { monthlyRate: String(monthlyRate) }),
        ...(depositAmount != null && { depositAmount: String(depositAmount) }),
        ...(address && { address: { upsert: { create: address, update: address } } }),
      },
      include: { address: true },
    });
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
}
