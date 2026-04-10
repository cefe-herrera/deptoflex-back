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
exports.PropertiesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let PropertiesService = class PropertiesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto) {
        const { address, ...rest } = dto;
        return this.prisma.property.create({
            data: {
                ...rest,
                ...(address && { address: { create: address } }),
            },
            include: { address: true },
        });
    }
    async findAll(query) {
        const { page = 1, limit = 20, companyId, status, type, city } = query;
        const skip = (page - 1) * limit;
        const where = {
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
    async findOne(id) {
        const property = await this.prisma.property.findFirst({
            where: { id, deletedAt: null },
            include: {
                address: true,
                propertyAmenities: { include: { amenity: true } },
                propertyImages: { include: { mediaFile: true }, orderBy: { sortOrder: 'asc' } },
                _count: { select: { units: true } },
            },
        });
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        return property;
    }
    async update(id, dto) {
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
    async softDelete(id) {
        await this.findOne(id);
        await this.prisma.property.update({ where: { id }, data: { deletedAt: new Date(), status: client_1.PropertyStatus.INACTIVE } });
    }
    async addAmenity(propertyId, amenityId) {
        await this.findOne(propertyId);
        return this.prisma.propertyAmenity.upsert({
            where: { propertyId_amenityId: { propertyId, amenityId } },
            create: { propertyId, amenityId },
            update: {},
        });
    }
    async removeAmenity(propertyId, amenityId) {
        await this.prisma.propertyAmenity.delete({
            where: { propertyId_amenityId: { propertyId, amenityId } },
        });
    }
};
exports.PropertiesService = PropertiesService;
exports.PropertiesService = PropertiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PropertiesService);
//# sourceMappingURL=properties.service.js.map