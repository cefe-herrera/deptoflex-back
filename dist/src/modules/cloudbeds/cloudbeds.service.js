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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CloudbedsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudbedsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const availability_snapshots_service_1 = require("./availability-snapshots.service");
const booking_provider_interface_1 = require("./providers/booking-provider.interface");
let CloudbedsService = CloudbedsService_1 = class CloudbedsService {
    prisma;
    snapshots;
    provider;
    logger = new common_1.Logger(CloudbedsService_1.name);
    constructor(prisma, snapshots, provider) {
        this.prisma = prisma;
        this.snapshots = snapshots;
        this.provider = provider;
    }
    async searchAvailability(dto) {
        const currencyCode = (dto.currencyCode ?? 'ARS').toUpperCase();
        const lang = (dto.lang ?? 'es').toLowerCase();
        this.assertDatesValid(dto.checkin, dto.checkout);
        const property = await this.prisma.property.findFirst({
            where: { cloudbedsWidgetPropertyId: dto.propertyId, deletedAt: null },
        });
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        if (!property.cloudbedsWidgetPropertyId) {
            throw new common_1.BadRequestException('Property has no Cloudbeds widget_property mapping');
        }
        this.logger.log(`Searching availability for property ${property.id}`);
        const result = await this.provider.searchAvailability({
            propertyExternalId: property.cloudbedsWidgetPropertyId,
            checkin: dto.checkin,
            checkout: dto.checkout,
            currencyCode,
            lang,
            adults: dto.adults,
            children: dto.children,
        });
        this.logger.log(`Availability result: ${JSON.stringify(result)}`);
        void this.snapshots.record({
            propertyId: property.id,
            checkin: dto.checkin,
            checkout: dto.checkout,
            currencyCode,
            lang,
            result,
        });
        this.logger.log(`Snapshot recorded for property ${property.id}`);
        const enrichedRooms = await this.enrichWithLocalUnits(property.id, result.rooms);
        this.logger.log(`Enriched rooms: ${JSON.stringify(enrichedRooms)}`);
        return {
            propertyId: property.id,
            propertyName: property.name,
            propertyExternalId: result.propertyExternalId,
            checkin: dto.checkin,
            checkout: dto.checkout,
            currencyCode,
            lang,
            totalAvailable: result.totalAvailable,
            rooms: enrichedRooms,
            meta: result.meta,
        };
    }
    async calculateTotals(dto) {
        const currencyCode = (dto.currencyCode ?? 'ARS').toUpperCase();
        const lang = (dto.lang ?? 'es').toLowerCase();
        this.assertDatesValid(dto.checkin, dto.checkout);
        const property = await this.prisma.property.findFirst({
            where: { cloudbedsWidgetPropertyId: dto.propertyId, deletedAt: null },
        });
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        if (!property.cloudbedsWidgetPropertyId) {
            throw new common_1.BadRequestException('Property has no Cloudbeds widget_property mapping');
        }
        this.logger.log(`Calculating totals for property ${property.id}`);
        return this.provider.calculateTotals({
            propertyExternalId: property.cloudbedsWidgetPropertyId,
            checkin: dto.checkin,
            checkout: dto.checkout,
            currencyCode,
            lang,
            rates: dto.rates.map((r) => ({
                rateId: r.rateId,
                adults: r.adults,
                kids: r.kids ?? 0,
            })),
        });
    }
    async enrichWithLocalUnits(propertyId, rooms) {
        const reservableRooms = rooms.filter((r) => r.remaining > 0);
        const roomTypeIds = reservableRooms.map((r) => r.roomTypeId);
        if (roomTypeIds.length === 0)
            return [];
        const localUnits = await this.prisma.unit.findMany({
            where: {
                propertyId,
                deletedAt: null,
                cloudbedsRoomTypeId: { in: roomTypeIds },
            },
            select: {
                id: true,
                name: true,
                description: true,
                bedrooms: true,
                bathrooms: true,
                maxOccupancy: true,
                cloudbedsRoomTypeId: true,
            },
        });
        const byRoomType = new Map();
        for (const u of localUnits) {
            if (!u.cloudbedsRoomTypeId)
                continue;
            const list = byRoomType.get(u.cloudbedsRoomTypeId) ?? [];
            list.push(u);
            byRoomType.set(u.cloudbedsRoomTypeId, list);
        }
        return reservableRooms.map((r) => ({
            ...r,
            localUnits: (byRoomType.get(r.roomTypeId) ?? []).map((u) => ({
                id: u.id,
                name: u.name,
                description: u.description,
                bedrooms: u.bedrooms,
                bathrooms: u.bathrooms,
                maxOccupancy: u.maxOccupancy,
            })),
        }));
    }
    assertDatesValid(checkin, checkout) {
        const ci = new Date(`${checkin}T00:00:00Z`);
        const co = new Date(`${checkout}T00:00:00Z`);
        if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime())) {
            throw new common_1.BadRequestException('Invalid checkin/checkout date');
        }
        if (co.getTime() <= ci.getTime()) {
            throw new common_1.BadRequestException('checkout must be after checkin');
        }
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        if (ci.getTime() < today.getTime()) {
            throw new common_1.BadRequestException('checkin cannot be in the past');
        }
    }
};
exports.CloudbedsService = CloudbedsService;
exports.CloudbedsService = CloudbedsService = CloudbedsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(booking_provider_interface_1.BOOKING_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        availability_snapshots_service_1.AvailabilitySnapshotsService, Object])
], CloudbedsService);
//# sourceMappingURL=cloudbeds.service.js.map