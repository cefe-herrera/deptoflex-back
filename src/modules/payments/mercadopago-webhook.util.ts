import { createHmac, timingSafeEqual } from 'crypto';

export interface MercadoPagoWebhookHeaders {
  xSignature?: string;
  xRequestId?: string;
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
