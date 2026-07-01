import { Module, forwardRef } from '@nestjs/common';
import { FlexBookingsModule } from '../flex-bookings/flex-bookings.module';
import { EmailModule } from '../email/email.module';
import { MercadoPagoService } from './mercadopago.service';
import { FlexBookingPaymentsService } from './flex-booking-payments.service';
import { FlexBookingPaymentsReconcileJob } from './flex-booking-payments-reconcile.job';
import { PaymentsWebhookController, PublicFlexPaymentsController } from './payments.controller';

@Module({
  imports: [forwardRef(() => FlexBookingsModule), EmailModule],
  controllers: [PaymentsWebhookController, PublicFlexPaymentsController],
  providers: [MercadoPagoService, FlexBookingPaymentsService, FlexBookingPaymentsReconcileJob],
  exports: [MercadoPagoService, FlexBookingPaymentsService],
})
export class PaymentsModule {}
