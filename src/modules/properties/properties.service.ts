import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { PropertyStatus } from '@prisma/client';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePropertyDto) {
    const { address, ...rest } = dto;
    return this.prisma.property.create({
      data: {
        ...rest,
        ...(address && { address: { create: address } }),
      },
      include: { address: true },
    });
  }

  async findAll(query: QueryPropertiesDto) {
    const { page = 1, limit = 20, companyId, status, type, city } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(companyId && { companyId }),
      ...(status && { status }),
      ...(type && { type }),
      ...(city && { address: { city: { contains: city, mode: 'insensitive' } } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        include: {
          address: true,
          _count: { select: { units: true } },
          propertyImages: { where: { isPrimary: true }, include: { mediaFile: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.property.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, deletedAt: null },
      include: {
        address: true,
        propertyAmenities: { include: { amenity: true } },
        propertyImages: { include: { mediaFile: true }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { units: true } },
      },
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async update(id: string, dto: UpdatePropertyDto) {
    await this.findOne(id);
    const { address, ...rest } = dto;
    return this.prisma.property.update({
      where: { id },
      data: {
        ...rest,
        ...(address && { address: { upsert: { create: address, update: address } } }),
      },
      include: { address: true },
    });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.property.update({ where: { id }, data: { deletedAt: new Date(), status: PropertyStatus.INACTIVE } });
  }

  async addAmenity(propertyId: string, amenityId: string) {
    await this.findOne(propertyId);
    return this.prisma.propertyAmenity.upsert({
      where: { propertyId_amenityId: { propertyId, amenityId } },
      create: { propertyId, amenityId },
      update: {},
    });
  }

  async removeAmenity(propertyId: string, amenityId: string) {
    await this.prisma.propertyAmenity.delete({
      where: { propertyId_amenityId: { propertyId, amenityId } },
    });
  }
}
