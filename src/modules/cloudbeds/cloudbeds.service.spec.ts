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
      ratePlan: { isPackage: false, packageId: null, name: 'Tarifa estándar', descriptionHtml: null, termsHtml: null, imageUrl: null, baseTotalAmount: null },
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

  describe('precio final por tarifa', () => {
    const totals = (over: Record<string, unknown> = {}) => ({
      subtotal: 57000,
      taxesTotal: 14250,
      feesTotal: 0,
      grandTotal: 71250,
      priceStatus: 'FINAL',
      taxes: [
        { id: '1', name: 'IVA', amount: 11970 },
        { id: '2', name: 'Impuesto Municipal', amount: 2280 },
      ],
      fees: [],
      ...over,
    });

    const run = async (provider: jest.Mocked<BookingProvider>, dto: Record<string, unknown> = {}) => {
      provider.searchAvailability.mockResolvedValue(
        buildResult({ rooms: [{ ...buildResult().rooms[0], rateId: '3280330', totalAmount: 57000 }] }),
      );
      const svc = new CloudbedsService(
        fakePrisma({ id: 'p1', name: 'P', cloudbedsWidgetPropertyId: '256637' }),
        fakeCache(),
        fakeSnapshots(),
        provider,
      );
      return svc.searchAvailability({
        propertyId: '256637',
        checkin: futureDate(7),
        checkout: futureDate(8),
        ...dto,
      });
    };

    it('agrega el grandTotal del carrito como finalAmount con la ocupación de la búsqueda', async () => {
      const provider = fakeProvider();
      provider.calculateTotals.mockResolvedValue(totals() as never);
      const out = await run(provider, { adults: 3, children: 1 });
      expect(out.rooms[0]).toMatchObject({
        totalAmount: 57000,
        priceStatus: 'FINAL',
        finalAmount: 71250,
        taxesAndFeesAmount: 14250,
        taxesAndFees: [
          { name: 'IVA', amount: 11970 },
          { name: 'Impuesto Municipal', amount: 2280 },
        ],
      });
      expect(provider.calculateTotals).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyExternalId: '256637',
          rates: [{ rateId: '3280330', adults: 3, kids: 1 }],
        }),
      );
    });

    it('queda como SUBTOTAL si el carrito no confirma', async () => {
      const provider = fakeProvider();
      provider.calculateTotals.mockResolvedValue(totals({ priceStatus: 'SUBTOTAL' }) as never);
      const out = await run(provider);
      expect(out.rooms[0]).toMatchObject({ priceStatus: 'SUBTOTAL', finalAmount: null, totalAmount: 57000 });
    });

    it('priceQuotes=cheapest cotiza sólo la tarifa más barata de cada tipo de unidad', async () => {
      const provider = fakeProvider();
      provider.calculateTotals.mockResolvedValue(totals() as never);
      const base = buildResult().rooms[0];
      provider.searchAvailability.mockResolvedValue(
        buildResult({
          rooms: [
            { ...base, rateId: 'std', totalAmount: 60000 },
            { ...base, rateId: 'nr', totalAmount: 57000 },
            { ...base, rateId: 'bk', totalAmount: 80000 },
          ],
        }),
      );
      const svc = new CloudbedsService(
        fakePrisma({ id: 'p1', name: 'P', cloudbedsWidgetPropertyId: '256637' }),
        fakeCache(),
        fakeSnapshots(),
        provider,
      );
      const out = await svc.searchAvailability({
        propertyId: '256637',
        checkin: futureDate(7),
        checkout: futureDate(8),
        priceQuotes: 'cheapest',
      });
      expect(provider.calculateTotals).toHaveBeenCalledTimes(1);
      expect(provider.calculateTotals.mock.calls[0][0].rates[0].rateId).toBe('nr');
      expect(out.rooms.map((r) => [r.rateId, r.priceStatus])).toEqual([
        ['std', 'SUBTOTAL'],
        ['nr', 'FINAL'],
        ['bk', 'SUBTOTAL'],
      ]);
    });

    it('queda como SUBTOTAL si el carrito falla', async () => {
      const provider = fakeProvider();
      provider.calculateTotals.mockRejectedValue(new Error('upstream'));
      const out = await run(provider);
      expect(out.rooms[0]).toMatchObject({ priceStatus: 'SUBTOTAL', finalAmount: null });
    });
  });
});
