import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AvailabilityResult } from './providers/booking-provider.interface';

@Injectable()
export class AvailabilitySnapshotsService {
  private readonly logger = new Logger(AvailabilitySnapshotsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    propertyId: string;
    checkin: string;
    checkout: string;
    currencyCode: string;
    lang: string;
    result: AvailabilityResult;
  }): Promise<void> {
    try {
      await this.prisma.availabilitySnapshot.create({
        data: {
          propertyId: params.propertyId,
          checkin: new Date(params.checkin),
          checkout: new Date(params.checkout),
          currencyCode: params.currencyCode,
          lang: params.lang,
          rawResponseJson: params.result.raw as object,
          normalizedResponseJson: {
            propertyExternalId: params.result.propertyExternalId,
            totalAvailable: params.result.totalAvailable,
            rooms: params.result.rooms,
            meta: params.result.meta ?? null,
          } as object,
          totalAvailable: params.result.totalAvailable,
          httpStatus: params.result.httpStatus,
          durationMs: params.result.durationMs,
        },
      });
    } catch (err) {
      // Snapshots are non-critical: never fail the user request because of them.
      this.logger.warn(
        `Failed to persist availability snapshot: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
