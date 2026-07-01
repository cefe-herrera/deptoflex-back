import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FlexBookingPaymentsService } from './flex-booking-payments.service';
import { MercadoPagoService } from './mercadopago.service';

@Injectable()
export class FlexBookingPaymentsReconcileJob {
  private readonly logger = new Logger(FlexBookingPaymentsReconcileJob.name);

  constructor(
    private mercadoPago: MercadoPagoService,
    private payments: FlexBookingPaymentsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcilePendingFlexPayments() {
    if (!this.mercadoPago.isConfigured()) return;

    try {
      const result = await this.payments.reconcilePendingPayments();
      if (result.processed > 0) {
        this.logger.log(`Reconciled ${result.processed} flex booking payment(s) via Mercado Pago`);
      }
    } catch (err) {
      this.logger.error('Flex booking payment reconciliation failed', err);
    }
  }
}
