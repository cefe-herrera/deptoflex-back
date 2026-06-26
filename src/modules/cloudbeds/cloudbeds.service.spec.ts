import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CloudbedsService } from './cloudbeds.service';
import type { AvailabilitySnapshotsService } from './availability-snapshots.service';
import type { AvailabilityCacheService } from './availability-cache.service';
import type { BookingProvider, AvailabilityResult } from './providers/booking-provider.interface';
import type { PrismaService } from '../prisma/prisma.service';

const futureDate = (offsetDays: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const fakeProvider = (): jest.Mocked<BookingProvider> => ({
  providerName: 'fake',
  searchAvailability: jest.fn(),
  calculateTotals: jest.fn(),
  prepareBooking: jest.fn(),
  buildReservationRedirectUrl: jest.fn(),
  getConfirmation: jest.fn(),
});

const fakeSnapshots = (): jest.Mocked<AvailabilitySnapshotsService> =>
  ({
    record: jest.fn().mockResolvedValue(undefined),
    findLatestForSearch: jest.fn().mockResolvedValue(null),
  }) as unknown as jest.Mocked<AvailabilitySnapshotsService>;

const fakeCache = (): jest.Mocked<AvailabilityCacheService> =>
  ({
    buildKey: jest.fn().mockReturnValue('cache-key'),
    get: jest.fn().mockReturnValue(null),
    getStale: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    invalidate: jest.fn(),
    prune: jest.fn(),
  }) as unknown as jest.Mocked<AvailabilityCacheService>;

const fakePrisma = (
  property: { id: string; name: string; cloudbedsWidgetPropertyId: string | null } | null,
  units: Array<{ id: string; name: string; description: string | null; bedrooms: number; bathrooms: number; maxOccupancy: number; cloudbedsRoomTypeId: string | null }> = [],
) =>
  ({
    property: { findFirst: jest.fn().mockResolvedValue(property) },
    unit: { findMany: jest.fn().mockResolvedValue(units) },
  }) as unknown as PrismaService;

const buildResult = (overrides: Partial<AvailabilityResult> = {}): AvailabilityResult => ({
  propertyExternalId: '179484',
  checkin: futureDate(7),
  checkout: futureDate(9),
  currencyCode: 'ARS',
  totalAvailable: 1,
  rooms: [
    {
      roomTypeId: '249030',
      rateId: '551718',
      name: 'Mono',
      title: 'Mono',
      descriptionHtml: null,
      maxGuests: 2,
      maxAdults: 2,
      maxChildren: 0,
      remaining: 5,
      totalRooms: 10,
      totalAmount: 95000,
      minNightlyRate: 45000,
      maxNightlyRate: 50000,
      detailedRates: [],
      photos: [],
      featuredPhoto: null,
      features: [],
      unitIds: [],
    },
  ],
  raw: {},
  httpStatus: 200,
  durationMs: 50,
  ...overrides,
});

describe('CloudbedsService', () => {
  describe('date validation', () => {
    it('rejects past checkin', async () => {
      const svc = new CloudbedsService(
        fakePrisma({ id: 'p1', name: 'P', cloudbedsWidgetPropertyId: '179484' }),
        fakeCache(),
        fakeSnapshots(),
        fakeProvider(),
      );
      await expect(
        svc.searchAvailability({
          propertyId: 'p1',
          checkin: futureDate(-1),
          checkout: futureDate(1),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects checkout <= checkin', async () => {
      const svc = new CloudbedsService(
        fakePrisma({ id: 'p1', name: 'P', cloudbedsWidgetPropertyId: '179484' }),
        fakeCache(),
        fakeSnapshots(),
        fakeProvider(),
      );
      await expect(
        svc.searchAvailability({
          propertyId: 'p1',
          checkin: futureDate(2),
          checkout: futureDate(2),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('property lookup', () => {
    it('throws NotFound when property does not exist', async () => {
      const svc = new CloudbedsService(
        fakePrisma(null),
        fakeCache(),
        fakeSnapshots(),
        fakeProvider(),
      );
      await expect(
        svc.searchAvailability({
          propertyId: 'p1',
          checkin: futureDate(1),
          checkout: futureDate(2),
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequest when property has no cloudbedsWidgetPropertyId', async () => {
      const svc = new CloudbedsService(
        fakePrisma({ id: 'p1', name: 'P', cloudbedsWidgetPropertyId: null }),
        fakeCache(),
        fakeSnapshots(),
        fakeProvider(),
      );
      await expect(
        svc.searchAvailability({
          propertyId: 'p1',
          checkin: futureDate(1),
          checkout: futureDate(2),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('search flow', () => {
    it('returns enriched result and persists snapshot', async () => {
      const provider = fakeProvider();
      provider.searchAvailability.mockResolvedValue(buildResult());
      const snapshots = fakeSnapshots();
      const prisma = fakePrisma(
        { id: 'p1', name: 'Prop', cloudbedsWidgetPropertyId: '179484' },
        [
          {
            id: 'u1',
            name: 'Unit 1',
            description: null,
            bedrooms: 1,
            bathrooms: 1,
            maxOccupancy: 2,
            cloudbedsRoomTypeId: '249030',
          },
        ],
      );

      const svc = new CloudbedsService(prisma, fakeCache(), snapshots, provider);
      const out = await svc.searchAvailability({
        propertyId: 'p1',
        checkin: futureDate(7),
        checkout: futureDate(9),
      });

      expect(out.rooms).toHaveLength(1);
      expect(out.rooms[0].localUnits).toHaveLength(1);
      expect(out.rooms[0].localUnits[0].id).toBe('u1');
      // snapshots are fire-and-forget; verify it was scheduled.
      expect(snapshots.record).toHaveBeenCalled();
    });

    it('hides rooms with remaining <= 0', async () => {
      const provider = fakeProvider();
      provider.searchAvailability.mockResolvedValue(
        buildResult({
          rooms: [
            { ...buildResult().rooms[0], remaining: 0 },
            { ...buildResult().rooms[0], roomTypeId: '999', remaining: 3 },
          ],
        }),
      );
      const svc = new CloudbedsService(
        fakePrisma({ id: 'p1', name: 'P', cloudbedsWidgetPropertyId: '179484' }),
        fakeCache(),
        fakeSnapshots(),
        provider,
      );
      const out = await svc.searchAvailability({
        propertyId: 'p1',
        checkin: futureDate(7),
        checkout: futureDate(9),
      });
      expect(out.rooms).toHaveLength(1);
      expect(out.rooms[0].roomTypeId).toBe('999');
    });
  });
});
