import { Injectable, NotFoundException } from '@nestjs/common';
import { PropertyStatus, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicCatalogService {
  constructor(private readonly prisma: PrismaService) {}

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
