import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommissionRatesService } from '../commissions/commission-rates.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CreateFlexBookingDto } from './dto/create-flex-booking.dto';
import { UpdateFlexBookingDto } from './dto/update-flex-booking.dto';
import { QueryFlexBookingDto } from './dto/query-flex-booking.dto';
import { BookingSource, BookingStatus, CommissionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const FLEX_TO_BOOKING_STATUS: Record<string, BookingStatus> = {
  PENDING: BookingStatus.PENDING,
  CONFIRMED: BookingStatus.CONFIRMED,
  CANCELLED: BookingStatus.CANCELLED,
  COMPLETED: BookingStatus.COMPLETED,
};

@Injectable()
export class FlexBookingsService {
  private readonly logger = new Logger(FlexBookingsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private commissionRates: CommissionRatesService,
  ) {}

  async create(dto: CreateFlexBookingDto, user?: CurrentUserPayload) {
    const propertyFlex = await this.prisma.propertyFlex.findFirst({
      where: { id: dto.propertyFlexId, deletedAt: null },
    });
    if (!propertyFlex) throw new NotFoundException('PropertyFlex not found');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start >= end) throw new BadRequestException('startDate must be before endDate');

    const conflict = await this.prisma.flexBooking.findFirst({
      where: {
        propertyFlexId: dto.propertyFlexId,
        deletedAt: null,
        status: { notIn: ['CANCELLED'] },
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });
    if (conflict) throw new BadRequestException('PropertyFlex is not available for the requested period');

    const totalNights = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const totalAmount = new Decimal(dto.totalAmount);
    const currency = dto.currency ?? 'ARS';

    const isStaff = user?.roles?.some((r) => ['ADMIN', 'OPERATOR'].includes(r));
    let professionalProfileId = dto.professionalProfileId ?? null;

    if (!isStaff) {
      if (!user) throw new ForbiddenException('Authentication required');
      const profile = await this.prisma.professionalProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!profile) {
        throw new ForbiddenException('Necesitás un perfil profesional para crear reservas flex');
      }
      professionalProfileId = profile.id;
    }

    // A flex reservation is fully managed in-app: we create the FlexBooking
    // (operational detail) AND register it in the unified Booking registry
    // with its Commission, in a single transaction.
    const { flexBooking, bookingId } = await this.prisma.$transaction(async (tx) => {
      const flexBooking = await tx.flexBooking.create({
        data: {
          ...dto,
          professionalProfileId,
          startDate: start,
          endDate: end,
          monthlyAmount: String(dto.monthlyAmount),
          totalAmount: String(dto.totalAmount),
          ...(dto.depositAmount != null && { depositAmount: String(dto.depositAmount) }),
        },
        include: { propertyFlex: { include: { address: true } } },
      });

      const booking = await tx.booking.create({
        data: {
          source: BookingSource.FLEX,
          status: BookingStatus.PENDING,
          propertyFlexId: dto.propertyFlexId,
          flexBookingId: flexBooking.id,
          professionalProfileId,
          clientName: dto.clientName,
          clientEmail: dto.clientEmail,
          clientPhone: dto.clientPhone,
          checkInDate: start,
          checkOutDate: end,
          totalNights,
          baseAmount: totalAmount,
          totalAmount,
          currency,
          notes: dto.notes,
        },
      });

      await tx.bookingStatusHistory.create({
        data: { bookingId: booking.id, toStatus: BookingStatus.PENDING, reason: 'Flex booking created' },
      });

      const rate = await this.commissionRates.resolveFlexRate(
        dto.propertyFlexId,
        professionalProfileId,
        tx,
      );
      await tx.commission.create({
        data: {
          bookingId: booking.id,
          professionalProfileId,
          rate,
          baseAmount: totalAmount,
          commissionAmount: totalAmount.mul(rate).div(100),
          currency,
          status: CommissionStatus.PENDING,
        },
      });

      return { flexBooking, bookingId: booking.id };
    });

    this.notifications.notifyBookingCreated(bookingId).catch((err) =>
      this.logger.error(`notifyBookingCreated failed for ${bookingId}`, err),
    );

    return flexBooking;
  }

  async findAll(query: QueryFlexBookingDto) {
    const { page = 1, limit = 20, propertyFlexId, professionalProfileId, status, startDateFrom, startDateTo } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(propertyFlexId && { propertyFlexId }),
      ...(professionalProfileId && { professionalProfileId }),
      ...(status && { status }),
      ...(startDateFrom && { startDate: { gte: new Date(startDateFrom) } }),
      ...(startDateTo && { startDate: { lte: new Date(startDateTo) } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.flexBooking.findMany({
        where,
        skip,
        take: limit,
        include: {
          propertyFlex: { include: { address: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.flexBooking.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const booking = await this.prisma.flexBooking.findFirst({
      where: { id, deletedAt: null },
      include: {
        propertyFlex: { include: { address: true, images: { where: { isPrimary: true }, include: { mediaFile: true }, take: 1 } } },
      },
    });
    if (!booking) throw new NotFoundException('FlexBooking not found');
    return booking;
  }

  async update(id: string, dto: UpdateFlexBookingDto) {
    await this.findOne(id);
    let confirmedBookingId: string | null = null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.flexBooking.update({
        where: { id },
        data: dto,
        include: { propertyFlex: { include: { address: true } } },
      });

      // Keep the unified Booking registry in sync with the flex status.
      if (dto.status) {
        const registry = await tx.booking.findUnique({ where: { flexBookingId: id } });
        if (registry && registry.status !== FLEX_TO_BOOKING_STATUS[dto.status]) {
          const toStatus = FLEX_TO_BOOKING_STATUS[dto.status];
          await tx.booking.update({ where: { id: registry.id }, data: { status: toStatus } });
          await tx.bookingStatusHistory.create({
            data: { bookingId: registry.id, fromStatus: registry.status, toStatus, reason: 'Flex booking status update' },
          });
          if (dto.status === 'CANCELLED') {
            await tx.commission.updateMany({ where: { bookingId: registry.id }, data: { status: CommissionStatus.CANCELLED } });
          }
          if (dto.status === 'CONFIRMED') {
            confirmedBookingId = registry.id;
          }
        }
      }

      return result;
    });

    if (confirmedBookingId) {
      this.notifications.notifyBookingConfirmed(confirmedBookingId).catch((err) =>
        this.logger.error(`notifyBookingConfirmed failed for ${confirmedBookingId}`, err),
      );
    }

    return updated;
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.flexBooking.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'CANCELLED' },
      });

      const registry = await tx.booking.findUnique({ where: { flexBookingId: id } });
      if (registry) {
        await tx.booking.update({
          where: { id: registry.id },
          data: { status: BookingStatus.CANCELLED, deletedAt: new Date() },
        });
        await tx.bookingStatusHistory.create({
          data: { bookingId: registry.id, fromStatus: registry.status, toStatus: BookingStatus.CANCELLED, reason: 'Flex booking cancelled' },
        });
        await tx.commission.updateMany({ where: { bookingId: registry.id }, data: { status: CommissionStatus.CANCELLED } });
      }
    });
  }
}
