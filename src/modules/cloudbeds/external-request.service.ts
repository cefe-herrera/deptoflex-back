import { Injectable, Logger } from '@nestjs/common';
import {
  ExternalRequestProvider,
  ExternalRequestType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ExternalRequestLogContext } from './external-request.types';

const SENSITIVE_KEYS = new Set([
  'email',
  'phone',
  'first_name',
  'last_name',
  'firstname',
  'lastname',
  'cart_token',
  'cartToken',
  'data_res',
  'dataRes',
  'session_id',
  'sessionId',
]);

const RESPONSE_MAX_CHARS = Number(process.env.EXTERNAL_REQUEST_RESPONSE_MAX_CHARS ?? 32_000);

export interface RecordExternalRequestParams {
  type: ExternalRequestType;
  endpoint: string;
  method: 'GET' | 'POST';
  request: Record<string, unknown> | string;
  responseText?: string;
  httpStatus?: number;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
  logContext?: ExternalRequestLogContext;
}

@Injectable()
export class ExternalRequestService {
  private readonly logger = new Logger(ExternalRequestService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persiste un log de request externa. Fire-and-forget: nunca bloquea ni
   * falla el flujo principal del usuario.
   */
  record(params: RecordExternalRequestParams): void {
    void this.persist(params).catch((err) => {
      this.logger.warn(
        `Failed to persist external request log: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  private async persist(params: RecordExternalRequestParams): Promise<void> {
    const requestJson = this.normalizeRequest(params.request);
    const responseJson = this.parseResponse(params.responseText);

    await this.prisma.externalRequest.create({
      data: {
        provider: ExternalRequestProvider.CLOUDBEDS,
        type: params.type,
        endpoint: params.endpoint,
        method: params.method,
        requestJson: requestJson as Prisma.InputJsonValue,
        responseJson: responseJson as Prisma.InputJsonValue | undefined,
        httpStatus: params.httpStatus ?? null,
        durationMs: params.durationMs ?? null,
        success: params.success,
        errorMessage: params.errorMessage ?? null,
        userId: params.logContext?.userId ?? null,
        propertyId: params.logContext?.propertyId ?? null,
        ipAddress: params.logContext?.ipAddress ?? null,
        userAgent: params.logContext?.userAgent ?? null,
      },
    });
  }

  /** Convierte form-urlencoded o objeto a JSON redactado. */
  formBodyToJson(body: string): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    try {
      const params = new URLSearchParams(body);
      params.forEach((value, key) => {
        obj[key] = value;
      });
    } catch {
      obj.raw = body.slice(0, 2_000);
    }
    return this.redact(obj);
  }

  private normalizeRequest(request: Record<string, unknown> | string): Record<string, unknown> {
    if (typeof request === 'string') {
      return this.formBodyToJson(request);
    }
    return this.redact(request);
  }

  private parseResponse(text?: string): Record<string, unknown> | null {
    if (!text) return null;
    const truncated =
      text.length > RESPONSE_MAX_CHARS
        ? `${text.slice(0, RESPONSE_MAX_CHARS)}… [truncated]`
        : text;

    try {
      const parsed = JSON.parse(truncated);
      if (parsed && typeof parsed === 'object') {
        return this.redact(parsed as Record<string, unknown>);
      }
      return { value: parsed };
    } catch {
      return { raw: truncated };
    }
  }

  private redact(value: unknown): Record<string, unknown> {
    if (value == null || typeof value !== 'object') {
      return { value: value as unknown };
    }
    if (Array.isArray(value)) {
      return { items: value.map((item) => this.redactValue(item)) };
    }

    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = this.redactValue(val, key);
    }
    return out;
  }

  private redactValue(value: unknown, key?: string): unknown {
    const normalizedKey = key?.toLowerCase().replace(/-/g, '_') ?? '';
    if (SENSITIVE_KEYS.has(key ?? '') || SENSITIVE_KEYS.has(normalizedKey)) {
      if (typeof value === 'string') {
        if (normalizedKey.includes('token') || normalizedKey.includes('data_res')) {
          return `[redacted len=${value.length}]`;
        }
        return '[redacted]';
      }
      return '[redacted]';
    }

    if (value != null && typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map((item) => this.redactValue(item));
      }
      return this.redact(value);
    }

    return value;
  }
}
