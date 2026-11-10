import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiKeysService } from '../api-keys.service';
import {
  ApiRateLimiterService,
  MAX_FAILED_AUTH_PER_MINUTE,
} from '../api-rate-limiter.service';
import { ApiUsageService } from '../api-usage.service';
import { API_KEY_HEADER, type PartnerRequest } from '../partner-api.types';

/** Ruta del endpoint sin el prefijo global, para métricas (ej. "/partner/availability"). */
export function endpointOf(req: PartnerRequest): string {
  const route = req.route as { path?: string } | undefined;
  const path = route?.path ?? req.path;
  return path.replace(/^\/api\/v\d+/, '');
}

/**
 * Autentica requests de terceros por header `X-Api-Key` y aplica el límite de
 * requests por minuto del cliente. Se usa junto con `@Public()` (vía
 * `@ApiKeyAuth()`) para que el JwtAuthGuard global no exija JWT.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly keys: ApiKeysService,
    private readonly limiter: ApiRateLimiterService,
    private readonly usage: ApiUsageService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<PartnerRequest>();
    const res = http.getResponse<Response>();
    const ip = req.ip ?? 'unknown';
    const failBucket = `auth-fail:${ip}`;

    if (this.limiter.isBlocked(failBucket, MAX_FAILED_AUTH_PER_MINUTE)) {
      throw new HttpException(
        'Demasiados intentos con API key inválida',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const header = req.headers[API_KEY_HEADER];
    const rawKey = (Array.isArray(header) ? header[0] : header)?.trim();
    if (!rawKey) {
      this.limiter.hit(failBucket, MAX_FAILED_AUTH_PER_MINUTE);
      throw new UnauthorizedException('Falta el header X-Api-Key');
    }

    const client = await this.keys.validate(rawKey, ip);
    if (!client) {
      this.limiter.hit(failBucket, MAX_FAILED_AUTH_PER_MINUTE);
      throw new UnauthorizedException('API key inválida, revocada o vencida');
    }

    // Sin rpmLimit configurado el cliente no tiene límite de consumo.
    if (client.rpmLimit == null) {
      req.apiClient = client;
      return true;
    }

    const rl = this.limiter.hit(`client:${client.clientId}`, client.rpmLimit);
    res.setHeader('X-RateLimit-Limit', rl.limit);
    res.setHeader('X-RateLimit-Remaining', rl.remaining);
    res.setHeader('X-RateLimit-Reset', rl.resetInSeconds);

    if (!rl.allowed) {
      res.setHeader('Retry-After', rl.resetInSeconds);
      this.usage.record({
        clientId: client.clientId,
        apiKeyId: client.apiKeyId,
        endpoint: endpointOf(req),
        method: req.method,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: 0,
        errorMessage: 'Rate limit excedido',
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      });
      throw new HttpException(
        `Límite de ${rl.limit} requests por minuto excedido`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    req.apiClient = client;
    return true;
  }
}
