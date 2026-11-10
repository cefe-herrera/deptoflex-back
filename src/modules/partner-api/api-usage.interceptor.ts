import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiUsageService } from './api-usage.service';
import { endpointOf } from './guards/api-key.guard';
import type { PartnerRequest } from './partner-api.types';

/**
 * Registra un ApiUsageEvent por cada request autenticada (éxito o error).
 * Los rechazos del guard (401/429) no pasan por acá: el 429 lo registra el guard.
 */
@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  constructor(private readonly usage: ApiUsageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<PartnerRequest>();
    const res = http.getResponse<Response>();
    const started = Date.now();

    const record = (statusCode: number, errorMessage?: string) => {
      const client = req.apiClient;
      if (!client) return;
      const meta = req.apiUsage ?? {};
      this.usage.record({
        clientId: client.clientId,
        apiKeyId: client.apiKeyId,
        endpoint: endpointOf(req),
        method: req.method,
        statusCode,
        durationMs: Date.now() - started,
        ...meta,
        errorMessage,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    };

    return next.handle().pipe(
      tap(() => record(res.statusCode)),
      catchError((err: unknown) => {
        const status = err instanceof HttpException ? err.getStatus() : 500;
        const message = err instanceof Error ? err.message : String(err);
        record(status, message);
        return throwError(() => err);
      }),
    );
  }
}
