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
exports.LeadsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let LeadsService = class LeadsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto, professionalProfileId) {
        return this.prisma.lead.create({
            data: {
                ...dto,
                checkInDate: dto.checkInDate ? new Date(dto.checkInDate) : null,
                checkOutDate: dto.checkOutDate ? new Date(dto.checkOutDate) : null,
                professionalProfileId,
            },
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
            this.prisma.lead.findMany({
                where,
                skip,
                take: limit,
                include: { unit: { select: { id: true, name: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.lead.count({ where }),
        ]);
        return { items, total, page, limit };
    }
    async findOne(id) {
        const lead = await this.prisma.lead.findFirst({
            where: { id, deletedAt: null },
            include: {
                unit: { include: { property: { include: { address: true } } } },
                professionalProfile: true,
                leadRequests: { orderBy: { createdAt: 'asc' } },
                booking: { select: { id: true, status: true } },
            },
        });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        return lead;
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.lead.update({
            where: { id },
            data: {
                ...dto,
                checkInDate: dto.checkInDate ? new Date(dto.checkInDate) : undefined,
                checkOutDate: dto.checkOutDate ? new Date(dto.checkOutDate) : undefined,
            },
        });
    }
    async addNote(leadId, dto, createdById) {
        await this.findOne(leadId);
        return this.prisma.leadRequest.create({ data: { leadId, createdById, message: dto.message } });
    }
    async convertToBooking(leadId, dto, changedById) {
        const lead = await this.findOne(leadId);
        if (lead.booking)
            throw new common_1.BadRequestException('Lead already converted to booking');
        const checkIn = new Date(dto.checkInDate);
        const checkOut = new Date(dto.checkOutDate);
        const totalNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        if (totalNights <= 0)
            throw new common_1.BadRequestException('checkOutDate must be after checkInDate');
        return this.prisma.$transaction(async (tx) => {
            const booking = await tx.booking.create({
                data: {
                    leadId,
                    unitId: dto.unitId,
                    professionalProfileId: lead.professionalProfileId,
                    clientName: lead.clientName,
                    clientEmail: lead.clientEmail,
                    clientPhone: lead.clientPhone,
                    checkInDate: checkIn,
                    checkOutDate: checkOut,
                    adults: lead.adults,
                    children: lead.children,
                    totalNights,
                    baseAmount: dto.baseAmount,
                    totalAmount: dto.totalAmount,
                    currency: dto.currency ?? 'ARS',
                    notes: dto.notes,
                    status: client_1.BookingStatus.PENDING,
                },
            });
            await tx.bookingStatusHistory.create({
                data: { bookingId: booking.id, toStatus: client_1.BookingStatus.PENDING, changedById },
            });
            await tx.lead.update({
                where: { id: leadId },
                data: { status: client_1.LeadStatus.CONVERTED },
            });
            return booking;
        });
    }
    async softDelete(id) {
        await this.findOne(id);
        await this.prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
    }
};
exports.LeadsService = LeadsService;
exports.LeadsService = LeadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LeadsService);
//# sourceMappingURL=leads.service.js.map