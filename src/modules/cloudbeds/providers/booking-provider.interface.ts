/**
 * BookingProvider — abstraction over any booking-engine integration.
 *
 * Designed so the current `CloudbedsPublicBookingProvider` (which scrapes the
 * public widget endpoint) can be swapped for a future
 * `CloudbedsOfficialApiProvider` (or a different PMS provider) with zero
 * changes to consumer code.
 */

export interface SearchAvailabilityInput {
  /** External property identifier (e.g. Cloudbeds widget_property). */
  propertyExternalId: string;
  /** ISO-8601 date (YYYY-MM-DD). */
  checkin: string;
  /** ISO-8601 date (YYYY-MM-DD), must be > checkin. */
  checkout: string;
  /** ISO 4217 currency code. */
  currencyCode: string;
  /** Language code (e.g. 'es', 'en'). */
  lang: string;
  /** Optional adults/children for providers that support occupancy in search. */
  adults?: number;
  children?: number;
}

export interface NightlyRate {
  date: string;
  rate: number;
  baseRate: number;
}

export interface OtaRateComparison {
  channelName: string;
  channelPrice: number;
  directPrice: number;
}

export interface AvailableRoom {
  roomTypeId: string;
  rateId: string | null;
  name: string;
  title: string;
  descriptionHtml: string | null;
  maxGuests: number | null;
  maxAdults: number | null;
  maxChildren: number | null;
  remaining: number;
  totalRooms: number;
  totalAmount: number | null;
  minNightlyRate: number | null;
  maxNightlyRate: number | null;
  detailedRates: NightlyRate[];
  photos: string[];
  featuredPhoto: string | null;
  features: string[];
  unitIds: string[];
  otaComparison?: OtaRateComparison[];
}

export interface AvailabilityResult {
  propertyExternalId: string;
  checkin: string;
  checkout: string;
  currencyCode: string;
  totalAvailable: number;
  rooms: AvailableRoom[];
  /** Optional metadata returned by the provider (websiteSourceId, etc.). */
  meta?: Record<string, unknown>;
  /** Raw response for snapshot/auditing. Provider-specific shape. */
  raw: unknown;
  httpStatus: number;
  durationMs: number;
}

export interface ReservationRedirectInput {
  propertyExternalId: string;
  bookingSlug: string | null;
  checkin: string;
  checkout: string;
  currencyCode: string;
  lang: string;
  roomTypeId: string;
  rateId?: string | null;
  adults?: number;
  children?: number;
}

export const BOOKING_PROVIDER = Symbol('BOOKING_PROVIDER');

export interface BookingProvider {
  /** Identifier for logging/snapshots (e.g. 'cloudbeds-public'). */
  readonly providerName: string;

  searchAvailability(input: SearchAvailabilityInput): Promise<AvailabilityResult>;

  buildReservationRedirectUrl(input: ReservationRedirectInput): string;
}
