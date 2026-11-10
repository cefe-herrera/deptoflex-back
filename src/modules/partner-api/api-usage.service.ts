import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordUsageInput {
  clientId: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  propertyId?: string;
  checkin?: string;
  checkout?: string;
  cacheHit?: boolean;
  totalAvailable?: number;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UsageSummaryQuery {
  clientId?: string;
  from: Date;
  to: Date;
}

const TIMEZONE = 'America/Argentina/Buenos_Aires';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class ApiUsageService {
  private readonly logger = new Logger(ApiUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget: nunca rompe ni demora la respuesta al cliente. */
  record(input: RecordUsageInput): void {
    this.prisma.apiUsageEvent
      .create({
        data: {
          clientId: input.clientId,
          apiKeyId: input.apiKeyId,
          endpoint: input.endpoint.slice(0, 100),
          method: input.method.slice(0, 10),
          statusCode: input.statusCode,
          durationMs: Math.max(0, Math.round(input.durationMs)),
          propertyId:
            input.propertyId && UUID_RE.test(input.propertyId)
              ? input.propertyId
              : null,
          checkin:
            input.checkin && DATE_RE.test(input.checkin)
              ? new Date(input.checkin)
              : null,
          checkout:
            input.checkout && DATE_RE.test(input.checkout)
              ? new Date(input.checkout)
              : null,
          cacheHit: input.cacheHit ?? null,
          totalAvailable: input.totalAvailable ?? null,
          errorMessage: input.errorMessage?.slice(0, 500) ?? null,
          ipAddress: input.ipAddress?.slice(0, 45) ?? null,
          userAgent: input.userAgent?.slice(0, 500) ?? null,
        },
      })
      .catch((err) =>
        this.logger.error(`No se pudo registrar uso de API: ${err}`),
      );
  }

  /**
   * Métricas agregadas de uso. Sin `clientId` devuelve el global de todos los
   * clientes (incluye desglose por cliente).
   */
  async summary(q: UsageSummaryQuery) {
    const scope = (alias: string) => {
      const a = Prisma.raw(alias);
      return Prisma.sql`${a}created_at >= ${q.from} AND ${a}created_at < ${q.to}${
        q.clientId
          ? Prisma.sql` AND ${a}client_id = ${q.clientId}::uuid`
          : Prisma.empty
      }`;
    };
    const where = scope('');
    const whereE = scope('e.');

    const [totalsRows, byDay, byEndpoint, byKey, byProperty, byClient] =
      await Promise.all([
        this.prisma.$queryRaw<
          {
            requests: bigint;
            success: bigint;
            client_errors: bigint;
            server_errors: bigint;
            rate_limited: bigint;
            cache_hits: bigint;
            cacheable: bigint;
            avg_ms: number | null;
            p95_ms: number | null;
            zero_availability: bigint;
            availability_searches: bigint;
            avg_lead_days: number | null;
            avg_nights: number | null;
          }[]
        >`
        SELECT
          COUNT(*)                                                    AS requests,
          COUNT(*) FILTER (WHERE status_code < 400)                   AS success,
          COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500 AND status_code <> 429) AS client_errors,
          COUNT(*) FILTER (WHERE status_code >= 500)                  AS server_errors,
          COUNT(*) FILTER (WHERE status_code = 429)                   AS rate_limited,
          COUNT(*) FILTER (WHERE cache_hit = true)                    AS cache_hits,
          COUNT(*) FILTER (WHERE cache_hit IS NOT NULL)               AS cacheable,
          AVG(duration_ms)::float                                     AS avg_ms,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::float AS p95_ms,
          COUNT(*) FILTER (WHERE total_available = 0)                 AS zero_availability,
          COUNT(*) FILTER (WHERE total_available IS NOT NULL)         AS availability_searches,
          AVG(checkin - (created_at AT TIME ZONE ${TIMEZONE})::date) FILTER (WHERE checkin IS NOT NULL)::float AS avg_lead_days,
          AVG(checkout - checkin) FILTER (WHERE checkin IS NOT NULL AND checkout IS NOT NULL)::float AS avg_nights
        FROM api_usage_events
        WHERE ${where}
      `,
        this.prisma.$queryRaw<
          { day: Date; requests: bigint; errors: bigint }[]
        >`
        SELECT (created_at AT TIME ZONE ${TIMEZONE})::date AS day,
               COUNT(*) AS requests,
               COUNT(*) FILTER (WHERE status_code >= 400) AS errors
        FROM api_usage_events
        WHERE ${where}
        GROUP BY 1 ORDER BY 1
      `,
        this.prisma.$queryRaw<
          { endpoint: string; requests: bigint; errors: bigint }[]
        >`
        SELECT endpoint, COUNT(*) AS requests, COUNT(*) FILTER (WHERE status_code >= 400) AS errors
        FROM api_usage_events
        WHERE ${where}
        GROUP BY endpoint ORDER BY requests DESC
      `,
        this.prisma.$queryRaw<
          {
            api_key_id: string;
            name: string | null;
            prefix: string | null;
            requests: bigint;
          }[]
        >`
        SELECT e.api_key_id, k.name, k.prefix, COUNT(*) AS requests
        FROM api_usage_events e
        LEFT JOIN api_keys k ON k.id = e.api_key_id
        WHERE ${whereE}
        GROUP BY e.api_key_id, k.name, k.prefix ORDER BY requests DESC
      `,
        this.prisma.$queryRaw<
          {
            property_id: string;
            name: string | null;
            requests: bigint;
            zero_availability: bigint;
          }[]
        >`
        SELECT e.property_id, p.name, COUNT(*) AS requests,
               COUNT(*) FILTER (WHERE e.total_available = 0) AS zero_availability
        FROM api_usage_events e
        LEFT JOIN properties p ON p.id = e.property_id
        WHERE e.property_id IS NOT NULL AND ${whereE}
        GROUP BY e.property_id, p.name ORDER BY requests DESC LIMIT 20
      `,
        q.clientId
          ? Promise.resolve(
              [] as {
                client_id: string;
                name: string | null;
                requests: bigint;
              }[],
            )
          : this.prisma.$queryRaw<
              { client_id: string; name: string | null; requests: bigint }[]
            >`
            SELECT e.client_id, c.name, COUNT(*) AS requests
            FROM api_usage_events e
            LEFT JOIN api_clients c ON c.id = e.client_id
            WHERE ${whereE}
            GROUP BY e.client_id, c.name ORDER BY requests DESC
          `,
      ]);

    const t = totalsRows[0];
    const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
    const ratio = (a: number, b: number) =>
      b > 0 ? Math.round((a / b) * 1000) / 1000 : null;
    const round = (v: number | null) =>
      v == null ? null : Math.round(v * 10) / 10;

    return {
      range: {
        from: q.from.toISOString(),
        to: q.to.toISOString(),
        timezone: TIMEZONE,
      },
      totals: {
        requests: n(t?.requests),
        success: n(t?.success),
        clientErrors: n(t?.client_errors),
        serverErrors: n(t?.server_errors),
        rateLimited: n(t?.rate_limited),
        cacheHitRate: ratio(n(t?.cache_hits), n(t?.cacheable)),
        /** Requests que efectivamente consultaron a Cloudbeds (cache miss). */
        upstreamCalls: n(t?.cacheable) - n(t?.cache_hits),
        avgDurationMs: round(t?.avg_ms ?? null),
        p95DurationMs: round(t?.p95_ms ?? null),
        zeroAvailabilityRate: ratio(
          n(t?.zero_availability),
          n(t?.availability_searches),
        ),
        /** Días promedio entre la consulta y el checkin buscado. */
        avgLeadDays: round(t?.avg_lead_days ?? null),
        avgNights: round(t?.avg_nights ?? null),
      },
      byDay: byDay.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        requests: n(r.requests),
        errors: n(r.errors),
      })),
      byEndpoint: byEndpoint.map((r) => ({
        endpoint: r.endpoint,
        requests: n(r.requests),
        errors: n(r.errors),
      })),
      byKey: byKey.map((r) => ({
        apiKeyId: r.api_key_id,
        name: r.name,
        prefix: r.prefix,
        requests: n(r.requests),
      })),
      topProperties: byProperty.map((r) => ({
        propertyId: r.property_id,
        name: r.name,
        requests: n(r.requests),
        zeroAvailability: n(r.zero_availability),
      })),
      ...(q.clientId
        ? {}
        : {
            byClient: byClient.map((r) => ({
              clientId: r.client_id,
              name: r.name,
              requests: n(r.requests),
            })),
          }),
    };
  }
}
