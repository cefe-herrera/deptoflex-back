import {
  extractMercadoPagoWebhookEvent,
  validateMercadoPagoWebhookSignature,
} from './mercadopago-webhook.util';

describe('extractMercadoPagoWebhookEvent', () => {
  it('parses IPN query params for payment', () => {
    expect(extractMercadoPagoWebhookEvent(
      { topic: 'payment', id: '12345' },
      {},
    )).toEqual({ type: 'payment', resourceId: '12345' });
  });

  it('parses Webhooks v2 JSON body', () => {
    expect(extractMercadoPagoWebhookEvent(
      {},
      { type: 'payment', data: { id: '999' } },
    )).toEqual({ type: 'payment', resourceId: '999' });
  });

  it('parses merchant_order notifications', () => {
    expect(extractMercadoPagoWebhookEvent(
      {},
      { type: 'merchant_order', data: { id: '555' } },
    )).toEqual({ type: 'merchant_order', resourceId: '555' });
  });

  it('returns null when event is incomplete', () => {
    expect(extractMercadoPagoWebhookEvent({}, {})).toBeNull();
    expect(extractMercadoPagoWebhookEvent({ type: 'payment' }, {})).toBeNull();
  });
});

describe('validateMercadoPagoWebhookSignature', () => {
  it('accepts when secret is empty (dev mode)', () => {
    expect(validateMercadoPagoWebhookSignature({}, '123', '')).toBe(true);
  });

  it('rejects missing x-signature when secret is set', () => {
    expect(validateMercadoPagoWebhookSignature({}, '123', 'secret')).toBe(false);
  });
});
