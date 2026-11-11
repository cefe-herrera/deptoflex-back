/**
 * BookingProvider — abstraction over any booking-engine integration.
 *
 * Designed so the current `CloudbedsPublicBookingProvider` (which scrapes the
 * public widget endpoint) can be swapped for a future
 * `CloudbedsOfficialApiProvider` (or a different PMS provider) with zero
 * changes to consumer code.
 */

import type { ExternalRequestLogContext } from '../external-request.types';

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
  /** Contexto de auditoría (usuario, propiedad local, IP). */
  logContext?: ExternalRequestLogContext;
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

/** Plan tarifario («oferta») de Cloudbeds: No Reembolsable, con desayuno, etc. */
export interface RatePlan {
  /** true si es un paquete/oferta; false para la tarifa estándar. */
  isPackage: boolean;
  packageId: string | null;
  /** Nombre visible para el huésped («No Reembolsable», «Tarifa estándar»). */
  name: string;
  /** Descripción del plan (HTML del operador — sanitizar antes de renderizar). */
  descriptionHtml: string | null;
  /** Condiciones del plan (HTML del operador — sanitizar antes de renderizar). */
  termsHtml: string | null;
  imageUrl: string | null;
  /**
   * Subtotal sin el descuento/suplemento del plan (suma de base_rate). Sólo se
   * informa si difiere de `totalAmount` (p. ej. 60.000 tachado → 57.000).
   */
  baseTotalAmount: number | null;
}

export interface AvailableRoom {
  roomTypeId: string;
  rateId: string | null;
  ratePlan: RatePlan;
  name: string;
  title: string;
  descriptionHtml: string | null;
  maxGuests: number | null;
  maxAdults: number | null;
  maxChildren: number | null;
  remaining: number;
  totalRooms: number;
  /**
   * Subtotal de la estadía para UNA unidad del plan (`rateId`): suma de
   * `detailed_rates[].rate`. No incluye impuestos ni tasas cobrados aparte.
   */
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

export interface CalculateTotalsRateInput {
  rateId: string;
  adults: number;
  kids: number;
  /** Optional add-ons; provider-specific opaque shape. */
  addons?: unknown[];
}

export interface CalculateTotalsInput {
  propertyExternalId: string;
  checkin: string;
  checkout: string;
  currencyCode: string;
  lang: string;
  rates: CalculateTotalsRateInput[];
  logContext?: ExternalRequestLogContext;
}

export interface TotalsTaxOrFee {
  id: string | null;
  name: string;
  amount: number;
}

export interface TotalsRoomBreakdown {
  name: string;
  rateId: string | null;
  adults: number;
  kids: number;
  count: number;
  isPrivate: boolean;
  rateWithoutInclusiveTaxAndFees: number | null;
}

/**
 * - `FINAL`: `grandTotal` es el precio final de la estadía según el carrito de
 *   Cloudbeds (misma selección y desglose consistente).
 * - `SUBTOTAL`: no se pudo confirmar; mostrar `subtotal` como «Subtotal».
 */
export type TotalsPriceStatus = 'FINAL' | 'SUBTOTAL';

export interface CalculateTotalsResult {
  propertyExternalId: string;
  checkin: string;
  checkout: string;
  currencyCode: string;
  days: number;
  rooms: TotalsRoomBreakdown[];
  subtotal: number;
  taxesTotal: number;
  feesTotal: number;
  deposit: number;
  grandTotal: number;
  priceStatus: TotalsPriceStatus;
  /** Motivo cuando `priceStatus = SUBTOTAL`: missing_totals | selection_mismatch | breakdown_mismatch. */
  priceStatusReason: string | null;
  totalAdults: number;
  totalKids: number;
  totalGuests: number;
  cntRooms: number;
  taxes: TotalsTaxOrFee[];
  fees: TotalsTaxOrFee[];
  /** Opaque token returned by Cloudbeds — required by downstream booking steps. */
  cartToken: string | null;
  currencyRate: number | null;
  raw: unknown;
  httpStatus: number;
  durationMs: number;
}

export interface PrepareBookingRoomInput {
  rateId: string;
  adults: number;
  kids: number;
  /** Optional add-ons; provider-specific opaque shape. */
  addons?: unknown[];
}

export interface PrepareBookingInput {
  propertyExternalId: string;
  checkin: string;
  checkout: string;
  currencyCode: string;
  lang: string;
  cartToken: string;
  rooms: PrepareBookingRoomInput[];
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  bookingEstimatedArrivalTime: number;
  sessionId?: string;
  paymentSdk: boolean;
  cfarOffersPresented: boolean;
  bookingEngineSource: string;
  iframe: boolean;
  logContext?: ExternalRequestLogContext;
}

export interface PrepareBookingResult {
  propertyExternalId: string;
  checkin: string;
  checkout: string;
  currencyCode: string;
  success: boolean;
  reservationId: string | null;
  encryptedReservationId: string | null;
  customerId: string | null;
  status: string | null;
  /** Cloudbeds may set success=false while still returning enc_res_id (e.g. payment pending). */
  cloudbedsSuccessFlag: boolean;
  statusMessage: string | null;
  paymentUrl: string | null;
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

export interface ConfirmationInput {
  /** Opaque `data_res` token from the Cloudbeds confirmation URL. */
  dataRes: string;
  logContext?: ExternalRequestLogContext;
}

export interface ConfirmationResult {
  /** Cloudbeds reservation identifier (numeric/string), if parseable. */
  reservationId: string | null;
  guestFirstName: string | null;
  guestLastName: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  /** ISO-8601 (YYYY-MM-DD) when parseable. */
  checkin: string | null;
  checkout: string | null;
  totalAmount: number | null;
  currencyCode: string | null;
  /** External property id (Cloudbeds widget_property), if present. */
  propertyExternalId: string | null;
  roomTypeId: string | null;
  status: string | null;
  /** Best-effort structured payload extracted from the page (if any). */
  parsed: Record<string, unknown> | null;
  /** Raw response text (truncated) for auditing. */
  raw: string;
  httpStatus: number;
  durationMs: number;
}

export const BOOKING_PROVIDER = Symbol('BOOKING_PROVIDER');

export interface BookingProvider {
  /** Identifier for logging/snapshots (e.g. 'cloudbeds-public'). */
  readonly providerName: string;

  searchAvailability(input: SearchAvailabilityInput): Promise<AvailabilityResult>;

  calculateTotals(input: CalculateTotalsInput): Promise<CalculateTotalsResult>;

  prepareBooking(input: PrepareBookingInput): Promise<PrepareBookingResult>;

  buildReservationRedirectUrl(input: ReservationRedirectInput): string;

  /**
   * Fetch and parse the Cloudbeds public confirmation page for a finalized
   * reservation (the `data_res` token returned in the confirmation URL).
   * Best-effort: callers must treat unparsed fields as null and rely on the
   * persisted intent for canonical data when possible.
   */
  getConfirmation(input: ConfirmationInput): Promise<ConfirmationResult>;
}
