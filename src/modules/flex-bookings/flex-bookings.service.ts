import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommissionRatesService } from '../commissions/commission-rates.service';
import { FlexPricingService } from '../property-flex/flex-pricing.service';
import { BookingsService } from '../bookings/bookings.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CreateFlexBookingDto } from './dto/create-flex-booking.dto';
import { UpdateFlexBookingDto } from './dto/update-flex-booking.dto';
import { QueryFlexBookingDto } from './dto/query-flex-booking.dto';
import { BookingSource, BookingStatus, CommissionStatus, FlexBookingStatus, FlexPricingPlanCode } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { FlexBookingPaymentsService } from '../payments/flex-booking-payments.service';

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
    private flexPricing: FlexPricingService,
    @Inject(forwardRef(() => BookingsService))
    private bookingsService: BookingsService,
    @Inject(forwardRef(() => FlexBookingPaymentsService))
    private flexBookingPayments: FlexBookingPaymentsService,
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

    const quote = await this.flexPricing.quote(dto.propertyFlexId, dto.totalMonths, dto.pricingPlanId);
    const monthlyAmount = quote.monthlyRent;
    const totalAmount = new Decimal(quote.totalAmount);
    const depositAmount = quote.depositAmount;
    const reservationPaymentAmount = quote.reservationPaymentAmount;
    const currency = quote.currency ?? dto.currency ?? 'ARS';

    if (Math.abs(Number(dto.monthlyAmount) - monthlyAmount) > 1
      || Math.abs(Number(dto.totalAmount) - quote.totalAmount) > 1) {
      throw new BadRequestException('Los montos no coinciden con el plan de precios vigente');
    }

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
      const paymentToken = reservationPaymentAmount > 0
        ? FlexBookingPaymentsService.generatePaymentToken()
        : null;

      const flexBooking = await tx.flexBooking.create({
        data: {
          propertyFlexId: dto.propertyFlexId,
          professionalProfileId,
          clientName: dto.clientName,
          clientEmail: dto.clientEmail,
          clientPhone: dto.clientPhone,
          startDate: start,
          endDate: end,
          totalMonths: dto.totalMonths,
          monthlyAmount: String(monthlyAmount),
          totalAmount: String(quote.totalAmount),
          depositAmount: String(depositAmount),
          pricingPlanId: quote.pricingPlanId,
          ...(quote.planCode && { planCode: quote.planCode as FlexPricingPlanCode }),
          entryCommissionAmount: String(quote.entryCommissionAmount),
          ...(reservationPaymentAmount > 0 && {
            reservationPaymentAmount: String(reservationPaymentAmount),
          }),
          paymentToken,
          currency,
          notes: dto.notes,
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

    if (reservationPaymentAmount > 0 && flexBooking.paymentToken && dto.clientEmail?.trim()) {
      this.flexBookingPayments.notifyGuestPaymentRequired({
        clientEmail: dto.clientEmail.trim(),
        clientName: dto.clientName,
        propertyName: flexBooking.propertyFlex.name,
        amount: reservationPaymentAmount,
        currency,
        paymentToken: flexBooking.paymentToken,
        startDate: start,
        endDate: end,
      }).catch((err) =>
        this.logger.error(`notifyGuestPaymentRequired failed for ${flexBooking.id}`, err),
      );
    }

    return flexBooking;
  }

  async confirmFromPayment(flexBookingId: string, mpPaymentId: string) {
    const existing = await this.prisma.flexBooking.findFirst({
      where: { id: flexBookingId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('FlexBooking not found');
    if (existing.status === FlexBookingStatus.CONFIRMED) return existing;
    if (existing.status === FlexBookingStatus.CANCELLED) {
      throw new BadRequestException('Cannot confirm a cancelled flex booking');
    }

    let confirmedBookingId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      await tx.flexBooking.update({
        where: { id: flexBookingId },
        data: { status: FlexBookingStatus.CONFIRMED },
      });

      const registry = await tx.booking.findUnique({ where: { flexBookingId } });
      if (!registry) return;

      if (registry.status !== BookingStatus.CONFIRMED) {
        await tx.booking.update({
          where: { id: registry.id },
          data: { status: BookingStatus.CONFIRMED },
        });
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: registry.id,
            fromStatus: registry.status,
            toStatus: BookingStatus.CONFIRMED,
            reason: `Mercado Pago payment approved (${mpPaymentId})`,
          },
        });
        confirmedBookingId = registry.id;
      }
    });

    if (confirmedBookingId) {
      this.notifications.notifyFlexReservationPaid(confirmedBookingId).catch((err) =>
        this.logger.error(`notifyFlexReservationPaid failed for ${confirmedBookingId}`, err),
      );
    }

    return this.findOne(flexBookingId);
  }

  async getPaymentLink(id: string, user: CurrentUserPayload) {
    return this.flexBookingPayments.getPaymentLinkForBooking(id, user);
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

  async update(id: string, dto: UpdateFlexBookingDto, changedById?: string) {
    const existing = await this.findOne(id);
    let confirmedBookingId: string | null = null;
    const isCancellation = dto.status === 'CANCELLED';

    const start = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const end = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    if (start >= end) throw new BadRequestException('startDate must be before endDate');

    if (dto.startDate || dto.endDate) {
      const conflict = await this.prisma.flexBooking.findFirst({
        where: {
          id: { not: id },
          propertyFlexId: existing.propertyFlexId,
          deletedAt: null,
          status: { notIn: ['CANCELLED'] },
          startDate: { lt: end },
          endDate: { gt: start },
        },
      });
      if (conflict) throw new BadRequestException('PropertyFlex is not available for the requested period');
    }

    const monthlyAmount = dto.monthlyAmount ?? Number(existing.monthlyAmount);
    const totalMonths = dto.totalMonths ?? existing.totalMonths;
    const totalAmount = dto.totalAmount ?? monthlyAmount * totalMonths;

    const flexData: Record<string, unknown> = {};
    if (dto.status && !isCancellation) flexData.status = dto.status;
    if (dto.notes !== undefined) flexData.notes = dto.notes;
    if (dto.clientName) flexData.clientName = dto.clientName;
    if (dto.clientEmail !== undefined) flexData.clientEmail = dto.clientEmail || null;
    if (dto.clientPhone !== undefined) flexData.clientPhone = dto.clientPhone || null;
    if (dto.startDate) flexData.startDate = start;
    if (dto.endDate) flexData.endDate = end;
    if (dto.totalMonths) flexData.totalMonths = totalMonths;
    if (dto.monthlyAmount != null) flexData.monthlyAmount = String(dto.monthlyAmount);
    if (dto.totalAmount != null || dto.monthlyAmount != null || dto.totalMonths) {
      flexData.totalAmount = String(totalAmount);
    }

    const totalNights = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.flexBooking.update({
        where: { id },
        data: flexData,
        include: { propertyFlex: { include: { address: true } } },
      });

      const registry = await tx.booking.findUnique({ where: { flexBookingId: id } });
      if (!registry) return result;

      const registryData: Record<string, unknown> = {};
      if (dto.clientName) registryData.clientName = dto.clientName;
      if (dto.clientEmail !== undefined) registryData.clientEmail = dto.clientEmail || null;
      if (dto.clientPhone !== undefined) registryData.clientPhone = dto.clientPhone || null;
      if (dto.notes !== undefined) registryData.notes = dto.notes || null;
      if (dto.startDate) registryData.checkInDate = start;
      if (dto.endDate) registryData.checkOutDate = end;
      if (dto.startDate || dto.endDate) registryData.totalNights = totalNights;
      if (dto.totalAmount != null || dto.monthlyAmount != null || dto.totalMonths) {
        const amount = new Decimal(totalAmount);
        registryData.baseAmount = amount;
        registryData.totalAmount = amount;
      }

      if (Object.keys(registryData).length > 0) {
        await tx.booking.update({ where: { id: registry.id }, data: registryData });
      }

      if (dto.totalAmount != null || dto.monthlyAmount != null || dto.totalMonths) {
        const rate = await this.commissionRates.resolveFlexRate(
          existing.propertyFlexId,
          registry.professionalProfileId,
          tx,
        );
        const amount = new Decimal(totalAmount);
        await tx.commission.updateMany({
          where: { bookingId: registry.id, status: CommissionStatus.PENDING },
          data: {
            rate,
            baseAmount: amount,
            commissionAmount: amount.mul(rate).div(100),
          },
        });
      }

      if (dto.status && !isCancellation) {
        const toStatus = FLEX_TO_BOOKING_STATUS[dto.status];
        if (registry.status !== toStatus) {
          await tx.booking.update({ where: { id: registry.id }, data: { status: toStatus } });
          await tx.bookingStatusHistory.create({
            data: {
              bookingId: registry.id,
              fromStatus: registry.status,
              toStatus,
              reason: 'Flex booking status update',
              changedById,
            },
          });
          if (dto.status === 'CONFIRMED') {
            confirmedBookingId = registry.id;
          }
        }
      }

      return result;
    });

    if (isCancellation) {
      const registry = await this.prisma.booking.findUnique({ where: { flexBookingId: id } });
      if (registry && registry.status !== BookingStatus.CANCELLED) {
        await this.bookingsService.executeCancellation(
          registry.id,
          dto.notes ?? 'Flex booking cancelled',
          changedById ?? 'system',
        );
      }
      return this.findOne(id);
    }

    if (confirmedBookingId) {
      this.notifications.notifyBookingConfirmed(confirmedBookingId).catch((err) =>
        this.logger.error(`notifyBookingConfirmed failed for ${confirmedBookingId}`, err),
      );
    }

    return updated;
  }

  async softDelete(id: string, changedById?: string) {
    await this.findOne(id);
    const registry = await this.prisma.booking.findUnique({ where: { flexBookingId: id } });
    if (registry && registry.status !== BookingStatus.CANCELLED) {
      await this.bookingsService.executeCancellation(
        registry.id,
        'Flex booking cancelled',
        changedById ?? 'system',
      );
    }
    await this.prisma.flexBooking.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    if (registry) {
      await this.prisma.booking.update({
        where: { id: registry.id },
        data: { deletedAt: new Date() },
      });
    }
  }
}
