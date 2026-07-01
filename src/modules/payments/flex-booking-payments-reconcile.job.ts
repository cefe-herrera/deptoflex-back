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

    this.logger.log('Starting flex payment reconciliation…');
    try {
      const result = await this.payments.reconcilePendingPayments();
      this.logger.log(`Reconciliation finished processed=${result.processed}`);
    } catch (err) {
      this.logger.error('Flex booking payment reconciliation failed', err);
    }
  }
}
