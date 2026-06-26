import { Injectable } from '@nestjs/common';
import type { AvailabilityResult } from './providers/booking-provider.interface';

interface CacheEntry {
  value: AvailabilityResult;
  expiresAt: number;
}

/**
 * In-memory TTL cache for availability searches.
 *
 * Sufficient for an MVP. Replace with Redis (cache-manager) when running
 * multi-instance.
 */
@Injectable()
export class AvailabilityCacheService {
  private readonly store = new Map<string, CacheEntry>();

  /** Default TTL in milliseconds. Configurable via env. */
  private readonly defaultTtlMs = Number(
    process.env.CLOUDBEDS_CACHE_TTL_MS ?? 5 * 60 * 1000, // 5 min
  );

  buildKey(parts: {
    propertyId: string;
    checkin: string;
    checkout: string;
    currencyCode: string;
    lang: string;
  }): string {
    return [parts.propertyId, parts.checkin, parts.checkout, parts.currencyCode, parts.lang].join('|');
  }

  get(key: string): AvailabilityResult | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      return null;
    }
    return entry.value;
  }

  /** Returns expired cache entries as a last-resort fallback when Cloudbeds is unavailable. */
  getStale(key: string, maxStaleMs: number = 24 * 60 * 60 * 1000): AvailabilityResult | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt + maxStaleMs < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: AvailabilityResult, ttlMs: number = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Periodically clean expired entries to bound memory. */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt < now) this.store.delete(key);
    }
  }
}
