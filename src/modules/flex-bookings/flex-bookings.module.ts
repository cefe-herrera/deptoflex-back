import { Module } from '@nestjs/common';
import { FlexBookingsController } from './flex-bookings.controller';
import { FlexBookingsService } from './flex-bookings.service';

@Module({
  controllers: [FlexBookingsController],
  providers: [FlexBookingsService],
  exports: [FlexBookingsService],
})
export class FlexBookingsModule {}
