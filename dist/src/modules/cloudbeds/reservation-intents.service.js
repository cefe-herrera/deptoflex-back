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
var ReservationIntentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationIntentsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const cloudbeds_service_1 = require("./cloudbeds.service");
const booking_provider_interface_1 = require("./providers/booking-provider.interface");
let ReservationIntentsService = ReservationIntentsService_1 = class ReservationIntentsService {
    prisma;
    cloudbeds;
    provider;
    logger = new common_1.Logger(ReservationIntentsService_1.name);
    intentTtlMs = Number(process.env.CLOUDBEDS_INTENT_TTL_MS ?? 30 * 60 * 1000);
    constructor(prisma, cloudbeds, provider) {
        this.prisma = prisma;
        this.cloudbeds = cloudbeds;
        this.provider = provider;
    }
    async create(dto, context) {
        const currencyCode = (dto.currencyCode ?? 'ARS').toUpperCase();
        const lang = (dto.lang ?? 'es').toLowerCase();
        const property = await this.prisma.property.findFirst({
            where: { id: dto.propertyId, deletedAt: null },
        });
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        if (!property.cloudbedsWidgetPropertyId) {
            throw new common_1.BadRequestException('Property has no Cloudbeds widget_property mapping');
        }
        const fresh = await this.cloudbeds.searchAvailability({
            propertyId: property.cloudbedsWidgetPropertyId,
            checkin: dto.checkin,
            checkout: dto.checkout,
            currencyCode,
            lang,
            adults: dto.adults,
            children: dto.children,
        });
        const room = fresh.rooms.find((r) => r.roomTypeId === dto.roomTypeId);
        if (!room) {
            throw new common_1.BadRequestException('Selected room type is no longer available');
        }
        if (room.remaining <= 0) {
            throw new common_1.BadRequestException('Selected room is sold out');
        }
        if (dto.totalAmount != null &&
            room.totalAmount != null &&
            Math.abs(room.totalAmount - dto.totalAmount) / Math.max(room.totalAmount, 1) > 0.05) {
            this.logger.warn(`Price drift on intent: expected=${dto.totalAmount} fresh=${room.totalAmount} property=${property.id} roomType=${dto.roomTypeId}`);
        }
        const redirectUrl = this.provider.buildReservationRedirectUrl({
            propertyExternalId: property.cloudbedsWidgetPropertyId,
            bookingSlug: property.cloudbedsBookingSlug,
            checkin: dto.checkin,
            checkout: dto.checkout,
            currencyCode,
            lang,
            roomTypeId: dto.roomTypeId,
            rateId: dto.rateId ?? room.rateId ?? null,
            adults: dto.adults,
            children: dto.children,
        });
        const expiresAt = new Date(Date.now() + this.intentTtlMs);
        const created = await this.prisma.reservationIntent.create({
            data: {
                propertyId: property.id,
                roomTypeId: dto.roomTypeId,
                rateId: dto.rateId ?? room.rateId ?? null,
                checkin: new Date(dto.checkin),
                checkout: new Date(dto.checkout),
                adults: dto.adults ?? 1,
                children: dto.children ?? 0,
                totalAmount: room.totalAmount ?? null,
                currencyCode,
                redirectUrl,
                status: 'PENDING',
                userId: context.userId ?? null,
                ipAddress: context.ipAddress ?? null,
                userAgent: context.userAgent ?? null,
                expiresAt,
            },
        });
        return {
            reservationIntentId: created.id,
            redirectUrl,
            expiresAt,
            validatedTotalAmount: room.totalAmount,
            remaining: room.remaining,
        };
    }
    async markRedirected(id) {
        await this.prisma.reservationIntent.updateMany({
            where: { id, status: 'PENDING' },
            data: { status: 'REDIRECTED', redirectedAt: new Date() },
        });
    }
    async findOne(id) {
        const intent = await this.prisma.reservationIntent.findUnique({ where: { id } });
        if (!intent)
            throw new common_1.NotFoundException('Reservation intent not found');
        return intent;
    }
    async expirePendingIntents() {
        try {
            const result = await this.prisma.reservationIntent.updateMany({
                where: { status: 'PENDING', expiresAt: { lt: new Date() } },
                data: { status: 'EXPIRED' },
            });
            if (result.count > 0) {
                this.logger.log(`Expired ${result.count} reservation intents`);
            }
        }
        catch (err) {
            this.logger.error(`Failed to expire intents: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
};
exports.ReservationIntentsService = ReservationIntentsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_10_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReservationIntentsService.prototype, "expirePendingIntents", null);
exports.ReservationIntentsService = ReservationIntentsService = ReservationIntentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(booking_provider_interface_1.BOOKING_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cloudbeds_service_1.CloudbedsService, Object])
], ReservationIntentsService);
//# sourceMappingURL=reservation-intents.service.js.map