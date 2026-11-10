import { Injectable } from '@nestjs/common';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Segundos hasta que se reinicia la ventana. */
  resetInSeconds: number;
}

const WINDOW_MS = 60_000;
/** Intentos con key inválida permitidos por IP y por minuto. */
export const MAX_FAILED_AUTH_PER_MINUTE = 30;

/**
 * Rate limiter de ventana fija por minuto, en memoria.
 *
 * Igual que el ThrottlerModule y el caché de disponibilidad, vive en memoria:
 * con más de una instancia del backend los límites son por instancia. Si se
 * escala horizontalmente, mover esto a Redis.
 */
@Injectable()
export class ApiRateLimiterService {
  private readonly windows = new Map<
    string,
    { start: number; count: number }
  >();
  private lastSweep = Date.now();

  /** Consume una unidad del bucket `key`. */
  hit(key: string, limit: number, now = Date.now()): RateLimitResult {
    this.sweep(now);
    let w = this.windows.get(key);
    if (!w || now - w.start >= WINDOW_MS) {
      w = { start: now, count: 0 };
      this.windows.set(key, w);
    }
    const resetInSeconds = Math.max(
      1,
      Math.ceil((w.start + WINDOW_MS - now) / 1000),
    );
    if (w.count >= limit) {
      return { allowed: false, limit, remaining: 0, resetInSeconds };
    }
    w.count++;
    return { allowed: true, limit, remaining: limit - w.count, resetInSeconds };
  }

  /** Consulta sin consumir. */
  isBlocked(key: string, limit: number, now = Date.now()): boolean {
    const w = this.windows.get(key);
    return !!w && now - w.start < WINDOW_MS && w.count >= limit;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < WINDOW_MS) return;
    this.lastSweep = now;
    for (const [key, w] of this.windows) {
      if (now - w.start >= WINDOW_MS) this.windows.delete(key);
    }
  }
}
