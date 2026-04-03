import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingStatus, CommissionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBookingDto, changedById: string) {
    const checkIn = new Date(dto.checkInDate);
    const checkOut = new Date(dto.checkOutDate);
    const totalNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    if (totalNights <= 0) throw new BadRequestException('checkOutDate must be after checkInDate');

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          ...dto,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          totalNights,
          currency: dto.currency ?? 'ARS',
          status: BookingStatus.PENDING,
        },
      });

      await tx.bookingStatusHistory.create({
        data: { bookingId: booking.id, toStatus: BookingStatus.PENDING, changedById },
      });

      return booking;
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

  async findOne(id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: {
        unit: { include: { property: { include: { address: true } } } },
        professionalProfile: { include: { user: { select: { email: true } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        commission: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async confirm(id: string, reason: string | undefined, changedById: string) {
    const booking = await this.findOne(id);
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Only PENDING bookings can be confirmed');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CONFIRMED },
      });

      await tx.bookingStatusHistory.create({
        data: { bookingId: id, fromStatus: BookingStatus.PENDING, toStatus: BookingStatus.CONFIRMED, reason, changedById },
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

      let commissionRate = new Decimal(0);
      if (booking.professionalProfileId) {
        const profile = await tx.professionalProfile.findUnique({ where: { id: booking.professionalProfileId } });
        if (profile) commissionRate = profile.defaultCommissionRate;
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
          status: CommissionStatus.PENDING,
        },
      });

      return updated;
    });
  }

  async cancel(id: string, reason: string, changedById: string) {
    const booking = await this.findOne(id);
    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({ where: { id }, data: { status: BookingStatus.CANCELLED } });

      await tx.bookingStatusHistory.create({
        data: { bookingId: id, fromStatus: booking.status, toStatus: BookingStatus.CANCELLED, reason, changedById },
      });

      await tx.unitAvailability.deleteMany({ where: { bookingId: id } });

      if (booking.commission) {
        await tx.commission.update({ where: { bookingId: id }, data: { status: CommissionStatus.CANCELLED } });
      }

      return updated;
    });
  }

  async complete(id: string, reason: string | undefined, changedById: string) {
    const booking = await this.findOne(id);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Only CONFIRMED bookings can be completed');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({ where: { id }, data: { status: BookingStatus.COMPLETED } });

      await tx.bookingStatusHistory.create({
        data: { bookingId: id, fromStatus: BookingStatus.CONFIRMED, toStatus: BookingStatus.COMPLETED, reason, changedById },
      });

      return updated;
    });
  }

  async getStatusHistory(id: string) {
    await this.findOne(id);
    return this.prisma.bookingStatusHistory.findMany({
      where: { bookingId: id },
      include: { changedBy: { select: { email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.booking.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
