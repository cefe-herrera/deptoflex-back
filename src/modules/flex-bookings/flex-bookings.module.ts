import { Module } from '@nestjs/common';
import { FlexBookingsController } from './flex-bookings.controller';
import { FlexBookingsService } from './flex-bookings.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [FlexBookingsController],
  providers: [FlexBookingsService],
  exports: [FlexBookingsService],
})
export class FlexBookingsModule {}
