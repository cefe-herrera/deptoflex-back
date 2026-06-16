import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingCancellationRequestsService } from './booking-cancellation-requests.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
    imports: [NotificationsModule, CommissionsModule],
    controllers: [BookingsController],
    providers: [BookingsService, BookingCancellationRequestsService],
    exports: [BookingsService],
})
export class BookingsModule { }
