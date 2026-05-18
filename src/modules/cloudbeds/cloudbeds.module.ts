import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudbedsController } from './cloudbeds.controller';
import { CloudbedsService } from './cloudbeds.service';
import { ReservationIntentsService } from './reservation-intents.service';
import { AvailabilitySnapshotsService } from './availability-snapshots.service';
import { CloudbedsPublicBookingProvider } from './providers/cloudbeds-public-booking.provider';
import { BOOKING_PROVIDER } from './providers/booking-provider.interface';

/**
 * Cloudbeds integration module.
 *
 * Wires the public booking-engine provider behind the `BOOKING_PROVIDER`
 * token so it can be swapped (e.g. for `CloudbedsOfficialApiProvider`)
 * without touching consumers.
 */
@Module({
  imports: [PrismaModule],
  controllers: [CloudbedsController],
  providers: [
    CloudbedsService,
    ReservationIntentsService,
    AvailabilitySnapshotsService,
    CloudbedsPublicBookingProvider,
    {
      provide: BOOKING_PROVIDER,
      useExisting: CloudbedsPublicBookingProvider,
    },
  ],
  exports: [CloudbedsService, ReservationIntentsService],
})
export class CloudbedsModule {}
