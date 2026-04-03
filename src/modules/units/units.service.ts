import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { SetPricingRulesDto } from './dto/set-pricing-rules.dto';
import { UnitStatus } from '@prisma/client';

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUnitDto) {
    const property = await this.prisma.property.findFirst({ where: { id: dto.propertyId, deletedAt: null } });
    if (!property) throw new NotFoundException('Property not found');
    return this.prisma.unit.create({ data: dto });
  }

  async findAll(page = 1, limit = 20, propertyId?: string, status?: UnitStatus) {
    const skip = (page - 1) * limit;
    const where: any = {
      deletedAt: null,
      ...(propertyId && { propertyId }),
      ...(status && { status }),
    };
    const [items, total] = await Promise.all([
      this.prisma.unit.findMany({
        where,
        skip,
        take: limit,
        include: {
          property: { select: { id: true, name: true } },
          unitImages: { where: { isPrimary: true }, include: { mediaFile: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.unit.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id, deletedAt: null },
      include: {
        property: { include: { address: true } },
        unitAmenities: { include: { amenity: true } },
        unitImages: { include: { mediaFile: true }, orderBy: { sortOrder: 'asc' } },
        pricingRules: { orderBy: { isDefault: 'desc' } },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async update(id: string, dto: UpdateUnitDto) {
    await this.findOne(id);
    return this.prisma.unit.update({ where: { id }, data: dto });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.unit.update({ where: { id }, data: { deletedAt: new Date(), status: UnitStatus.INACTIVE } });
  }

  async getAvailability(unitId: string, from?: string, to?: string) {
    await this.findOne(unitId);
    const where: any = { unitId };
    if (from && to) {
      where.OR = [
        { startDate: { lte: new Date(to) }, endDate: { gte: new Date(from) } },
      ];
    }
    return this.prisma.unitAvailability.findMany({ where, orderBy: { startDate: 'asc' } });
  }

  async setAvailability(unitId: string, dto: SetAvailabilityDto) {
    await this.findOne(unitId);
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start >= end) throw new BadRequestException('startDate must be before endDate');

    return this.prisma.unitAvailability.create({
      data: { unitId, startDate: start, endDate: end, isAvailable: dto.isAvailable, reason: dto.reason },
    });
  }

  async getRates(unitId: string) {
    await this.findOne(unitId);
    return this.prisma.pricingRule.findMany({ where: { unitId }, orderBy: { isDefault: 'desc' } });
  }

  async setRates(unitId: string, dto: SetPricingRulesDto) {
    await this.findOne(unitId);
    return this.prisma.$transaction(async (tx) => {
      await tx.pricingRule.deleteMany({ where: { unitId } });
      return tx.pricingRule.createMany({
        data: dto.rules.map((r) => ({
          unitId,
          ...r,
          startDate: r.startDate ? new Date(r.startDate) : null,
          endDate: r.endDate ? new Date(r.endDate) : null,
        })),
      });
    });
  }

  async addAmenity(unitId: string, amenityId: string) {
    await this.findOne(unitId);
    return this.prisma.unitAmenity.upsert({
      where: { unitId_amenityId: { unitId, amenityId } },
      create: { unitId, amenityId },
      update: {},
    });
  }

  async removeAmenity(unitId: string, amenityId: string) {
    await this.prisma.unitAmenity.delete({ where: { unitId_amenityId: { unitId, amenityId } } });
  }
}
