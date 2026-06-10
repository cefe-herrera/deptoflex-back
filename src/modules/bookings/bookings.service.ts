import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingSource, BookingStatus, CommissionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

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

  async findAll(
    page = 1,
    limit = 20,
    userId?: string,
    roles?: string[],
    options?: { excludeSource?: BookingSource },
  ) {
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };

    const isStaff = roles?.some((r) => ['ADMIN', 'OPERATOR'].includes(r));
    if (!isStaff && userId) {
      const profile = await this.prisma.professionalProfile.findUnique({ where: { userId } });
      if (profile) where.professionalProfileId = profile.id;
    }

    if (options?.excludeSource) {
      where.source = { not: options.excludeSource };
    }

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          unit: { select: { id: true, name: true } },
          property: { select: { id: true, name: true } },
          propertyFlex: { select: { id: true, name: true } },
          professionalProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              user: { select: { email: true } },
            },
          },
          commission: { select: { status: true, commissionAmount: true } },
        },
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

      if (booking.unitId) {
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
      }

      const existingCommission = await tx.commission.findUnique({ where: { bookingId: id } });
      if (!existingCommission && booking.professionalProfileId) {
        let commissionRate = new Decimal(0);
        const profile = await tx.professionalProfile.findUnique({ where: { id: booking.professionalProfileId } });
        if (profile) commissionRate = profile.defaultCommissionRate;

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
      }

      return updated;
    }).then((updated) => {
      this.notifications.notifyBookingConfirmed(id).catch((err) =>
        this.logger.error(`notifyBookingConfirmed failed for ${id}`, err),
      );
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

  async update(id: string, dto: UpdateBookingDto) {
    const booking = await this.findOne(id);
    if (booking.source === BookingSource.FLEX || booking.flexBookingId) {
      throw new BadRequestException('Las reservas Flex se gestionan desde /flex-bookings');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('No se puede editar una reserva cancelada');
    }

    const checkIn = dto.checkInDate ? new Date(dto.checkInDate) : booking.checkInDate;
    const checkOut = dto.checkOutDate ? new Date(dto.checkOutDate) : booking.checkOutDate;
    if (checkIn >= checkOut) {
      throw new BadRequestException('checkOutDate must be after checkInDate');
    }

    const totalNights = Math.max(
      1,
      Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return this.prisma.booking.update({
      where: { id },
      data: {
        ...(dto.clientName != null && { clientName: dto.clientName }),
        ...(dto.clientEmail !== undefined && { clientEmail: dto.clientEmail || null }),
        ...(dto.clientPhone !== undefined && { clientPhone: dto.clientPhone || null }),
        ...(dto.notes !== undefined && { notes: dto.notes || null }),
        ...(dto.checkInDate && { checkInDate: checkIn }),
        ...(dto.checkOutDate && { checkOutDate: checkOut }),
        ...((dto.checkInDate || dto.checkOutDate) && { totalNights }),
      },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
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
