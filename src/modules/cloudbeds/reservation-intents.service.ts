import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CloudbedsService } from './cloudbeds.service';
import { CreateReservationIntentDto } from './dto/create-reservation-intent.dto';
import {
  BOOKING_PROVIDER,
  type BookingProvider,
} from './providers/booking-provider.interface';

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
