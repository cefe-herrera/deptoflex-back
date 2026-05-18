import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as https from 'node:https';
import { URL } from 'node:url';
import {
  AvailabilityResult,
  AvailableRoom,
  BookingProvider,
  NightlyRate,
  OtaRateComparison,
  ReservationRedirectInput,
  SearchAvailabilityInput,
} from './booking-provider.interface';
import {
  CloudbedsResponseSchema,
  type RawCloudbedsResponse,
  type RawMaRate,
  type RawRoomType,
} from './cloudbeds-response.schema';

/**
 * Public Cloudbeds Booking Engine provider — read-only.
 *
 * Calls `POST https://hotels.cloudbeds.com/booking/rooms` with a minimal
 * form-urlencoded body. **No cookies, no Authorization, no private session
 * tokens** are ever sent. This is the same endpoint the public widget uses
 * and is therefore safe to consume server-side for read purposes.
 *
 * Reservations are NEVER created from here: callers must redirect users to
 * the official Cloudbeds booking engine via `buildReservationRedirectUrl`.
 *
 * Limitations:
 * - The response shape is not an official contract and may change.
 * - Rate-limit / abuse protection is the caller's responsibility.
 */
@Injectable()
export class CloudbedsPublicBookingProvider implements BookingProvider {
  readonly providerName = 'cloudbeds-public';

  private readonly logger = new Logger(CloudbedsPublicBookingProvider.name);

  /** Endpoint can be overridden via env CLOUDBEDS_BOOKING_ROOMS_URL. */
  private readonly endpoint =
    process.env.CLOUDBEDS_BOOKING_ROOMS_URL ?? 'https://hotels.cloudbeds.com/booking/rooms';

  /** Base URL for the official reservation page (where users are redirected). */
  private readonly reservationBaseUrl =
    process.env.CLOUDBEDS_RESERVATION_BASE_URL ?? 'https://hotels.cloudbeds.com';

  /** Generic backend UA — never spoof a browser. */
  private readonly userAgent ='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

  /** Timeout in ms for the upstream call. */
  private readonly timeoutMs = Number(process.env.CLOUDBEDS_HTTP_TIMEOUT_MS ?? 10_000);

  async searchAvailability(input: SearchAvailabilityInput): Promise<AvailabilityResult> {
    this.logger.log("searchAvailability")
    const body = this.buildFormBody(input);
    const startedAt = Date.now();

    let httpStatus = 0;
    let rawText = '';
    try {
      this.logger.log("httpPost endpoint=" + this.endpoint + " body=" + body);
      const { status, text } = await this.httpPost(this.endpoint, body);
      this.logger.log("httpPost status=" + status + " text=" + text);
      httpStatus = status;
      rawText = text;

      if (status < 200 || status >= 300) {
        this.logger.warn(
          `Cloudbeds returned non-OK status ${httpStatus} for property=${input.propertyExternalId} body="${rawText.slice(0, 500).replace(/\s+/g, ' ')}"`,
        );
        throw new ServiceUnavailableException('Booking engine upstream error');
      }

      let json: unknown;
      try {
        json = JSON.parse(rawText);
      } catch {
        this.logger.error('Cloudbeds returned non-JSON body');
        throw new ServiceUnavailableException('Booking engine returned invalid response');
      }

      const parseResult = CloudbedsResponseSchema.safeParse(json);
      if (!parseResult.success) {
        this.logger.error(
          `Cloudbeds response failed schema validation: ${parseResult.error.message}`,
        );
        throw new ServiceUnavailableException('Booking engine returned unexpected payload');
      }

      const durationMs = Date.now() - startedAt;
      return this.normalize(input, parseResult.data, httpStatus, durationMs);
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      if (err instanceof ServiceUnavailableException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.error(`Cloudbeds request timed out after ${durationMs}ms`);
        throw new ServiceUnavailableException('Booking engine timeout');
      }
      this.logger.error(
        `Cloudbeds request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException('Booking engine unreachable');
    }
  }

  /**
   * Minimal HTTPS POST using node:https. Avoids undici/fetch which injects
   * sec-fetch-* and accept-language headers that Cloudbeds' nginx rejects
   * with 403.
   */
  private httpPost(endpoint: string, body: string): Promise<{ status: number; text: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint);
      const req = https.request(
        {
          method: 'POST',
          host: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
            'User-Agent': this.userAgent,
            Accept: '*/*',
          },
          timeout: this.timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            resolve({
              status: res.statusCode ?? 0,
              text: Buffer.concat(chunks).toString('utf8'),
            });
          });
        },
      );
      req.on('timeout', () => req.destroy(new Error('AbortError')));
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  buildReservationRedirectUrl(input: ReservationRedirectInput): string {
    if (!input.bookingSlug) {
      // Fallback: send users to the property landing page on Cloudbeds.
      const params = new URLSearchParams({
        widget_property: input.propertyExternalId,
        checkin: input.checkin,
        checkout: input.checkout,
        currency_code: input.currencyCode,
        lang: input.lang,
      });
      return `${this.reservationBaseUrl}/booking?${params.toString()}`;
    }

    const params = new URLSearchParams({
      currency: input.currencyCode.toLowerCase(),
      checkin: input.checkin,
      checkout: input.checkout,
      room_type_id: input.roomTypeId,
    });
    if (input.rateId) params.set('rate_id', input.rateId);
    if (input.adults && input.adults > 0) params.set('adults', String(input.adults));
    if (input.children && input.children > 0) params.set('children', String(input.children));

    return `${this.reservationBaseUrl}/${input.lang}/reservation/${input.bookingSlug}/?${params.toString()}`;
  }

  // ── internals ───────────────────────────────────────────────────────────

  buildFormBody(input: SearchAvailabilityInput): string {
    const params = new URLSearchParams();
    params.set('checkin', input.checkin);
    params.set('checkout', input.checkout);
    params.set('currency_code', input.currencyCode);
    params.set('lang', input.lang);
    params.set('widget_property', input.propertyExternalId);
    return params.toString();
  }

  normalize(
    input: SearchAvailabilityInput,
    raw: RawCloudbedsResponse,
    httpStatus: number,
    durationMs: number,
  ): AvailabilityResult {
    const roomTypes = raw.room_types ?? [];
    const maRates = raw.ma_rates ?? [];

    const rooms: AvailableRoom[] = roomTypes.map((rt) => this.normalizeRoom(rt, maRates));

    return {
      propertyExternalId: input.propertyExternalId,
      checkin: input.checkin,
      checkout: input.checkout,
      currencyCode: input.currencyCode,
      totalAvailable: typeof raw.total === 'number' ? raw.total : 0,
      rooms,
      meta: {
        websiteSourceId: raw.website_source_id ?? null,
        currencyRate: raw.currency_rate ?? null,
      },
      raw,
      httpStatus,
      durationMs,
    };
  }

  private normalizeRoom(rt: RawRoomType, maRates: RawMaRate[]): AvailableRoom {
    const detailedRates: NightlyRate[] = (rt.detailed_rates ?? []).map((d) => ({
      date: d.date,
      rate: d.rate,
      baseRate: typeof d.base_rate === 'number' ? d.base_rate : d.rate,
    }));

    const totalAmount = (() => {
      if (typeof rt.rate_basic === 'number' && rt.rate_basic > 0) return rt.rate_basic;
      if (detailedRates.length > 0) return detailedRates.reduce((acc, r) => acc + r.rate, 0);
      return null;
    })();

    const photosSet = new Set<string>();
    if (rt.featured_photo_big) photosSet.add(rt.featured_photo_big);
    if (rt.featured_photo) photosSet.add(rt.featured_photo);
    for (const p of rt.photos_gallery ?? []) {
      if (p.length > 0) photosSet.add(p);
    }

    const features = rt.features ?? [];
    const unitIds = rt.unit_ids ?? [];

    const remaining = (() => {
      if (typeof rt.remaining === 'number') return rt.remaining;
      if (typeof rt.num_available_now === 'number') return rt.num_available_now;
      return 0;
    })();

    const ota = this.findOtaComparison(rt, maRates);

    return {
      roomTypeId: String(rt.room_type_id),
      rateId: rt.rate_id != null ? String(rt.rate_id) : null,
      name: rt.room_type_name ?? rt.room_type_title ?? `Room ${rt.room_type_id}`,
      title: rt.room_type_title ?? rt.room_type_name ?? `Room ${rt.room_type_id}`,
      descriptionHtml: rt.room_type_desc ?? null,
      maxGuests: this.toNumber(rt.max_guests),
      maxAdults: this.toNumber(rt.max_adults),
      maxChildren: this.toNumber(rt.max_children),
      remaining,
      totalRooms: typeof rt.max_rooms === 'number' ? rt.max_rooms : 0,
      totalAmount,
      minNightlyRate: typeof rt.rate_min === 'number' ? rt.rate_min : null,
      maxNightlyRate: typeof rt.rate_max === 'number' ? rt.rate_max : null,
      detailedRates,
      photos: Array.from(photosSet),
      featuredPhoto: rt.featured_photo_big ?? rt.featured_photo ?? null,
      features,
      unitIds,
      otaComparison: ota.length > 0 ? ota : undefined,
    };
  }

  private findOtaComparison(rt: RawRoomType, maRates: RawMaRate[]): OtaRateComparison[] {
    if (maRates.length === 0) return [];
    const match = maRates.find(
      (m) =>
        m.name === rt.room_type_name ||
        m.name === rt.room_type_title ||
        String(m.id) === String(rt.room_type_id),
    );
    if (!match) return [];
    const direct = typeof match.direct === 'number' ? match.direct : 0;
    return (match.rates ?? []).map((r) => ({
      channelName: r.channel_name,
      channelPrice: r.channel_price,
      directPrice: direct,
    }));
  }

  private toNumber(value: string | number | undefined): number | null {
    if (value === undefined || value === null) return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }
}
