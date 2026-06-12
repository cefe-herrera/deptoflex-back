import { Module } from '@nestjs/common';
import { FlexBookingsController } from './flex-bookings.controller';
import { FlexBookingsService } from './flex-bookings.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { PropertyFlexModule } from '../property-flex/property-flex.module';

@Module({
  imports: [NotificationsModule, CommissionsModule, PropertyFlexModule],
  controllers: [FlexBookingsController],
  providers: [FlexBookingsService],
  exports: [FlexBookingsService],
})
export class FlexBookingsModule {}
