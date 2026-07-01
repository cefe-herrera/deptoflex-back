import { registerAs } from '@nestjs/config';

export default registerAs('mercadopago', () => ({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
  webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '',
  paymentLinkExpirationDays: parseInt(
    process.env.MERCADOPAGO_PAYMENT_LINK_EXPIRATION_DAYS ?? '7',
    10,
  ),
}));
