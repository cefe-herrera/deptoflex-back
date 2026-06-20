import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ExternalRequestType } from '@prisma/client';
import * as https from 'node:https';
import { URL } from 'node:url';
import { ExternalRequestService } from '../external-request.service';
import {
  AvailabilityResult,
  AvailableRoom,
  BookingProvider,
  CalculateTotalsInput,
  CalculateTotalsResult,
  ConfirmationInput,
  ConfirmationResult,
  NightlyRate,
  OtaRateComparison,
  PrepareBookingInput,
  PrepareBookingResult,
  ReservationRedirectInput,
  SearchAvailabilityInput,
  TotalsRoomBreakdown,
  TotalsTaxOrFee,
} from './booking-provider.interface';
import {
  CloudbedsResponseSchema,
  type RawCloudbedsResponse,
  type RawMaRate,
  type RawRoomType,
} from './cloudbeds-response.schema';
import {
  CloudbedsTotalsResponseSchema,
  type RawTaxFeeGroup,
  type RawTotalsData,
} from './cloudbeds-totals.schema';
import {
  CloudbedsPrepareResponseSchema,
  type RawCloudbedsPrepareResponse,
} from './cloudbeds-prepare.schema';

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

  /** Totals endpoint can be overridden via env CLOUDBEDS_BOOKING_TOTALS_URL. */
  private readonly totalsEndpoint =
    process.env.CLOUDBEDS_BOOKING_TOTALS_URL ??
    'https://hotels.cloudbeds.com/booking/calculateTotals';

  /** Prepare endpoint can be overridden via env CLOUDBEDS_BOOKING_PREPARE_URL. */
  private readonly prepareEndpoint =
    process.env.CLOUDBEDS_BOOKING_PREPARE_URL ??
    'https://hotels.cloudbeds.com/booking/prepare';

  /** Base URL for the official reservation page (where users are redirected). */
  private readonly reservationBaseUrl =
    process.env.CLOUDBEDS_RESERVATION_BASE_URL ?? 'https://hotels.cloudbeds.com';

  /** Confirmation page endpoint, overridable via env. */
  private readonly confirmationEndpoint =
    process.env.CLOUDBEDS_BOOKING_CONFIRMATION_URL ??
    'https://hotels.cloudbeds.com/booking/confirmation';

  /** Generic backend UA — never spoof a browser. */
  private readonly userAgent ='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

  /** Timeout in ms for the upstream call. */
  private readonly timeoutMs = Number(process.env.CLOUDBEDS_HTTP_TIMEOUT_MS ?? 10_000);

  /** Max chars logged for Cloudbeds HTTP response bodies. */
  private readonly cloudbedsLogResponseMaxChars = Number(
    process.env.CLOUDBEDS_LOG_RESPONSE_MAX_CHARS ?? 16_000,
  );

  constructor(private readonly externalRequests: ExternalRequestService) {}

  private logCloudbedsRequest(
    operation: 'prepare' | 'confirmation',
    method: 'POST' | 'GET',
    url: string,
    payload?: string,
  ): void {
    const payloadPart = payload
      ? ` payload=${this.formatFormBodyForLog(payload)}`
      : '';
    this.logger.log(`[Cloudbeds:${operation}] → ${method} ${url}${payloadPart}`);
  }

  private logCloudbedsResponse(
    operation: 'prepare' | 'confirmation',
    status: number,
    body: string,
    durationMs: number,
  ): void {
    this.logger.log(
      `[Cloudbeds:${operation}] ← status=${status} durationMs=${durationMs} response=${this.truncateForLog(body)}`,
    );
  }

  private logPrepareInputSummary(input: PrepareBookingInput): void {
    this.logger.log(
      `[Cloudbeds:prepare] input summary=${JSON.stringify({
        propertyExternalId: input.propertyExternalId,
        checkin: input.checkin,
        checkout: input.checkout,
        currencyCode: input.currencyCode,
        lang: input.lang,
        rooms: input.rooms,
        guest: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          country: input.country,
          bookingEstimatedArrivalTime: input.bookingEstimatedArrivalTime,
        },
        cartTokenLength: input.cartToken.length,
        sessionId: input.sessionId ?? null,
        paymentSdk: input.paymentSdk,
        bookingEngineSource: input.bookingEngineSource,
      })}`,
    );
  }

  private logPrepareResultSummary(result: PrepareBookingResult): void {
    this.logger.log(
      `[Cloudbeds:prepare] result summary=${JSON.stringify({
        success: result.success,
        cloudbedsSuccessFlag: result.cloudbedsSuccessFlag,
        reservationId: result.reservationId,
        encryptedReservationId: result.encryptedReservationId,
        customerId: result.customerId,
        status: result.status,
        statusMessage: result.statusMessage,
        paymentUrl: result.paymentUrl,
        httpStatus: result.httpStatus,
        durationMs: result.durationMs,
      })}`,
    );
  }

  private logConfirmationResultSummary(result: ConfirmationResult): void {
    this.logger.log(
      `[Cloudbeds:confirmation] parsed summary=${JSON.stringify({
        reservationId: result.reservationId,
        guestName: result.guestName,
        guestEmail: result.guestEmail,
        checkin: result.checkin,
        checkout: result.checkout,
        totalAmount: result.totalAmount,
        currencyCode: result.currencyCode,
        propertyExternalId: result.propertyExternalId,
        roomTypeId: result.roomTypeId,
        status: result.status,
        httpStatus: result.httpStatus,
        durationMs: result.durationMs,
      })}`,
    );
  }

  private formatFormBodyForLog(body: string): string {
    try {
      const params = new URLSearchParams(body);
      const obj: Record<string, string> = {};
      params.forEach((value, key) => {
        obj[key] = value.length > 2_000 ? `${value.slice(0, 2_000)}… [truncated]` : value;
      });
      return JSON.stringify(obj);
    } catch {
      return this.truncateForLog(body);
    }
  }

  private truncateForLog(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= this.cloudbedsLogResponseMaxChars) {
      return normalized;
    }
    return `${normalized.slice(0, this.cloudbedsLogResponseMaxChars)}… [truncated ${normalized.length - this.cloudbedsLogResponseMaxChars} chars]`;
  }

  async searchAvailability(input: SearchAvailabilityInput): Promise<AvailabilityResult> {
    this.logger.log("searchAvailability")
    const body = this.buildFormBody(input);
    const startedAt = Date.now();

    let httpStatus = 0;
    let rawText = '';
    let success = false;
    let errorMessage: string | undefined;
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
      success = true;
      return this.normalize(input, parseResult.data, httpStatus, durationMs);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      if (err instanceof ServiceUnavailableException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        const durationMs = Date.now() - startedAt;
        this.logger.error(`Cloudbeds request timed out after ${durationMs}ms`);
        throw new ServiceUnavailableException('Booking engine timeout');
      }
      this.logger.error(
        `Cloudbeds request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException('Booking engine unreachable');
    } finally {
      this.externalRequests.record({
        type: ExternalRequestType.ROOM,
        endpoint: this.endpoint,
        method: 'POST',
        request: body,
        responseText: rawText || undefined,
        httpStatus: httpStatus || undefined,
        durationMs: Date.now() - startedAt,
        success,
        errorMessage,
        logContext: input.logContext,
      });
    }
  }

  async calculateTotals(input: CalculateTotalsInput): Promise<CalculateTotalsResult> {
    this.logger.log('calculateTotals');
    const body = this.buildTotalsFormBody(input);
    const startedAt = Date.now();

    let httpStatus = 0;
    let rawText = '';
    let success = false;
    let errorMessage: string | undefined;
    try {
      this.logger.log(`httpPost endpoint=${this.totalsEndpoint} body=${body}`);
      const { status, text } = await this.httpPost(this.totalsEndpoint, body);
      this.logger.log(`httpPost status=${status} text=${text.slice(0, 1000)}`);
      httpStatus = status;
      rawText = text;

      if (status < 200 || status >= 300) {
        this.logger.warn(
          `Cloudbeds totals returned non-OK status ${httpStatus} for property=${input.propertyExternalId} body="${rawText.slice(0, 500).replace(/\s+/g, ' ')}"`,
        );
        throw new ServiceUnavailableException('Booking engine upstream error');
      }

      let json: unknown;
      try {
        json = JSON.parse(rawText);
      } catch {
        this.logger.error('Cloudbeds totals returned non-JSON body');
        throw new ServiceUnavailableException('Booking engine returned invalid response');
      }

      const parseResult = CloudbedsTotalsResponseSchema.safeParse(json);
      if (!parseResult.success) {
        this.logger.error(
          `Cloudbeds totals response failed schema validation: ${parseResult.error.message}`,
        );
        throw new ServiceUnavailableException('Booking engine returned unexpected payload');
      }

      const parsed = parseResult.data;
      if (parsed.success === false || !parsed.data) {
        this.logger.warn(
          `Cloudbeds totals returned success=false: ${parsed.statusMessage ?? 'unknown'}`,
        );
        throw new ServiceUnavailableException(
          parsed.statusMessage ?? 'Booking engine rejected the totals request',
        );
      }

      const durationMs = Date.now() - startedAt;
      success = true;
      return this.normalizeTotals(input, parsed.data, httpStatus, durationMs);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      if (err instanceof ServiceUnavailableException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        const durationMs = Date.now() - startedAt;
        this.logger.error(`Cloudbeds totals request timed out after ${durationMs}ms`);
        throw new ServiceUnavailableException('Booking engine timeout');
      }
      this.logger.error(
        `Cloudbeds totals request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException('Booking engine unreachable');
    } finally {
      this.externalRequests.record({
        type: ExternalRequestType.CALCULATE_TOTALS,
        endpoint: this.totalsEndpoint,
        method: 'POST',
        request: body,
        responseText: rawText || undefined,
        httpStatus: httpStatus || undefined,
        durationMs: Date.now() - startedAt,
        success,
        errorMessage,
        logContext: input.logContext,
      });
    }
  }

  async prepareBooking(input: PrepareBookingInput): Promise<PrepareBookingResult> {
    const body = this.buildPrepareFormBody(input);
    const startedAt = Date.now();

    this.logPrepareInputSummary(input);
    this.logCloudbedsRequest('prepare', 'POST', this.prepareEndpoint, body);

    let httpStatus = 0;
    let rawText = '';
    let success = false;
    let errorMessage: string | undefined;
    try {
      const { status, text } = await this.httpPost(this.prepareEndpoint, body);
      httpStatus = status;
      rawText = text;
      const durationMs = Date.now() - startedAt;
      this.logCloudbedsResponse('prepare', status, text, durationMs);

      if (status < 200 || status >= 300) {
        this.logger.warn(
          `Cloudbeds prepare returned non-OK status ${httpStatus} for property=${input.propertyExternalId} body="${rawText.slice(0, 500).replace(/\s+/g, ' ')}"`,
        );
        throw new ServiceUnavailableException('Booking engine upstream error');
      }

      let json: unknown;
      try {
        json = JSON.parse(rawText);
      } catch {
        this.logger.error('Cloudbeds prepare returned non-JSON body');
        throw new ServiceUnavailableException('Booking engine returned invalid response');
      }

      const parseResult = CloudbedsPrepareResponseSchema.safeParse(json);
      if (!parseResult.success) {
        this.logger.error(
          `Cloudbeds prepare response failed schema validation: ${parseResult.error.message}`,
        );
        throw new ServiceUnavailableException('Booking engine returned unexpected payload');
      }

      const parsed = parseResult.data;
      const hasEncryptedId = Boolean(parsed.enc_res_id?.trim());

      if (parsed.success === false && !hasEncryptedId) {
        const detail =
          parsed.statusMessage ??
          parsed.message ??
          (parsed.errorCode != null ? String(parsed.errorCode) : null) ??
          'unknown';
        this.logger.warn(
          `Cloudbeds prepare rejected (no enc_res_id): ${detail} body="${rawText.slice(0, 800).replace(/\s+/g, ' ')}"`,
        );
        throw new ServiceUnavailableException(
          parsed.statusMessage ?? parsed.message ?? 'Booking engine rejected the prepare request',
        );
      }

      if (parsed.success === false && hasEncryptedId) {
        this.logger.warn(
          `Cloudbeds prepare returned success=false but enc_res_id is present — treating as soft success (likely payment pending). statusMessage=${parsed.statusMessage ?? parsed.message ?? 'n/a'} payment_url=${parsed.payment_url ?? 'n/a'}`,
        );
      }

      const result = this.normalizePrepare(input, parsed, httpStatus, durationMs);
      this.logPrepareResultSummary(result);
      success = true;
      return result;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      if (err instanceof ServiceUnavailableException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        const durationMs = Date.now() - startedAt;
        this.logger.error(`Cloudbeds prepare request timed out after ${durationMs}ms`);
        throw new ServiceUnavailableException('Booking engine timeout');
      }
      this.logger.error(
        `Cloudbeds prepare request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException('Booking engine unreachable');
    } finally {
      this.externalRequests.record({
        type: ExternalRequestType.PREPARE,
        endpoint: this.prepareEndpoint,
        method: 'POST',
        request: body,
        responseText: rawText || undefined,
        httpStatus: httpStatus || undefined,
        durationMs: Date.now() - startedAt,
        success,
        errorMessage,
        logContext: input.logContext,
      });
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

  async getConfirmation(input: ConfirmationInput): Promise<ConfirmationResult> {
    const startedAt = Date.now();
    const url = `${this.confirmationEndpoint}?data_res=${encodeURIComponent(input.dataRes)}`;

    this.logger.log(
      `[Cloudbeds:confirmation] request data_res=${JSON.stringify({
        length: input.dataRes.length,
        value: input.dataRes,
      })}`,
    );
    this.logCloudbedsRequest('confirmation', 'GET', url);

    let httpStatus = 0;
    let rawText = '';
    let success = false;
    let errorMessage: string | undefined;
    try {
      const { status, text } = await this.httpGet(url);
      httpStatus = status;
      rawText = text;
      const durationMs = Date.now() - startedAt;
      this.logCloudbedsResponse('confirmation', status, text, durationMs);

      if (status < 200 || status >= 300) {
        this.logger.warn(`Cloudbeds confirmation returned non-OK status ${httpStatus}`);
        throw new ServiceUnavailableException('Booking engine confirmation upstream error');
      }

      const result = this.parseConfirmation(rawText, httpStatus, durationMs);
      this.logConfirmationResultSummary(result);
      success = true;
      return result;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      if (err instanceof ServiceUnavailableException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        const durationMs = Date.now() - startedAt;
        this.logger.error(`Cloudbeds confirmation request timed out after ${durationMs}ms`);
        throw new ServiceUnavailableException('Booking engine timeout');
      }
      this.logger.error(
        `Cloudbeds confirmation request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException('Booking engine unreachable');
    } finally {
      this.externalRequests.record({
        type: ExternalRequestType.CONFIRMATION,
        endpoint: this.confirmationEndpoint,
        method: 'GET',
        request: { data_res: input.dataRes },
        responseText: rawText || undefined,
        httpStatus: httpStatus || undefined,
        durationMs: Date.now() - startedAt,
        success,
        errorMessage,
        logContext: input.logContext,
      });
    }
  }

  /**
   * Best-effort parse of the confirmation response. Cloudbeds may return a JSON
   * API payload (`{ success, data: { mail_info, ... } }`) or an HTML page with
   * embedded state. We try JSON first, then embedded JSON, then regex fallbacks.
   */
  private parseConfirmation(
    rawText: string,
    httpStatus: number,
    durationMs: number,
  ): ConfirmationResult {
    const trimmed = rawText.trim();
    if (trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(trimmed) as {
          success?: boolean;
          data?: Record<string, unknown>;
        };
        if (json.success !== false && json.data && typeof json.data === 'object') {
          return this.normalizeConfirmationJson(json.data, rawText, httpStatus, durationMs);
        }
      } catch {
        // fall through to HTML heuristics
      }
    }

    const html = rawText;
    const parsed = this.extractEmbeddedJson(html);

    const pick = (...keys: string[]): unknown => {
      for (const k of keys) {
        const v = parsed?.[k];
        if (v != null && v !== '') return v;
      }
      return null;
    };

    const asString = (v: unknown): string | null =>
      v == null ? null : String(v).trim() || null;
    const asNumber = (v: unknown): number | null => {
      if (v == null) return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(n) ? n : null;
    };

    const reservationId =
      asString(pick('reservation_id', 'reservationId', 'res_id', 'reservationID')) ??
      this.regexFirst(html, /reservation[_-]?id["'\s:=]+([A-Za-z0-9-]+)/i);

    const guestFirstName = asString(pick('first_name', 'firstName', 'guest_first_name'));
    const guestLastName = asString(pick('last_name', 'lastName', 'guest_last_name'));
    const guestNameJoined = [guestFirstName, guestLastName].filter(Boolean).join(' ').trim();
    const guestName =
      asString(pick('guest_name', 'guestName', 'name')) ||
      (guestNameJoined.length > 0 ? guestNameJoined : null);

    const checkin =
      asString(pick('checkin', 'checkIn', 'check_in', 'selected_checkin')) ??
      this.regexFirst(html, /check[_-]?in["'\s:=]+(\d{4}-\d{2}-\d{2})/i);
    const checkout =
      asString(pick('checkout', 'checkOut', 'check_out', 'selected_checkout')) ??
      this.regexFirst(html, /check[_-]?out["'\s:=]+(\d{4}-\d{2}-\d{2})/i);

    const totalAmount =
      asNumber(pick('grandTotal', 'grand_total', 'total', 'totalAmount', 'total_amount')) ??
      asNumber(this.regexFirst(html, /grand[_-]?total["'\s:=]+([0-9.,]+)/i));

    const currencyCode = asString(pick('currency', 'currencyCode', 'currency_code'));
    const propertyExternalId = asString(
      pick('widget_property', 'property_id', 'propertyId', 'propertyID'),
    );
    const roomTypeId = asString(pick('room_type_id', 'roomTypeId'));
    const status = asString(pick('status', 'reservation_status'));
    const guestEmail = asString(pick('email', 'guest_email'));
    const guestPhone = asString(pick('phone', 'guest_phone'));

    return {
      reservationId,
      guestFirstName,
      guestLastName,
      guestName,
      guestEmail,
      guestPhone,
      checkin,
      checkout,
      totalAmount,
      currencyCode,
      propertyExternalId,
      roomTypeId,
      status,
      parsed,
      raw: rawText.slice(0, 20_000),
      httpStatus,
      durationMs,
    };
  }

  /** Parse `{ success, data }` JSON from GET /booking/confirmation. */
  private normalizeConfirmationJson(
    data: Record<string, unknown>,
    rawText: string,
    httpStatus: number,
    durationMs: number,
  ): ConfirmationResult {
    const mailInfo =
      data.mail_info && typeof data.mail_info === 'object'
        ? (data.mail_info as Record<string, unknown>)
        : {};
    const rooms = Array.isArray(mailInfo.booking_rooms)
      ? (mailInfo.booking_rooms as Array<Record<string, unknown>>)
      : [];
    const firstRoom = rooms[0] ?? {};

    const asString = (v: unknown): string | null =>
      v == null ? null : String(v).trim() || null;
    const asNumber = (v: unknown): number | null => {
      if (v == null) return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(n) ? n : null;
    };

    const guestFirstName =
      asString(mailInfo.first_name) ?? asString(data.first) ?? asString(data.first_name);
    const guestLastName =
      asString(mailInfo.last_name) ?? asString(data.last) ?? asString(data.last_name);
    const guestNameJoined = [guestFirstName, guestLastName].filter(Boolean).join(' ').trim();
    const guestName =
      asString(mailInfo.name) ??
      asString(data.name) ??
      (guestNameJoined.length > 0 ? guestNameJoined : null);

    return {
      reservationId:
        asString(mailInfo.reservation_id) ??
        asString(mailInfo.identifier) ??
        asString(data.identifier) ??
        asString(data.reservation_id),
      guestFirstName,
      guestLastName,
      guestName,
      guestEmail: asString(mailInfo.email) ?? asString(data.email),
      guestPhone: asString(mailInfo.phone) ?? asString(data.phone),
      checkin:
        asString(mailInfo.checkin_date) ??
        asString(data.checkin) ??
        asString(data.checkin_date),
      checkout:
        asString(mailInfo.checkout_date) ??
        asString(data.checkout) ??
        asString(data.checkout_date),
      totalAmount:
        asNumber(mailInfo.grand_total) ??
        asNumber(mailInfo.booking_total) ??
        asNumber(data.total) ??
        asNumber(data.grand_total),
      currencyCode:
        asString(mailInfo.currency_from) ??
        asString(data.currency_code) ??
        asString(data.currency),
      propertyExternalId:
        asString(data.property_id) ?? asString(mailInfo.property_id),
      roomTypeId: asString(firstRoom.room_type_id) ?? asString(data.room_type_id),
      status: asString(data.status) ?? asString(mailInfo.status),
      parsed: { ...data, ...mailInfo },
      raw: rawText.slice(0, 20_000),
      httpStatus,
      durationMs,
    };
  }

  /** Try common embedded-JSON patterns used by booking-engine pages. */
  private extractEmbeddedJson(html: string): Record<string, unknown> | null {
    const patterns = [
      /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i,
      /window\.reservationData\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i,
      /var\s+reservation\s*=\s*(\{[\s\S]*?\})\s*;/i,
      /data-reservation=["'](\{[\s\S]*?\})["']/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) {
        try {
          const decoded = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
          const obj = JSON.parse(decoded) as Record<string, unknown>;
          // If the blob nests the reservation under a common key, surface it.
          const nested =
            (obj.reservation as Record<string, unknown>) ??
            (obj.data as Record<string, unknown>) ??
            null;
          return nested && typeof nested === 'object' ? { ...obj, ...nested } : obj;
        } catch {
          // try next pattern
        }
      }
    }
    return null;
  }

  private regexFirst(text: string, re: RegExp): string | null {
    const m = text.match(re);
    return m?.[1]?.trim() || null;
  }

  /** Minimal HTTPS GET mirroring httpPost (no browser-spoofing headers). */
  private httpGet(endpoint: string): Promise<{ status: number; text: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint);
      const req = https.request(
        {
          method: 'GET',
          host: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          headers: {
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
      req.end();
    });
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

  // ── totals helpers ──────────────────────────────────────────────────────

  buildTotalsFormBody(input: CalculateTotalsInput): string {
    const ratesPayload = input.rates.map((r) => ({
      addons: r.addons ?? [],
      adults: r.adults,
      kids: r.kids,
      rateId: r.rateId,
    }));

    const params = new URLSearchParams();
    params.set('lang', input.lang);
    params.set('data[checkIn]', input.checkin);
    params.set('data[checkOut]', input.checkout);
    params.set('data[currency]', input.currencyCode);
    params.set('data[rates]', JSON.stringify(ratesPayload));
    params.set('property_id', input.propertyExternalId);
    return params.toString();
  }

  private normalizeTotals(
    input: CalculateTotalsInput,
    data: RawTotalsData,
    httpStatus: number,
    durationMs: number,
  ): CalculateTotalsResult {
    const rooms: TotalsRoomBreakdown[] = (data.rooms ?? []).map((r) => ({
      name: r.name ?? '',
      rateId: r.rateId != null ? String(r.rateId) : null,
      adults: this.numberOr(r.adults, 0),
      kids: this.numberOr(r.kids, 0),
      count: this.numberOr(r.count, 1),
      isPrivate: Boolean(r.isPrivate),
      rateWithoutInclusiveTaxAndFees:
        typeof r.rateWithoutInclusiveTaxAndFees === 'number'
          ? r.rateWithoutInclusiveTaxAndFees
          : null,
    }));

    return {
      propertyExternalId: input.propertyExternalId,
      checkin: data.checkIn ?? input.checkin,
      checkout: data.checkOut ?? input.checkout,
      currencyCode: input.currencyCode,
      days: this.numberOr(data.days, 0),
      rooms,
      subtotal: this.numberOr(data.total, 0),
      taxesTotal: this.numberOr(data.taxes?.total, 0),
      feesTotal: this.numberOr(data.fees?.total, 0),
      deposit: this.numberOr(data.deposit, 0),
      grandTotal: this.numberOr(data.grandTotal, 0),
      totalAdults: this.numberOr(data.totalAdults, 0),
      totalKids: this.numberOr(data.totalKids, 0),
      totalGuests: this.numberOr(data.totalGuests, 0),
      cntRooms: this.numberOr(data.cntRooms, 0),
      taxes: this.normalizeTaxFeeGroup(data.taxes),
      fees: this.normalizeTaxFeeGroup(data.fees),
      cartToken: data.cart_token ?? null,
      currencyRate: typeof data.currencyRate === 'number' ? data.currencyRate : null,
      raw: data,
      httpStatus,
      durationMs,
    };
  }

  private normalizeTaxFeeGroup(group: RawTaxFeeGroup | null | undefined): TotalsTaxOrFee[] {
    if (!group?.data) return [];
    return group.data.map((item) => ({
      id: item.id != null ? String(item.id) : null,
      name: item.name ?? '',
      amount: this.numberOr(item.credit, 0),
    }));
  }

  private numberOr(value: number | string | null | undefined, fallback: number): number {
    if (value === null || value === undefined) return fallback;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  // Prepare helpers.

  buildPrepareFormBody(input: PrepareBookingInput): string {
    const roomsPayload = input.rooms.reduce<Record<string, Array<{
      addons: unknown[];
      adults: string;
      kids: string;
    }>>>((acc, room) => {
      const list = acc[room.rateId] ?? [];
      list.push({
        addons: room.addons ?? [],
        adults: String(room.adults),
        kids: String(room.kids),
      });
      acc[room.rateId] = list;
      return acc;
    }, {});

    const params = new URLSearchParams();
    params.set('widget_property', input.propertyExternalId);
    params.set('lang', input.lang);
    params.set('selected_checkin', input.checkin);
    params.set('selected_checkout', input.checkout);
    params.set('rooms', JSON.stringify(roomsPayload));
    params.set('agree', '1');
    params.set('currency', input.currencyCode);
    params.set('cart_token', input.cartToken);
    params.set('first_name', input.firstName);
    params.set('last_name', input.lastName);
    params.set('email', input.email);
    params.set('phone', input.phone);
    params.set('country', input.country);
    params.set('booking_estimated_arrival_time', String(input.bookingEstimatedArrivalTime));
    params.set('payment_sdk', String(input.paymentSdk));
    params.set('cfarOffersPresented', String(input.cfarOffersPresented));
    if (input.sessionId) params.set('sessionId', input.sessionId);
    params.set('booking_engine_source', input.bookingEngineSource);
    params.set('iframe', String(input.iframe));
    return params.toString();
  }

  private normalizePrepare(
    input: PrepareBookingInput,
    raw: RawCloudbedsPrepareResponse,
    httpStatus: number,
    durationMs: number,
  ): PrepareBookingResult {
    const hasEncryptedId = Boolean(raw.enc_res_id?.trim());
    const bookingId = raw.id ?? raw.reservation_id;

    return {
      propertyExternalId: input.propertyExternalId,
      checkin: input.checkin,
      checkout: input.checkout,
      currencyCode: input.currencyCode,
      success: hasEncryptedId || raw.success !== false,
      cloudbedsSuccessFlag: raw.success !== false,
      reservationId: bookingId != null ? String(bookingId) : null,
      encryptedReservationId: raw.enc_res_id ?? null,
      customerId: raw.customer_id != null ? String(raw.customer_id) : null,
      status: raw.status ?? null,
      statusMessage: raw.statusMessage ?? raw.message ?? null,
      paymentUrl: raw.payment_url ?? null,
      raw,
      httpStatus,
      durationMs,
    };
  }
}
