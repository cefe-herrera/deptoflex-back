import { createHmac, timingSafeEqual } from 'crypto';

export interface MercadoPagoWebhookHeaders {
  xSignature?: string;
  xRequestId?: string;
}

export interface MercadoPagoWebhookEvent {
  type: string;
  resourceId: string;
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Validates Mercado Pago webhook x-signature per official manifest format:
 * id:[data.id];request-id:[x-request-id];ts:[ts];
 * @see https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
 */
export function validateMercadoPagoWebhookSignature(
  headers: MercadoPagoWebhookHeaders,
  dataId: string | undefined,
  secret: string,
): boolean {
  if (!secret) return true;

  const xSignature = headers.xSignature?.trim();
  if (!xSignature) return false;

  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of xSignature.split(',')) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key === 'ts') ts = value;
    if (key === 'v1') v1 = value;
  }
  if (!ts || !v1) return false;

  const manifestParts: string[] = [];
  if (dataId) manifestParts.push(`id:${dataId.toLowerCase()}`);
  if (headers.xRequestId) manifestParts.push(`request-id:${headers.xRequestId}`);
  manifestParts.push(`ts:${ts}`);
  const manifest = `${manifestParts.join(';')};`;

  const computed = createHmac('sha256', secret).update(manifest).digest('hex');
  return safeEqualStrings(computed, v1);
}

/** Normalizes MP webhook payloads from query (IPN) or JSON body (Webhooks v2). */
export function extractMercadoPagoWebhookEvent(
  query: Record<string, string | undefined>,
  body: unknown,
): MercadoPagoWebhookEvent | null {
  const record = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};

  const rawType = query.type ?? query.topic
    ?? (typeof record.type === 'string' ? record.type : undefined)
    ?? (typeof record.topic === 'string' ? record.topic : undefined)
    ?? (typeof record.action === 'string' ? record.action.split('.')[0] : undefined);

  const type = String(rawType ?? '').trim().toLowerCase();
  if (!type) return null;

  let resourceId = query['data.id'] ?? query.id ?? '';

  if (!resourceId && record.data && typeof record.data === 'object') {
    const data = record.data as Record<string, unknown>;
    if (data.id != null) resourceId = String(data.id);
  }
  if (!resourceId && record.id != null && type !== 'payment') {
    resourceId = String(record.id);
  }

  resourceId = resourceId.trim();
  if (!resourceId) return null;

  return { type, resourceId };
}
