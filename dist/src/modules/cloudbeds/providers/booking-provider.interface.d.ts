export interface SearchAvailabilityInput {
    propertyExternalId: string;
    checkin: string;
    checkout: string;
    currencyCode: string;
    lang: string;
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
    meta?: Record<string, unknown>;
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
export declare const BOOKING_PROVIDER: unique symbol;
export interface BookingProvider {
    readonly providerName: string;
    searchAvailability(input: SearchAvailabilityInput): Promise<AvailabilityResult>;
    buildReservationRedirectUrl(input: ReservationRedirectInput): string;
}
