import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CloudbedsService } from './cloudbeds.service';
import { CreateReservationIntentDto } from './dto/create-reservation-intent.dto';
import { ConfirmReservationDto } from './dto/confirm-reservation.dto';
import {
  BOOKING_PROVIDER,
  type BookingProvider,
} from './providers/booking-provider.interface';
import { BookingSource, BookingStatus, CommissionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface ReservationIntentResult {
  reservationIntentId: string;
  redirectUrl: string;
  expiresAt: Date;
  validatedTotalAmount: number | null;
  remaining: number;
}

@Injectable()
export class ReservationIntentsService {
  private readonly logger = new Logger(ReservationIntentsService.name);

  /** How long an intent stays valid before being marked EXPIRED. */
  private readonly intentTtlMs = Number(
    process.env.CLOUDBEDS_INTENT_TTL_MS ?? 30 * 60 * 1000, // 30 min
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudbeds: CloudbedsService,
    private readonly notifications: NotificationsService,
    @Inject(BOOKING_PROVIDER) private readonly provider: BookingProvider,
  ) {}

  async create(
    dto: CreateReservationIntentDto,
    context: { userId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<ReservationIntentResult> {
    const currencyCode = (dto.currencyCode ?? 'ARS').toUpperCase();
    const lang = (dto.lang ?? 'es').toLowerCase();

    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('Property not found');
    if (!property.cloudbedsWidgetPropertyId) {
      throw new BadRequestException('Property has no Cloudbeds widget_property mapping');
    }

    // Re-fetch availability so we redirect users with an up-to-date price/availability.
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
      throw new BadRequestException('Selected room type is no longer available');
    }
    if (room.remaining <= 0) {
      throw new BadRequestException('Selected room is sold out');
    }

    // If the caller passed an expected totalAmount, warn (but don't block) if it
    // diverges meaningfully from the fresh price. The frontend should re-fetch
    // and re-confirm if the divergence is too large.
    if (
      dto.totalAmount != null &&
      room.totalAmount != null &&
      Math.abs(room.totalAmount - dto.totalAmount) / Math.max(room.totalAmount, 1) > 0.05
    ) {
      this.logger.warn(
        `Price drift on intent: expected=${dto.totalAmount} fresh=${room.totalAmount} property=${property.id} roomType=${dto.roomTypeId}`,
      );
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
        professionalProfileId: dto.professionalProfileId ?? null,
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

  /**
   * Confirm a Cloudbeds reservation: fetch + parse the public confirmation page
   * and register a Booking (source=CLOUDBEDS, status=CONFIRMED) plus its
   * Commission in our system. Idempotent on the Cloudbeds reservation id.
   */
  async confirmFromCloudbeds(dto: ConfirmReservationDto) {
    const conf = await this.provider.getConfirmation({ dataRes: dto.dataRes });

    // Resolve the originating intent (canonical source for dates/property/ambassador).
    const intent = dto.reservationIntentId
      ? await this.prisma.reservationIntent.findUnique({ where: { id: dto.reservationIntentId } })
      : null;
    if (dto.reservationIntentId && !intent) {
      throw new NotFoundException('Reservation intent not found');
    }

    // Resolve the property: intent first, then the external id parsed from the page.
    let propertyId = intent?.propertyId ?? null;
    if (!propertyId && conf.propertyExternalId) {
      const prop = await this.prisma.property.findFirst({
        where: { cloudbedsWidgetPropertyId: conf.propertyExternalId, deletedAt: null },
      });
      propertyId = prop?.id ?? null;
    }
    if (!propertyId) {
      throw new BadRequestException(
        'Could not resolve the property for this confirmation (provide reservationIntentId)',
      );
    }

    // Idempotency: if we already registered this Cloudbeds reservation, return it.
    if (conf.reservationId) {
      const existing = await this.prisma.booking.findUnique({
        where: { cloudbedsReservationId: conf.reservationId },
      });
      if (existing) {
        this.logger.log(`Cloudbeds reservation ${conf.reservationId} already registered as booking ${existing.id}`);
        return existing;
      }
    }

    const professionalProfileId = dto.professionalProfileId ?? intent?.professionalProfileId ?? null;

    // Dates: prefer the intent (server-validated), fall back to the parsed page.
    const checkInStr = intent ? intent.checkin.toISOString().slice(0, 10) : conf.checkin;
    const checkOutStr = intent ? intent.checkout.toISOString().slice(0, 10) : conf.checkout;
    if (!checkInStr || !checkOutStr) {
      throw new BadRequestException('Could not resolve check-in/check-out dates for this reservation');
    }
    const checkIn = new Date(`${checkInStr}T00:00:00Z`);
    const checkOut = new Date(`${checkOutStr}T00:00:00Z`);
    const totalNights = Math.max(
      1,
      Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const totalAmount = new Decimal(
      conf.totalAmount ?? (intent?.totalAmount ? Number(intent.totalAmount) : 0),
    );
    const currency = (conf.currencyCode ?? intent?.currencyCode ?? 'ARS').toUpperCase();

    // Try to map the Cloudbeds room type to a local unit (optional).
    const roomTypeId = conf.roomTypeId ?? intent?.roomTypeId ?? null;
    let unitId: string | null = null;
    if (roomTypeId) {
      const unit = await this.prisma.unit.findFirst({
        where: { propertyId, cloudbedsRoomTypeId: roomTypeId, deletedAt: null },
      });
      unitId = unit?.id ?? null;
    }

    const clientName = conf.guestName ?? 'Cloudbeds Guest';

    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          source: BookingSource.CLOUDBEDS,
          status: BookingStatus.CONFIRMED,
          propertyId,
          unitId,
          reservationIntentId: intent?.id ?? null,
          cloudbedsReservationId: conf.reservationId,
          professionalProfileId,
          clientName,
          clientEmail: conf.guestEmail,
          clientPhone: conf.guestPhone,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults: intent?.adults ?? 1,
          children: intent?.children ?? 0,
          totalNights,
          baseAmount: totalAmount,
          totalAmount,
          currency,
        },
      });

      await tx.bookingStatusHistory.create({
        data: { bookingId: created.id, toStatus: BookingStatus.CONFIRMED, reason: 'Cloudbeds confirmation' },
      });

      await this.createCommission(tx, {
        bookingId: created.id,
        professionalProfileId,
        baseAmount: totalAmount,
        currency,
      });

      if (intent) {
        await tx.reservationIntent.update({ where: { id: intent.id }, data: { status: 'CONFIRMED' } });
      }

      return created;
    });

    this.logger.log(`Registered Cloudbeds booking ${booking.id} (reservation=${conf.reservationId ?? 'n/a'})`);

    this.notifications.notifyBookingConfirmed(booking.id).catch((err) =>
      this.logger.error(`notifyBookingConfirmed failed for ${booking.id}`, err),
    );

    return booking;
  }

  /** Create a Commission for a booking using the ambassador's default rate. */
  private async createCommission(
    tx: any,
    args: { bookingId: string; professionalProfileId: string | null; baseAmount: Decimal; currency: string },
  ): Promise<void> {
    let rate = new Decimal(0);
    if (args.professionalProfileId) {
      const profile = await tx.professionalProfile.findUnique({ where: { id: args.professionalProfileId } });
      if (profile) rate = profile.defaultCommissionRate;
    }
    const commissionAmount = args.baseAmount.mul(rate).div(100);
    await tx.commission.create({
      data: {
        bookingId: args.bookingId,
        professionalProfileId: args.professionalProfileId,
        rate,
        baseAmount: args.baseAmount,
        commissionAmount,
        currency: args.currency,
        status: CommissionStatus.PENDING,
      },
    });
  }

  /**
   * Mark an intent as REDIRECTED. Called from the redirect endpoint to track
   * the funnel (search → intent → click).
   */
  async markRedirected(id: string): Promise<void> {
    await this.prisma.reservationIntent.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REDIRECTED', redirectedAt: new Date() },
    });
  }

  async findOne(id: string) {
    const intent = await this.prisma.reservationIntent.findUnique({ where: { id } });
    if (!intent) throw new NotFoundException('Reservation intent not found');
    return intent;
  }

  /** Background job: mark stale PENDING intents as EXPIRED. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expirePendingIntents(): Promise<void> {
    try {
      const result = await this.prisma.reservationIntent.updateMany({
        where: { status: 'PENDING', expiresAt: { lt: new Date() } },
        data: { status: 'EXPIRED' },
      });
      if (result.count > 0) {
        this.logger.log(`Expired ${result.count} reservation intents`);
      }
    } catch (err) {
      this.logger.error(
        `Failed to expire intents: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
