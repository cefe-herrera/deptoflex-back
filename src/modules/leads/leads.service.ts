import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ConvertToBookingDto } from './dto/convert-to-booking.dto';
import { AddNoteDto } from './dto/add-note.dto';
import { LeadStatus, BookingStatus } from '@prisma/client';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLeadDto, professionalProfileId?: string) {
    return this.prisma.lead.create({
      data: {
        ...dto,
        checkInDate: dto.checkInDate ? new Date(dto.checkInDate) : null,
        checkOutDate: dto.checkOutDate ? new Date(dto.checkOutDate) : null,
        professionalProfileId,
      },
    });
  }

  async findAll(page = 1, limit = 20, userId?: string, roles?: string[]) {
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };

    const isAdmin = roles?.some((r) => ['ADMIN', 'OPERATOR'].includes(r));
    if (!isAdmin && userId) {
      const profile = await this.prisma.professionalProfile.findUnique({ where: { userId } });
      if (profile) where.professionalProfileId = profile.id;
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

  async findOne(id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        unit: { include: { property: { include: { address: true } } } },
        professionalProfile: true,
        leadRequests: { orderBy: { createdAt: 'asc' } },
        booking: { select: { id: true, status: true } },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto) {
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

  async addNote(leadId: string, dto: AddNoteDto, createdById: string) {
    await this.findOne(leadId);
    return this.prisma.leadRequest.create({ data: { leadId, createdById, message: dto.message } });
  }

  async convertToBooking(leadId: string, dto: ConvertToBookingDto, changedById: string) {
    const lead = await this.findOne(leadId);
    if (lead.booking) throw new BadRequestException('Lead already converted to booking');

    const checkIn = new Date(dto.checkInDate);
    const checkOut = new Date(dto.checkOutDate);
    const totalNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    if (totalNights <= 0) throw new BadRequestException('checkOutDate must be after checkInDate');

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
          status: BookingStatus.PENDING,
        },
      });

      await tx.bookingStatusHistory.create({
        data: { bookingId: booking.id, toStatus: BookingStatus.PENDING, changedById },
      });

      await tx.lead.update({
        where: { id: leadId },
        data: { status: LeadStatus.CONVERTED },
      });

      return booking;
    });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
