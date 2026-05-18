import { AvailabilityResult, BookingProvider, ReservationRedirectInput, SearchAvailabilityInput } from './booking-provider.interface';
import { type RawCloudbedsResponse } from './cloudbeds-response.schema';
export declare class CloudbedsPublicBookingProvider implements BookingProvider {
    readonly providerName = "cloudbeds-public";
    private readonly logger;
    private readonly endpoint;
    private readonly reservationBaseUrl;
    private readonly userAgent;
    private readonly timeoutMs;
    searchAvailability(input: SearchAvailabilityInput): Promise<AvailabilityResult>;
    private httpPost;
    buildReservationRedirectUrl(input: ReservationRedirectInput): string;
    buildFormBody(input: SearchAvailabilityInput): string;
    normalize(input: SearchAvailabilityInput, raw: RawCloudbedsResponse, httpStatus: number, durationMs: number): AvailabilityResult;
    private normalizeRoom;
    private findOtaComparison;
    private toNumber;
}
