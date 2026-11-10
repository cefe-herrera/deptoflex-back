import type { Request } from 'express';

/** Cliente autenticado por API key, adjuntado al request por `ApiKeyGuard`. */
export interface ApiClientContext {
  clientId: string;
  clientName: string;
  apiKeyId: string;
  /** null = sin límite de consumo. */
  rpmLimit: number | null;
}

/**
 * Datos que el handler deja en el request para que `ApiUsageInterceptor`
 * los persista junto con el evento de uso.
 */
export interface ApiUsageMeta {
  propertyId?: string;
  checkin?: string;
  checkout?: string;
  cacheHit?: boolean;
  totalAvailable?: number;
}

export interface PartnerRequest extends Request {
  apiClient?: ApiClientContext;
  apiUsage?: ApiUsageMeta;
}

export const API_KEY_HEADER = 'x-api-key';
