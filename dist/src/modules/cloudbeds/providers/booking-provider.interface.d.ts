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
export interface CalculateTotalsRateInput {
    rateId: string;
    adults: number;
    kids: number;
    addons?: unknown[];
}
export interface CalculateTotalsInput {
    propertyExternalId: string;
    checkin: string;
    checkout: string;
    currencyCode: string;
    lang: string;
    rates: CalculateTotalsRateInput[];
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
    totalAdults: number;
    totalKids: number;
    totalGuests: number;
    cntRooms: number;
    taxes: TotalsTaxOrFee[];
    fees: TotalsTaxOrFee[];
    cartToken: string | null;
    currencyRate: number | null;
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
    calculateTotals(input: CalculateTotalsInput): Promise<CalculateTotalsResult>;
    buildReservationRedirectUrl(input: ReservationRedirectInput): string;
}
