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
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
let BookingsService = class BookingsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto, changedById) {
        const checkIn = new Date(dto.checkInDate);
        const checkOut = new Date(dto.checkOutDate);
        const totalNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        if (totalNights <= 0)
            throw new common_1.BadRequestException('checkOutDate must be after checkInDate');
        return this.prisma.$transaction(async (tx) => {
            const booking = await tx.booking.create({
                data: {
                    ...dto,
                    checkInDate: checkIn,
                    checkOutDate: checkOut,
                    totalNights,
                    currency: dto.currency ?? 'ARS',
                    status: client_1.BookingStatus.PENDING,
                },
            });
            await tx.bookingStatusHistory.create({
                data: { bookingId: booking.id, toStatus: client_1.BookingStatus.PENDING, changedById },
            });
            return booking;
        });
    }
    async findAll(page = 1, limit = 20, userId, roles) {
        const skip = (page - 1) * limit;
        const where = { deletedAt: null };
        const isAdmin = roles?.some((r) => ['ADMIN', 'OPERATOR'].includes(r));
        if (!isAdmin && userId) {
            const profile = await this.prisma.professionalProfile.findUnique({ where: { userId } });
            if (profile)
                where.professionalProfileId = profile.id;
        }
        const [items, total] = await Promise.all([
            this.prisma.booking.findMany({
                where,
                skip,
                take: limit,
                include: { unit: { select: { id: true, name: true } }, commission: { select: { status: true, commissionAmount: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.booking.count({ where }),
        ]);
        return { items, total, page, limit };
    }
    async findOne(id) {
        const booking = await this.prisma.booking.findFirst({
            where: { id, deletedAt: null },
            include: {
                unit: { include: { property: { include: { address: true } } } },
                professionalProfile: { include: { user: { select: { email: true } } } },
                statusHistory: { orderBy: { createdAt: 'asc' } },
                commission: true,
            },
        });
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        return booking;
    }
    async confirm(id, reason, changedById) {
        const booking = await this.findOne(id);
        if (booking.status !== client_1.BookingStatus.PENDING) {
            throw new common_1.BadRequestException('Only PENDING bookings can be confirmed');
        }
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.booking.update({
                where: { id },
                data: { status: client_1.BookingStatus.CONFIRMED },
            });
            await tx.bookingStatusHistory.create({
                data: { bookingId: id, fromStatus: client_1.BookingStatus.PENDING, toStatus: client_1.BookingStatus.CONFIRMED, reason, changedById },
            });
            await tx.unitAvailability.create({
                data: {
                    unitId: booking.unitId,
                    startDate: booking.checkInDate,
                    endDate: booking.checkOutDate,
                    isAvailable: false,
                    reason: 'BOOKED',
                    bookingId: id,
                },
            });
            let commissionRate = new library_1.Decimal(0);
            if (booking.professionalProfileId) {
                const profile = await tx.professionalProfile.findUnique({ where: { id: booking.professionalProfileId } });
                if (profile)
                    commissionRate = profile.defaultCommissionRate;
            }
            const commissionAmount = booking.totalAmount.mul(commissionRate).div(100);
            await tx.commission.create({
                data: {
                    bookingId: id,
                    professionalProfileId: booking.professionalProfileId,
                    rate: commissionRate,
                    baseAmount: booking.totalAmount,
                    commissionAmount,
                    currency: booking.currency,
                    status: client_1.CommissionStatus.PENDING,
                },
            });
            return updated;
        });
    }
    async cancel(id, reason, changedById) {
        const booking = await this.findOne(id);
        if (booking.status === client_1.BookingStatus.COMPLETED) {
            throw new common_1.BadRequestException('Cannot cancel a completed booking');
        }
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.booking.update({ where: { id }, data: { status: client_1.BookingStatus.CANCELLED } });
            await tx.bookingStatusHistory.create({
                data: { bookingId: id, fromStatus: booking.status, toStatus: client_1.BookingStatus.CANCELLED, reason, changedById },
            });
            await tx.unitAvailability.deleteMany({ where: { bookingId: id } });
            if (booking.commission) {
                await tx.commission.update({ where: { bookingId: id }, data: { status: client_1.CommissionStatus.CANCELLED } });
            }
            return updated;
        });
    }
    async complete(id, reason, changedById) {
        const booking = await this.findOne(id);
        if (booking.status !== client_1.BookingStatus.CONFIRMED) {
            throw new common_1.BadRequestException('Only CONFIRMED bookings can be completed');
        }
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.booking.update({ where: { id }, data: { status: client_1.BookingStatus.COMPLETED } });
            await tx.bookingStatusHistory.create({
                data: { bookingId: id, fromStatus: client_1.BookingStatus.CONFIRMED, toStatus: client_1.BookingStatus.COMPLETED, reason, changedById },
            });
            return updated;
        });
    }
    async getStatusHistory(id) {
        await this.findOne(id);
        return this.prisma.bookingStatusHistory.findMany({
            where: { bookingId: id },
            include: { changedBy: { select: { email: true } } },
            orderBy: { createdAt: 'asc' },
        });
    }
    async softDelete(id) {
        await this.findOne(id);
        await this.prisma.booking.update({ where: { id }, data: { deletedAt: new Date() } });
    }
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map