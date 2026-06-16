import { Injectable, NotFoundException } from '@nestjs/common';
import { PropertyStatus, UnitStatus, RentalModality } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  QueryPublicFlexListDto,
  QueryPublicPropertiesListDto,
  QueryPublicUnitsListDto,
} from './dto/query-public-list.dto';

@Injectable()
export class PublicCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listFlex(query: QueryPublicFlexListDto) {
    const { page = 1, limit = 50, city, bedrooms, bathrooms, maxMonthlyRate, type } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      status: PropertyStatus.ACTIVE,
      ...(type && { type }),
      ...(city && { address: { city: { contains: city, mode: 'insensitive' as const } } }),
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

    return {
      items: items.map(({ commissionRate: _c, deletedAt: _d, companyId: _co, ...safe }) => safe),
      total,
      page,
      limit,
    };
  }

  async listProperties(query: QueryPublicPropertiesListDto) {
    const { page = 1, limit = 100, city, type } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      status: PropertyStatus.ACTIVE,
      ...(type && { type }),
      ...(city && { address: { city: { contains: city, mode: 'insensitive' as const } } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        include: {
          address: true,
          propertyImages: { where: { isPrimary: true }, include: { mediaFile: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: items.map(({ deletedAt: _d, companyId: _co, ...safe }) => safe),
      total,
      page,
      limit,
    };
  }

  async listUnits(query: QueryPublicUnitsListDto) {
    const { page = 1, limit = 100, rentalModality } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      status: UnitStatus.ACTIVE,
      ...(rentalModality && { rentalModality }),
    };

    const [items, total] = await Promise.all([
      this.prisma.unit.findMany({
        where,
        skip,
        take: limit,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              cloudbedsWidgetPropertyId: true,
            },
          },
          unitImages: { where: { isPrimary: true }, include: { mediaFile: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.unit.count({ where }),
    ]);

    return {
      items: items.map(({ deletedAt: _d, ...safe }) => safe),
      total,
      page,
      limit,
    };
  }

  async findFlex(id: string) {
    const propertyFlex = await this.prisma.propertyFlex.findFirst({
      where: { id, deletedAt: null, status: PropertyStatus.ACTIVE },
      include: {
        address: true,
        amenities: { include: { amenity: true } },
        images: { include: { mediaFile: true }, orderBy: { sortOrder: 'asc' } },
        pricingPlans: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { minMonths: 'asc' }] },
      },
    });
    if (!propertyFlex) throw new NotFoundException('PropertyFlex not found');
    const { commissionRate: _commissionRate, deletedAt: _deletedAt, companyId: _companyId, ...safe } = propertyFlex;
    return safe;
  }

  async findProperty(id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, deletedAt: null, status: PropertyStatus.ACTIVE },
      include: {
        address: true,
        propertyAmenities: { include: { amenity: true } },
        propertyImages: { include: { mediaFile: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!property) throw new NotFoundException('Property not found');
    const { deletedAt: _deletedAt, companyId: _companyId, ...safe } = property;
    return safe;
  }

  async findUnit(id: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id, deletedAt: null, status: UnitStatus.ACTIVE },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            status: true,
            cloudbedsWidgetPropertyId: true,
            address: true,
          },
        },
        unitAmenities: { include: { amenity: true } },
        unitImages: { include: { mediaFile: true }, orderBy: { sortOrder: 'asc' } },
        pricingRules: { where: { isDefault: true }, take: 1 },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    const { deletedAt: _deletedAt, ...safe } = unit;
    return safe;
  }
}
