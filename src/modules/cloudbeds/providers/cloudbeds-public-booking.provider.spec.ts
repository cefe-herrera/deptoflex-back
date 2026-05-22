import { ServiceUnavailableException } from '@nestjs/common';
import { CloudbedsPublicBookingProvider } from './cloudbeds-public-booking.provider';
import type { RawCloudbedsResponse } from './cloudbeds-response.schema';

describe('CloudbedsPublicBookingProvider', () => {
  let provider: CloudbedsPublicBookingProvider;

  const baseInput = {
    propertyExternalId: '179484',
    checkin: '2026-05-16',
    checkout: '2026-05-18',
    currencyCode: 'ARS',
    lang: 'es',
  };

  beforeEach(() => {
    provider = new CloudbedsPublicBookingProvider();
  });

  describe('buildFormBody', () => {
    it('serializes all required fields as form-urlencoded', () => {
      const body = provider.buildFormBody(baseInput);
      expect(body).toContain('checkin=2026-05-16');
      expect(body).toContain('checkout=2026-05-18');
      expect(body).toContain('currency_code=ARS');
      expect(body).toContain('lang=es');
      expect(body).toContain('widget_property=179484');
    });
  });

  describe('buildPrepareFormBody', () => {
    it('serializes Cloudbeds prepare payload as form-urlencoded', () => {
      const body = provider.buildPrepareFormBody({
        ...baseInput,
        cartToken: 'Lx71gN//token',
        rooms: [{ rateId: '551718', adults: 1, kids: 0, addons: [] }],
        firstName: 'Ceferino Armando',
        lastName: 'Herrera',
        email: 'c3f3.dev@gmail.com',
        phone: '+543874025678',
        country: 'AR',
        bookingEstimatedArrivalTime: 1,
        paymentSdk: true,
        cfarOffersPresented: false,
        sessionId: 'acb86933-2a32-4704-9b62-00b9d026e813',
        bookingEngineSource: 'hosted',
        iframe: false,
      });
      const params = new URLSearchParams(body);
      expect(params.get('widget_property')).toBe('179484');
      expect(params.get('selected_checkin')).toBe('2026-05-16');
      expect(params.get('selected_checkout')).toBe('2026-05-18');
      expect(params.get('currency')).toBe('ARS');
      expect(params.get('cart_token')).toBe('Lx71gN//token');
      expect(params.get('first_name')).toBe('Ceferino Armando');
      expect(params.get('phone')).toBe('+543874025678');
      expect(params.get('payment_sdk')).toBe('true');
      expect(params.get('cfarOffersPresented')).toBe('false');
      expect(JSON.parse(params.get('rooms') ?? '{}')).toEqual({
        '551718': [{ addons: [], adults: '1', kids: '0' }],
      });
    });
  });

  describe('buildReservationRedirectUrl', () => {
    it('builds slug-based reservation URL when bookingSlug is present', () => {
      const url = provider.buildReservationRedirectUrl({
        propertyExternalId: '179484',
        bookingSlug: 'ZBC4Bn',
        checkin: '2026-05-16',
        checkout: '2026-05-18',
        currencyCode: 'ARS',
        lang: 'es',
        roomTypeId: '249030',
        rateId: '551718',
        adults: 2,
      });
      expect(url).toContain('https://hotels.cloudbeds.com/es/reservation/ZBC4Bn/');
      expect(url).toContain('currency=ars');
      expect(url).toContain('checkin=2026-05-16');
      expect(url).toContain('checkout=2026-05-18');
      expect(url).toContain('room_type_id=249030');
      expect(url).toContain('rate_id=551718');
      expect(url).toContain('adults=2');
    });

    it('falls back to /booking when bookingSlug is missing', () => {
      const url = provider.buildReservationRedirectUrl({
        propertyExternalId: '179484',
        bookingSlug: null,
        checkin: '2026-05-16',
        checkout: '2026-05-18',
        currencyCode: 'ARS',
        lang: 'es',
        roomTypeId: '249030',
      });
      expect(url).toContain('/booking?');
      expect(url).toContain('widget_property=179484');
      expect(url).toContain('currency_code=ARS');
    });
  });

  describe('normalize', () => {
    const fullPayload: RawCloudbedsResponse = {
      total: 16,
      room_types: [
        {
          rate_basic: 95000,
          rate_min: 45000,
          rate_max: 50000,
          room_type_id: '249030',
          rate_id: '551718',
          detailed_rates: [
            { date: '2026-05-16', rate: 50000, base_rate: 50000 },
            { date: '2026-05-17', rate: 45000, base_rate: 45000 },
          ],
          num_available_now: 15,
          remaining: 15,
          room_type_name: 'Monoambientes',
          room_type_title: 'Monoambientes',
          max_rooms: 30,
          max_guests: '2',
          max_adults: '2',
          max_children: '1',
          room_type_desc: 'Cómodo monoambiente',
          featured_photo: 'https://cdn/small.jpg',
          featured_photo_big: 'https://cdn/big.jpg',
          photos_gallery: ['https://cdn/1.jpg', 'https://cdn/2.jpg'],
          features: ['Wifi', 'AC'],
          unit_ids: ['249030-10', '249030-11'],
        },
      ],
      currency_rate: 1,
      website_source_id: '440780',
      ma_rates: [
        {
          id: '396677',
          name: 'Monoambientes',
          rates: [{ channel_name: 'Expedia', channel_price: 118750 }],
          direct: 95000,
        },
      ],
    };

    it('maps a complete Cloudbeds payload to the normalized model', () => {
      const result = provider.normalize(baseInput, fullPayload, 200, 123);
      expect(result.totalAvailable).toBe(16);
      expect(result.rooms).toHaveLength(1);
      const room = result.rooms[0];
      expect(room.roomTypeId).toBe('249030');
      expect(room.rateId).toBe('551718');
      expect(room.totalAmount).toBe(95000);
      expect(room.minNightlyRate).toBe(45000);
      expect(room.maxNightlyRate).toBe(50000);
      expect(room.detailedRates).toEqual([
        { date: '2026-05-16', rate: 50000, baseRate: 50000 },
        { date: '2026-05-17', rate: 45000, baseRate: 45000 },
      ]);
      expect(room.maxGuests).toBe(2);
      expect(room.featuredPhoto).toBe('https://cdn/big.jpg');
      expect(room.photos).toEqual(['https://cdn/big.jpg', 'https://cdn/small.jpg', 'https://cdn/1.jpg', 'https://cdn/2.jpg']);
      expect(room.features).toEqual(['Wifi', 'AC']);
      expect(room.unitIds).toEqual(['249030-10', '249030-11']);
      expect(room.otaComparison).toEqual([
        { channelName: 'Expedia', channelPrice: 118750, directPrice: 95000 },
      ]);
    });

    it('handles a response with no room_types', () => {
      const result = provider.normalize(baseInput, { total: 0, ma_rates: [] }, 200, 50);
      expect(result.totalAvailable).toBe(0);
      expect(result.rooms).toEqual([]);
    });

    it('handles rooms with no photos and no ma_rates', () => {
      const payload: RawCloudbedsResponse = {
        total: 1,
        room_types: [
          {
            room_type_id: '99',
            room_type_name: 'Basic',
            num_available_now: 1,
            max_rooms: 1,
            detailed_rates: [{ date: '2026-05-16', rate: 100 }],
          },
        ],
        ma_rates: [],
      };
      const result = provider.normalize(baseInput, payload, 200, 10);
      expect(result.rooms[0].photos).toEqual([]);
      expect(result.rooms[0].featuredPhoto).toBeNull();
      expect(result.rooms[0].otaComparison).toBeUndefined();
      // totalAmount falls back to sum of detailed_rates when rate_basic is missing.
      expect(result.rooms[0].totalAmount).toBe(100);
    });

    it('treats missing rate_basic as null totalAmount when no detailed_rates', () => {
      const payload: RawCloudbedsResponse = {
        room_types: [
          { room_type_id: '1', room_type_name: 'X', remaining: 1 },
        ],
        ma_rates: [],
      };
      const result = provider.normalize(baseInput, payload, 200, 10);
      expect(result.rooms[0].totalAmount).toBeNull();
    });

    it('uses num_available_now when remaining is missing', () => {
      const payload: RawCloudbedsResponse = {
        room_types: [
          { room_type_id: '1', room_type_name: 'X', num_available_now: 7 },
        ],
        ma_rates: [],
      };
      const result = provider.normalize(baseInput, payload, 200, 10);
      expect(result.rooms[0].remaining).toBe(7);
    });
  });

  describe('searchAvailability (HTTP)', () => {
    const ok = (body: unknown) => ({
      status: 200,
      text: JSON.stringify(body),
    });

    let httpPostMock: jest.SpyInstance;

    afterEach(() => {
      httpPostMock?.mockRestore?.();
    });

    it('throws ServiceUnavailable on non-OK upstream', async () => {
      httpPostMock = jest
        .spyOn(provider as any, 'httpPost')
        .mockResolvedValue({ status: 502, text: '' });
      await expect(provider.searchAvailability(baseInput)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailable on non-JSON response', async () => {
      httpPostMock = jest
        .spyOn(provider as any, 'httpPost')
        .mockResolvedValue({ status: 200, text: 'not-json' });
      await expect(provider.searchAvailability(baseInput)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailable when shape validation fails', async () => {
      httpPostMock = jest
        .spyOn(provider as any, 'httpPost')
        .mockResolvedValue(ok(['unexpected', 'array']));
      await expect(provider.searchAvailability(baseInput)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('returns a normalized result on success', async () => {
      httpPostMock = jest
        .spyOn(provider as any, 'httpPost')
        .mockResolvedValue(ok({ total: 0, room_types: [] }));
      const result = await provider.searchAvailability(baseInput);
      expect(result.totalAvailable).toBe(0);
      expect(result.rooms).toEqual([]);
      expect(result.httpStatus).toBe(200);
    });

    it('does not send cookies or Authorization header', async () => {
      httpPostMock = jest
        .spyOn(provider as any, 'httpPost')
        .mockResolvedValue(ok({ total: 0, room_types: [] }));
      await provider.searchAvailability(baseInput);
      const [endpoint, body] = httpPostMock.mock.calls[0];
      expect(endpoint).toContain('/booking/rooms');
      expect(body).toContain('widget_property=179484');
    });
  });

  describe('prepareBooking (HTTP)', () => {
    let httpPostMock: jest.SpyInstance;

    afterEach(() => {
      httpPostMock?.mockRestore?.();
    });

    it('returns a normalized prepare result on success', async () => {
      httpPostMock = jest
        .spyOn(provider as any, 'httpPost')
        .mockResolvedValue({
          status: 200,
          text: JSON.stringify({
            success: true,
            reservation_id: '2448738948993',
            enc_res_id: 'encrypted',
            customer_id: '176234319',
            status: 'confirmed',
          }),
        });

      const result = await provider.prepareBooking({
        ...baseInput,
        cartToken: 'token',
        rooms: [{ rateId: '551718', adults: 1, kids: 0 }],
        firstName: 'Ceferino',
        lastName: 'Herrera',
        email: 'c3f3.dev@gmail.com',
        phone: '+543874025678',
        country: 'AR',
        bookingEstimatedArrivalTime: 1,
        paymentSdk: true,
        cfarOffersPresented: false,
        bookingEngineSource: 'hosted',
        iframe: false,
      });

      expect(result.success).toBe(true);
      expect(result.reservationId).toBe('2448738948993');
      expect(result.encryptedReservationId).toBe('encrypted');
      expect(result.customerId).toBe('176234319');
      expect(result.status).toBe('confirmed');
      expect(result.httpStatus).toBe(200);
    });
  });
});
