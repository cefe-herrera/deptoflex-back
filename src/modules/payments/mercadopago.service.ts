import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, MerchantOrder, Payment, Preference } from 'mercadopago';

export interface CreateFlexCheckoutInput {
  flexBookingId: string;
  title: string;
  amount: number;
  currency: string;
  payerEmail?: string | null;
  backUrlBase: string;
  expirationDays: number;
}

export interface FlexCheckoutResult {
  preferenceId: string;
  checkoutUrl: string;
  sandboxCheckoutUrl: string | null;
  expiresAt: Date;
}

export interface MercadoPagoPaymentInfo {
  id: string;
  status: string;
  externalReference: string | null;
  transactionAmount: number;
  currencyId: string;
}

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private client: MercadoPagoConfig | null = null;

  constructor(private config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.getAccessToken());
  }

  private getAccessToken(): string {
    return this.config.get<string>('mercadopago.accessToken') ?? '';
  }

  private getClient(): MercadoPagoConfig {
    if (!this.client) {
      const accessToken = this.getAccessToken();
      if (!accessToken) {
        throw new Error('MERCADOPAGO_ACCESS_TOKEN is not configured');
      }
      this.client = new MercadoPagoConfig({ accessToken });
    }
    return this.client;
  }

  async createFlexCheckout(input: CreateFlexCheckoutInput): Promise<FlexCheckoutResult> {
    const client = this.getClient();
    const preference = new Preference(client);
    const appUrl = this.config.get<string>('app.url') ?? 'http://localhost:3000';
    const notificationUrl = `${appUrl.replace(/\/$/, '')}/api/v1/webhooks/mercadopago`;

    const expiresAt = new Date(Date.now() + input.expirationDays * 24 * 60 * 60 * 1000);
    const backUrl = input.backUrlBase.replace(/\/$/, '');
    const response = await preference.create({
      body: {
        items: [
          {
            id: input.flexBookingId,
            title: input.title.slice(0, 256),
            quantity: 1,
            unit_price: input.amount,
            currency_id: input.currency,
          },
        ],
        payer: input.payerEmail ? { email: input.payerEmail } : undefined,
        external_reference: input.flexBookingId,
        notification_url: notificationUrl,
        back_urls: {
          success: `${backUrl}?status=success`,
          failure: `${backUrl}?status=failure`,
          pending: `${backUrl}?status=pending`,
        },
        auto_return: 'approved',
        date_of_expiration: expiresAt.toISOString(),
      },
    });

    const preferenceId = String(response.id ?? '');
    const checkoutUrl = response.init_point ?? '';
    const sandboxCheckoutUrl = response.sandbox_init_point ?? null;

    if (!preferenceId || !checkoutUrl) {
      this.logger.error(`Invalid MP preference response for booking ${input.flexBookingId}`);
      throw new Error('Mercado Pago did not return a checkout URL');
    }

    return { preferenceId, checkoutUrl, sandboxCheckoutUrl, expiresAt };
  }

  async getPayment(paymentId: string): Promise<MercadoPagoPaymentInfo> {
    const client = this.getClient();
    const paymentClient = new Payment(client);
    const raw = await paymentClient.get({ id: paymentId });

    return {
      id: String(raw.id ?? paymentId),
      status: String(raw.status ?? ''),
      externalReference: raw.external_reference != null ? String(raw.external_reference) : null,
      transactionAmount: Number(raw.transaction_amount ?? 0),
      currencyId: String(raw.currency_id ?? 'ARS'),
    };
  }

  async searchPaymentsByExternalReference(externalReference: string): Promise<MercadoPagoPaymentInfo[]> {
    const client = this.getClient();
    const paymentClient = new Payment(client);
    const response = await paymentClient.search({
      options: {
        external_reference: externalReference,
        sort: 'date_created',
        criteria: 'desc',
      },
    });

    return (response.results ?? []).map((raw) => ({
      id: String(raw.id ?? ''),
      status: String(raw.status ?? ''),
      externalReference: raw.external_reference != null ? String(raw.external_reference) : null,
      transactionAmount: Number(raw.transaction_amount ?? 0),
      currencyId: String(raw.currency_id ?? 'ARS'),
    })).filter((p) => p.id);
  }

  async getMerchantOrderPaymentIds(merchantOrderId: string): Promise<string[]> {
    const client = this.getClient();
    const merchantOrderClient = new MerchantOrder(client);
    const order = await merchantOrderClient.get({ merchantOrderId });
    return (order.payments ?? [])
      .map((p) => (p.id != null ? String(p.id) : ''))
      .filter(Boolean);
  }
}
