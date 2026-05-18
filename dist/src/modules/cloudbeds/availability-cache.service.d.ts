import type { AvailabilityResult } from './providers/booking-provider.interface';
export declare class AvailabilityCacheService {
    private readonly store;
    private readonly defaultTtlMs;
    buildKey(parts: {
        propertyId: string;
        checkin: string;
        checkout: string;
        currencyCode: string;
        lang: string;
    }): string;
    get(key: string): AvailabilityResult | null;
    set(key: string, value: AvailabilityResult, ttlMs?: number): void;
    invalidate(key: string): void;
    prune(): void;
}
