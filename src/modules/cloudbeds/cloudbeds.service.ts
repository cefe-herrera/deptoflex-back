import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityCacheService } from './availability-cache.service';
import { AvailabilitySnapshotsService } from './availability-snapshots.service';
import { SearchAvailabilityDto } from './dto/search-availability.dto';
import {
  BOOKING_PROVIDER,
  type AvailabilityResult,
  type AvailableRoom,
  type BookingProvider,
  type CalculateTotalsResult,
  type PrepareBookingResult,
} from './providers/booking-provider.interface';
import { CalculateTotalsDto } from './dto/calculate-totals.dto';
import { PrepareBookingDto } from './dto/prepare-booking.dto';
import type { ExternalRequestLogContext } from './external-request.types';

/**
 * Precio de la estadía para una unidad del plan, según el carrito de Cloudbeds
 * (`calculateTotals`) con la ocupación de la búsqueda.
 */
export interface RoomStayPrice {
  /** FINAL: `finalAmount` confirmado por el carrito. SUBTOTAL: sólo hay subtotal. */
  priceStatus: 'FINAL' | 'SUBTOTAL';
  /** Subtotal + impuestos y tasas cobrados aparte. null si no se pudo confirmar. */
  finalAmount: number | null;
  /** Impuestos + tasas que el carrito suma al subtotal. null si no se pudo confirmar. */
  taxesAndFeesAmount: number | null;
  /** Desglose por impuesto/tasa tal como lo devuelve Cloudbeds. */
  taxesAndFees: Array<{ name: string; amount: number }>;
}

export interface EnrichedRoom extends AvailableRoom, RoomStayPrice {
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
    private readonly cache: AvailabilityCacheService,
    private readonly snapshots: AvailabilitySnapshotsService,
    @Inject(BOOKING_PROVIDER) private readonly provider: BookingProvider,
  ) {}

  async searchAvailability(
    dto: SearchAvailabilityDto,
    logContext?: ExternalRequestLogContext,
  ): Promise<EnrichedAvailabilityResult> {
    const currencyCode = (dto.currencyCode ?? 'ARS').toUpperCase();
    const lang = (dto.lang ?? 'es').toLowerCase();

    this.assertDatesValid(dto.checkin, dto.checkout);

    const property = await this.prisma.property.findFirst({
      where: { cloudbedsWidgetPropertyId: dto.propertyId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('Property not found');
    if (!property.cloudbedsWidgetPropertyId) {
      throw new BadRequestException('Property has no Cloudbeds widget mapping');
    }

    const cacheKey = this.cache.buildKey({
      propertyId: property.cloudbedsWidgetPropertyId,
      checkin: dto.checkin,
      checkout: dto.checkout,
      currencyCode,
      lang,
    });

    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Availability cache hit for property ${property.id}`);
      return this.buildEnrichedResponse(property, dto, cached, { fromCache: true });
    }

    this.logger.log(`Searching availability for property ${property.id}`);

    let result: AvailabilityResult;
    try {
      result = await this.provider.searchAvailability({
        propertyExternalId: property.cloudbedsWidgetPropertyId,
        checkin: dto.checkin,
        checkout: dto.checkout,
        currencyCode,
        lang,
        adults: dto.adults,
        children: dto.children,
        logContext: { ...logContext, propertyId: property.id },
      });
      this.cache.set(cacheKey, result);
    } catch (err) {
      const staleCache = this.cache.getStale(cacheKey);
      if (staleCache) {
        this.logger.warn(
          `Cloudbeds unavailable for property ${property.id}; serving stale cache`,
        );
        return this.buildEnrichedResponse(property, dto, staleCache, { fromCache: true, stale: true });
      }

      const snapshot = await this.snapshots.findLatestForSearch({
        propertyId: property.id,
        checkin: dto.checkin,
        checkout: dto.checkout,
        currencyCode,
        lang,
      });
      if (snapshot) {
        this.logger.warn(
          `Cloudbeds unavailable for property ${property.id}; serving latest snapshot`,
        );
        return this.buildEnrichedResponse(property, dto, snapshot, { fromSnapshot: true, stale: true });
      }

      throw err instanceof ServiceUnavailableException
        ? err
        : new ServiceUnavailableException('Booking engine unreachable');
    }

    void this.snapshots.record({
      propertyId: property.id,
      checkin: dto.checkin,
      checkout: dto.checkout,
      currencyCode,
      lang,
      result,
    });

    return this.buildEnrichedResponse(property, dto, result);
  }

  private async buildEnrichedResponse(
    property: { id: string; name: string; cloudbedsWidgetPropertyId: string | null },
    dto: SearchAvailabilityDto,
    result: AvailabilityResult,
    metaExtra?: Record<string, unknown>,
  ): Promise<EnrichedAvailabilityResult> {
    const currencyCode = (dto.currencyCode ?? 'ARS').toUpperCase();
    const lang = (dto.lang ?? 'es').toLowerCase();
    const withUnits = await this.enrichWithLocalUnits(property.id, result.rooms);
    // Si Cloudbeds no respondió la búsqueda (stale/snapshot) no intentamos el
    // carrito: el precio queda como subtotal.
    const skipQuotes = metaExtra?.stale === true;
    const enrichedRooms = await this.attachStayPrices(
      property.cloudbedsWidgetPropertyId,
      dto,
      withUnits,
      skipQuotes,
    );

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
      meta: {
        ...(result.meta ?? {}),
        ...(metaExtra ?? {}),
      },
    };
  }

  /**
   * Price a selection of rates via Cloudbeds' `calculateTotals` endpoint.
   * Returns taxes/fees breakdown, grand total and the `cartToken` required
   * by downstream booking steps.
   */
  async calculateTotals(
    dto: CalculateTotalsDto,
    logContext?: ExternalRequestLogContext,
  ): Promise<CalculateTotalsResult> {
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
      logContext: { ...logContext, propertyId: property.id },
    });
  }

  /**
   * Prepare a Cloudbeds reservation using a previously calculated cart token.
   * This creates the upstream reservation shell and returns Cloudbeds ids/status.
   */
  async prepareBooking(
    dto: PrepareBookingDto,
    logContext?: ExternalRequestLogContext,
  ): Promise<PrepareBookingResult> {
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

    this.logger.log(`Preparing booking for property ${property.id}`);

    return this.provider.prepareBooking({
      propertyExternalId: property.cloudbedsWidgetPropertyId,
      checkin: dto.checkin,
      checkout: dto.checkout,
      currencyCode,
      lang,
      cartToken: dto.cartToken,
      rooms: dto.rooms.map((r) => ({
        rateId: r.rateId,
        adults: r.adults,
        kids: r.kids ?? 0,
        addons: r.addons ?? [],
      })),
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      country: dto.country.toUpperCase(),
      bookingEstimatedArrivalTime: dto.bookingEstimatedArrivalTime ?? 1,
      sessionId: dto.sessionId,
      paymentSdk: dto.paymentSdk ?? true,
      cfarOffersPresented: dto.cfarOffersPresented ?? false,
      bookingEngineSource: dto.bookingEngineSource ?? 'hosted',
      iframe: dto.iframe ?? false,
      logContext: { ...logContext, propertyId: property.id },
    });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /**
   * Enrich Cloudbeds rooms with local Unit data (description, bedrooms, etc.)
   * matched by `cloudbedsRoomTypeId`. Hides rooms with `remaining <= 0`.
   */
  /** Cotizaciones del carrito por propiedad|rateId|fechas|moneda|ocupación. */
  private readonly quoteCache = new Map<
    string,
    { value: Promise<CalculateTotalsResult | null>; expiresAt: number }
  >();
  private readonly quoteTtlMs = Number(
    process.env.CLOUDBEDS_QUOTE_CACHE_TTL_MS ?? process.env.CLOUDBEDS_CACHE_TTL_MS ?? 5 * 60 * 1000,
  );

  /**
   * Agrega a cada tarifa su precio final según el carrito de Cloudbeds, para
   * una unidad y la ocupación de la búsqueda (default 2 adultos). Cloudbeds
   * aplica sus reglas de impuestos/tasas; acá no se recalcula nada. Si el
   * carrito falla o no confirma, la tarifa queda como SUBTOTAL.
   */
  private async attachStayPrices(
    widgetPropertyId: string | null,
    dto: SearchAvailabilityDto,
    rooms: Array<AvailableRoom & Pick<EnrichedRoom, 'localUnits'>>,
    skipQuotes: boolean,
  ): Promise<EnrichedRoom[]> {
    const subtotalOnly: RoomStayPrice = {
      priceStatus: 'SUBTOTAL',
      finalAmount: null,
      taxesAndFeesAmount: null,
      taxesAndFees: [],
    };
    if (skipQuotes || !widgetPropertyId) {
      return rooms.map((r) => ({ ...r, ...subtotalOnly }));
    }

    const currencyCode = (dto.currencyCode ?? 'ARS').toUpperCase();
    const lang = (dto.lang ?? 'es').toLowerCase();
    const adults = dto.adults && dto.adults > 0 ? dto.adults : 2;
    const kids = dto.children ?? 0;

    // "cheapest": una cotización por tipo de unidad (la tarifa de menor
    // subtotal), para no exceder el rate limit de Cloudbeds en listados.
    let toQuote: Set<AvailableRoom> | null = null;
    if (dto.priceQuotes === 'cheapest') {
      const cheapest = new Map<string, AvailableRoom>();
      for (const r of rooms) {
        if (!r.rateId || r.totalAmount == null) continue;
        const prev = cheapest.get(r.roomTypeId);
        if (!prev || r.totalAmount < (prev.totalAmount ?? Infinity)) cheapest.set(r.roomTypeId, r);
      }
      toQuote = new Set(cheapest.values());
    }

    return Promise.all(
      rooms.map(async (room) => {
        if (!room.rateId || room.totalAmount == null) return { ...room, ...subtotalOnly };
        if (toQuote && !toQuote.has(room)) return { ...room, ...subtotalOnly };
        const quote = await this.quoteRate({
          propertyExternalId: widgetPropertyId,
          checkin: dto.checkin,
          checkout: dto.checkout,
          currencyCode,
          lang,
          rateId: room.rateId,
          adults,
          kids,
        });
        if (!quote || quote.priceStatus !== 'FINAL') return { ...room, ...subtotalOnly };
        return {
          ...room,
          priceStatus: 'FINAL' as const,
          finalAmount: quote.grandTotal,
          taxesAndFeesAmount: Math.round((quote.taxesTotal + quote.feesTotal) * 100) / 100,
          taxesAndFees: [...quote.taxes, ...quote.fees]
            .filter((t) => t.amount > 0)
            .map((t) => ({ name: t.name, amount: t.amount })),
        };
      }),
    );
  }

  private quoteRate(q: {
    propertyExternalId: string;
    checkin: string;
    checkout: string;
    currencyCode: string;
    lang: string;
    rateId: string;
    adults: number;
    kids: number;
  }): Promise<CalculateTotalsResult | null> {
    const key = [
      q.propertyExternalId, q.rateId, q.checkin, q.checkout, q.currencyCode, q.adults, q.kids,
    ].join('|');
    const now = Date.now();
    const hit = this.quoteCache.get(key);
    if (hit && hit.expiresAt > now) return hit.value;

    if (this.quoteCache.size > 5000) {
      for (const [k, v] of this.quoteCache) if (v.expiresAt <= now) this.quoteCache.delete(k);
    }

    // Cloudbeds aplica un rate limit compartido (búsqueda + carrito) por IP.
    // Las cotizaciones nunca deben dejar sin cupo a la búsqueda: si estamos en
    // pausa por un 429 o se agotó el cupo por minuto, la tarifa queda como
    // SUBTOTAL (sin cachear) y se reintenta en una búsqueda posterior.
    if (now < this.quotePausedUntil || !this.takeQuoteToken(now)) {
      return Promise.resolve(null);
    }

    // Se guarda la promesa para deduplicar búsquedas concurrentes.
    const value = (async (): Promise<CalculateTotalsResult | null> => {
      try {
        const res = await this.provider.calculateTotals({
          propertyExternalId: q.propertyExternalId,
          checkin: q.checkin,
          checkout: q.checkout,
          currencyCode: q.currencyCode,
          lang: q.lang,
          rates: [{ rateId: q.rateId, adults: q.adults, kids: q.kids }],
        });
        return res ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/rate limited/i.test(message)) {
          this.quotePausedUntil = Date.now() + this.quotePauseMs;
          this.logger.warn(
            `Cloudbeds rate limit on quotes; pausing quotes for ${this.quotePauseMs / 1000}s`,
          );
        } else {
          this.logger.warn(
            `Quote failed for rate ${q.rateId} (property ${q.propertyExternalId}): ${message}`,
          );
        }
        // Un fallo no se cachea: la próxima búsqueda puede reintentar.
        this.quoteCache.delete(key);
        return null;
      }
    })();
    this.quoteCache.set(key, { value, expiresAt: now + this.quoteTtlMs });
    return value;
  }

  /** Pausa de cotizaciones tras un 429 de Cloudbeds. */
  private quotePausedUntil = 0;
  private readonly quotePauseMs = Number(process.env.CLOUDBEDS_QUOTE_PAUSE_MS ?? 60_000);
  /** Cupo de cotizaciones al carrito por minuto (ventana deslizante). */
  private readonly quoteMaxPerMinute = Number(process.env.CLOUDBEDS_QUOTE_MAX_PER_MIN ?? 30);
  private readonly quoteTimestamps: number[] = [];

  private takeQuoteToken(now: number): boolean {
    while (this.quoteTimestamps.length > 0 && this.quoteTimestamps[0] <= now - 60_000) {
      this.quoteTimestamps.shift();
    }
    if (this.quoteTimestamps.length >= this.quoteMaxPerMinute) return false;
    this.quoteTimestamps.push(now);
    return true;
  }

  private async enrichWithLocalUnits(
    propertyId: string,
    rooms: AvailableRoom[],
  ): Promise<Array<AvailableRoom & Pick<EnrichedRoom, 'localUnits'>>> {
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
