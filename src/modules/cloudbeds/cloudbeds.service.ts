import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilitySnapshotsService } from './availability-snapshots.service';
import { SearchAvailabilityDto } from './dto/search-availability.dto';
import {
  BOOKING_PROVIDER,
  type AvailabilityResult,
  type AvailableRoom,
  type BookingProvider,
  type CalculateTotalsResult,
} from './providers/booking-provider.interface';
import { CalculateTotalsDto } from './dto/calculate-totals.dto';

export interface EnrichedRoom extends AvailableRoom {
  /** Local Units that match this Cloudbeds room_type. */
  localUnits: Array<{
    id: string;
    name: string;
    description: string | null;
    bedrooms: number;
    bathrooms: number;
    maxOccupancy: number;
  }>;
}

export interface EnrichedAvailabilityResult {
  propertyId: string;
  propertyName: string;
  propertyExternalId: string;
  checkin: string;
  checkout: string;
  currencyCode: string;
  lang: string;
  totalAvailable: number;
  rooms: EnrichedRoom[];
  meta?: Record<string, unknown>;
}

@Injectable()
export class CloudbedsService {
  private readonly logger = new Logger(CloudbedsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: AvailabilitySnapshotsService,
    @Inject(BOOKING_PROVIDER) private readonly provider: BookingProvider,
  ) {}

  async searchAvailability(dto: SearchAvailabilityDto): Promise<EnrichedAvailabilityResult> {
    const currencyCode = (dto.currencyCode ?? 'ARS').toUpperCase();
    const lang = (dto.lang ?? 'es').toLowerCase();

    this.assertDatesValid(dto.checkin, dto.checkout);

    const property = await this.prisma.property.findFirst({
      where: { cloudbedsWidgetPropertyId: dto.propertyId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('Property not found');
    if (!property.cloudbedsWidgetPropertyId) {
      throw new BadRequestException('Property has no Cloudbeds widget_property mapping');
    }

    this.logger.log(`Searching availability for property ${property.id}`);

    const result = await this.provider.searchAvailability({
      propertyExternalId: property.cloudbedsWidgetPropertyId,
      checkin: dto.checkin,
      checkout: dto.checkout,
      currencyCode,
      lang,
      adults: dto.adults,
      children: dto.children,
    });

    this.logger.log(`Availability result: ${JSON.stringify(result)}`);

    // Fire-and-forget snapshot persistence.
    void this.snapshots.record({
      propertyId: property.id,
      checkin: dto.checkin,
      checkout: dto.checkout,
      currencyCode,
      lang,
      result,
    });
    
    this.logger.log(`Snapshot recorded for property ${property.id}`);

    const enrichedRooms = await this.enrichWithLocalUnits(property.id, result.rooms);

    this.logger.log(`Enriched rooms: ${JSON.stringify(enrichedRooms)}`);

    return {
      propertyId: property.id,
      propertyName: property.name,
      propertyExternalId: result.propertyExternalId,
      checkin: dto.checkin,
      checkout: dto.checkout,
      currencyCode,
      lang,
      totalAvailable: result.totalAvailable,
      rooms: enrichedRooms,
      meta: result.meta,
    };
  }

  /**
   * Price a selection of rates via Cloudbeds' `calculateTotals` endpoint.
   * Returns taxes/fees breakdown, grand total and the `cartToken` required
   * by downstream booking steps.
   */
  async calculateTotals(dto: CalculateTotalsDto): Promise<CalculateTotalsResult> {
    const currencyCode = (dto.currencyCode ?? 'ARS').toUpperCase();
    const lang = (dto.lang ?? 'es').toLowerCase();

    this.assertDatesValid(dto.checkin, dto.checkout);

    const property = await this.prisma.property.findFirst({
      where: { cloudbedsWidgetPropertyId: dto.propertyId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('Property not found');
    if (!property.cloudbedsWidgetPropertyId) {
      throw new BadRequestException('Property has no Cloudbeds widget_property mapping');
    }

    this.logger.log(`Calculating totals for property ${property.id}`);

    return this.provider.calculateTotals({
      propertyExternalId: property.cloudbedsWidgetPropertyId,
      checkin: dto.checkin,
      checkout: dto.checkout,
      currencyCode,
      lang,
      rates: dto.rates.map((r) => ({
        rateId: r.rateId,
        adults: r.adults,
        kids: r.kids ?? 0,
      })),
    });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /**
   * Enrich Cloudbeds rooms with local Unit data (description, bedrooms, etc.)
   * matched by `cloudbedsRoomTypeId`. Hides rooms with `remaining <= 0`.
   */
  private async enrichWithLocalUnits(
    propertyId: string,
    rooms: AvailableRoom[],
  ): Promise<EnrichedRoom[]> {
    const reservableRooms = rooms.filter((r) => r.remaining > 0);
    const roomTypeIds = reservableRooms.map((r) => r.roomTypeId);
    if (roomTypeIds.length === 0) return [];

    const localUnits = await this.prisma.unit.findMany({
      where: {
        propertyId,
        deletedAt: null,
        cloudbedsRoomTypeId: { in: roomTypeIds },
      },
      select: {
        id: true,
        name: true,
        description: true,
        bedrooms: true,
        bathrooms: true,
        maxOccupancy: true,
        cloudbedsRoomTypeId: true,
      },
    });

    const byRoomType = new Map<string, typeof localUnits>();
    for (const u of localUnits) {
      if (!u.cloudbedsRoomTypeId) continue;
      const list = byRoomType.get(u.cloudbedsRoomTypeId) ?? [];
      list.push(u);
      byRoomType.set(u.cloudbedsRoomTypeId, list);
    }

    return reservableRooms.map((r) => ({
      ...r,
      localUnits: (byRoomType.get(r.roomTypeId) ?? []).map((u) => ({
        id: u.id,
        name: u.name,
        description: u.description,
        bedrooms: u.bedrooms,
        bathrooms: u.bathrooms,
        maxOccupancy: u.maxOccupancy,
      })),
    }));
  }

  private assertDatesValid(checkin: string, checkout: string): void {
    const ci = new Date(`${checkin}T00:00:00Z`);
    const co = new Date(`${checkout}T00:00:00Z`);
    if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime())) {
      throw new BadRequestException('Invalid checkin/checkout date');
    }
    if (co.getTime() <= ci.getTime()) {
      throw new BadRequestException('checkout must be after checkin');
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (ci.getTime() < today.getTime()) {
      throw new BadRequestException('checkin cannot be in the past');
    }
  }
}
