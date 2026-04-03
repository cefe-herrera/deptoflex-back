"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let UnitsService = class UnitsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto) {
        const property = await this.prisma.property.findFirst({ where: { id: dto.propertyId, deletedAt: null } });
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        return this.prisma.unit.create({ data: dto });
    }
    async findAll(page = 1, limit = 20, propertyId, status) {
        const skip = (page - 1) * limit;
        const where = {
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
    async findOne(id) {
        const unit = await this.prisma.unit.findFirst({
            where: { id, deletedAt: null },
            include: {
                property: { include: { address: true } },
                unitAmenities: { include: { amenity: true } },
                unitImages: { include: { mediaFile: true }, orderBy: { sortOrder: 'asc' } },
                pricingRules: { orderBy: { isDefault: 'desc' } },
            },
        });
        if (!unit)
            throw new common_1.NotFoundException('Unit not found');
        return unit;
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.unit.update({ where: { id }, data: dto });
    }
    async softDelete(id) {
        await this.findOne(id);
        await this.prisma.unit.update({ where: { id }, data: { deletedAt: new Date(), status: client_1.UnitStatus.INACTIVE } });
    }
    async getAvailability(unitId, from, to) {
        await this.findOne(unitId);
        const where = { unitId };
        if (from && to) {
            where.OR = [
                { startDate: { lte: new Date(to) }, endDate: { gte: new Date(from) } },
            ];
        }
        return this.prisma.unitAvailability.findMany({ where, orderBy: { startDate: 'asc' } });
    }
    async setAvailability(unitId, dto) {
        await this.findOne(unitId);
        const start = new Date(dto.startDate);
        const end = new Date(dto.endDate);
        if (start >= end)
            throw new common_1.BadRequestException('startDate must be before endDate');
        return this.prisma.unitAvailability.create({
            data: { unitId, startDate: start, endDate: end, isAvailable: dto.isAvailable, reason: dto.reason },
        });
    }
    async getRates(unitId) {
        await this.findOne(unitId);
        return this.prisma.pricingRule.findMany({ where: { unitId }, orderBy: { isDefault: 'desc' } });
    }
    async setRates(unitId, dto) {
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
    async addAmenity(unitId, amenityId) {
        await this.findOne(unitId);
        return this.prisma.unitAmenity.upsert({
            where: { unitId_amenityId: { unitId, amenityId } },
            create: { unitId, amenityId },
            update: {},
        });
    }
    async removeAmenity(unitId, amenityId) {
        await this.prisma.unitAmenity.delete({ where: { unitId_amenityId: { unitId, amenityId } } });
    }
};
exports.UnitsService = UnitsService;
exports.UnitsService = UnitsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UnitsService);
//# sourceMappingURL=units.service.js.map