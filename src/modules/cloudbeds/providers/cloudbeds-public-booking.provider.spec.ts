import { ServiceUnavailableException } from '@nestjs/common';
import { CloudbedsPublicBookingProvider } from './cloudbeds-public-booking.provider';
import { CloudbedsResponseSchema, type RawCloudbedsResponse } from './cloudbeds-response.schema';
import type { ExternalRequestService } from '../external-request.service';

describe('CloudbedsPublicBookingProvider', () => {
  let provider: CloudbedsPublicBookingProvider;

  const externalRequests = {
    record: jest.fn(),
    formBodyToJson: jest.fn(),
  } as unknown as ExternalRequestService;

  const baseInput = {
    propertyExternalId: '179484',
    checkin: '2026-05-16',
    checkout: '2026-05-18',
    currencyCode: 'ARS',
    lang: 'es',
  };

  beforeEach(() => {
    provider = new CloudbedsPublicBookingProvider(externalRequests);
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

  describe('normalize — subtotal por plan (rate_id)', () => {
    // Fragmento real (widget 288413, 2026-12-09 → 2026-12-13): cada plan es un
    // room_type con su propio rate_id y tarifas por noche que ya incluyen el
    // descuento/suplemento del plan.
    const raw = {
      total: 3,
      room_types: [
        {
          room_type_id: '531507',
          rate_id: '1645848',
          room_type_name: 'Monoambientes',
          room_type_title: 'Monoambientes',
          rate_basic: 278000,
          detailed_rates: [
            { date: '2026-12-09', rate: 63000, base_rate: 63000 },
            { date: '2026-12-10', rate: 63000, base_rate: 63000 },
            { date: '2026-12-11', rate: 76000, base_rate: 76000 },
            { date: '2026-12-12', rate: 76000, base_rate: 76000 },
          ],
          remaining: 5,
        },
        {
          room_type_id: '531507',
          rate_id: '3280333',
          room_type_name: 'Monoambientes',
          room_type_title: 'Monoambientes (No Reembolsable)',
          rate_basic: 264100,
          detailed_rates: [
            { date: '2026-12-09', rate: 59850, base_rate: '63000.00' },
            { date: '2026-12-10', rate: 59850, base_rate: '63000.00' },
            { date: '2026-12-11', rate: 72200, base_rate: '76000.00' },
            { date: '2026-12-12', rate: 72200, base_rate: '76000.00' },
          ],
          remaining: 5,
        },
      ],
      ma_rates: false,
    };

    it('suma detailed_rates[].rate del plan seleccionado', () => {
      const parsed = CloudbedsResponseSchema.parse(raw);
      const result = provider.normalize(baseInput, parsed, 200, 1);
      const byRate = Object.fromEntries(result.rooms.map((r) => [r.rateId, r.totalAmount]));
      expect(byRate['1645848']).toBe(278000);
      expect(byRate['3280333']).toBe(264100);
    });

    it('expone el plan: tarifa estándar vs. oferta con nombre, condiciones y precio sin descuento', () => {
      const withPackage = {
        ...raw,
        room_types: [
          raw.room_types[0],
          {
            ...raw.room_types[1],
            is_package: 1,
            package_id: '77',
            package_external_name: 'No Reembolsable',
            package_internal_name: 'NR 5%',
            package_desc: '<p>5% off</p>',
            package_terms: '<p>Sin devolución</p>',
            package_src: '',
          },
        ],
      };
      const result = provider.normalize(baseInput, CloudbedsResponseSchema.parse(withPackage), 200, 1);
      const [std, nr] = result.rooms;
      expect(std.ratePlan).toEqual({
        isPackage: false,
        packageId: null,
        name: 'Tarifa estándar',
        descriptionHtml: null,
        termsHtml: null,
        imageUrl: null,
        baseTotalAmount: null,
      });
      expect(nr.ratePlan).toEqual({
        isPackage: true,
        packageId: '77',
        name: 'No Reembolsable',
        descriptionHtml: '<p>5% off</p>',
        termsHtml: '<p>Sin devolución</p>',
        imageUrl: null,
        baseTotalAmount: 278000,
      });
    });

    it('si falta package_external_name usa el plan entre paréntesis del título', () => {
      const parsed = CloudbedsResponseSchema.parse({
        ...raw,
        room_types: [{ ...raw.room_types[1], is_package: true }],
      });
      expect(provider.normalize(baseInput, parsed, 200, 1).rooms[0].ratePlan.name).toBe('No Reembolsable');
    });

    it('un valor de package_* con tipo inesperado no rompe la búsqueda', () => {
      const parsed = CloudbedsResponseSchema.parse({
        ...raw,
        room_types: [{ ...raw.room_types[0], is_package: null, package_desc: { x: 1 } }],
      });
      expect(provider.normalize(baseInput, parsed, 200, 1).rooms[0].ratePlan.name).toBe('Tarifa estándar');
    });
  });

  describe('calculateTotals (HTTP) — precio final', () => {
    let httpPostMock: jest.SpyInstance;
    afterEach(() => httpPostMock?.mockRestore?.());

    const cart = (data: Record<string, unknown>) => ({
      status: 200,
      text: JSON.stringify({ success: true, statusCode: 200, data }),
    });
    const iva = (credit: number) => ({ id: '249055', name: 'IVA', credit });
    const muni = (credit: number) => ({ id: '808993', name: 'Municipal', credit });

    // Respuestas reales del carrito de Cloudbeds (widget 288413).
    const cases = [
      {
        label: 'tarifa estándar, 1 noche',
        rates: [{ rateId: '1645848', adults: 2, kids: 0 }],
        data: {
          days: 1, total: 63000, grandTotal: 78750, cntRooms: 1, totalAdults: 2, totalKids: 0,
          taxes: { total: 15750, data: [iva(13230), muni(2520)] }, fees: { total: 0, data: [] },
        },
        expected: { subtotal: 63000, taxes: 15750, grandTotal: 78750 },
      },
      {
        label: 'no reembolsable, 1 noche',
        rates: [{ rateId: '3280333', adults: 2, kids: 0 }],
        data: {
          days: 1, total: 59850, grandTotal: 74812.5, cntRooms: 1, totalAdults: 2, totalKids: 0,
          taxes: { total: 14962.5, data: [iva(12568.5), muni(2394)] }, fees: { total: 0, data: [] },
        },
        expected: { subtotal: 59850, taxes: 14962.5, grandTotal: 74812.5 },
      },
      {
        label: 'no reembolsable, 4 noches',
        rates: [{ rateId: '3280333', adults: 2, kids: 0 }],
        data: {
          days: 4, total: 264100, grandTotal: 330125, cntRooms: 1, totalAdults: 2, totalKids: 0,
          taxes: { total: 66025, data: [iva(55461), muni(10564)] }, fees: { total: 0, data: [] },
        },
        expected: { subtotal: 264100, taxes: 66025, grandTotal: 330125 },
      },
      {
        label: 'estándar, 3 noches, 2 unidades',
        rates: [
          { rateId: '1645848', adults: 2, kids: 0 },
          { rateId: '1645848', adults: 2, kids: 0 },
        ],
        data: {
          days: 3, total: 404000, grandTotal: 505000, cntRooms: 2, totalAdults: 4, totalKids: 0,
          taxes: { total: 101000, data: [iva(84840), muni(16160)] }, fees: { total: 0, data: [] },
        },
        expected: { subtotal: 404000, taxes: 101000, grandTotal: 505000 },
      },
    ];

    it.each(cases)('$label → FINAL con el grandTotal del carrito', async ({ rates, data, expected }) => {
      httpPostMock = jest.spyOn(provider as any, 'httpPost').mockResolvedValue(cart(data));
      const result = await provider.calculateTotals({ ...baseInput, rates });
      expect(result.priceStatus).toBe('FINAL');
      expect(result.priceStatusReason).toBeNull();
      expect(result.subtotal).toBe(expected.subtotal);
      expect(result.taxesTotal + result.feesTotal).toBe(expected.taxes);
      expect(result.grandTotal).toBe(expected.grandTotal);
    });

    it('cae a SUBTOTAL si el carrito no refleja la ocupación pedida', async () => {
      httpPostMock = jest.spyOn(provider as any, 'httpPost').mockResolvedValue(
        cart({ ...cases[0].data, totalAdults: 2 }),
      );
      const result = await provider.calculateTotals({
        ...baseInput,
        rates: [{ rateId: '1645848', adults: 3, kids: 0 }],
      });
      expect(result.priceStatus).toBe('SUBTOTAL');
      expect(result.priceStatusReason).toBe('selection_mismatch');
    });

    it('cae a SUBTOTAL si el desglose no cierra (p. ej. impuestos incluidos)', async () => {
      httpPostMock = jest.spyOn(provider as any, 'httpPost').mockResolvedValue(
        cart({ ...cases[0].data, grandTotal: 63000 }),
      );
      const result = await provider.calculateTotals({ ...baseInput, rates: cases[0].rates });
      expect(result.priceStatus).toBe('SUBTOTAL');
      expect(result.priceStatusReason).toBe('breakdown_mismatch');
    });

    it('cae a SUBTOTAL si faltan totales', async () => {
      httpPostMock = jest.spyOn(provider as any, 'httpPost').mockResolvedValue(
        cart({ ...cases[0].data, grandTotal: null }),
      );
      const result = await provider.calculateTotals({ ...baseInput, rates: cases[0].rates });
      expect(result.priceStatus).toBe('SUBTOTAL');
      expect(result.priceStatusReason).toBe('missing_totals');
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
      expect(result.cloudbedsSuccessFlag).toBe(true);
      expect(result.reservationId).toBe('2448738948993');
      expect(result.encryptedReservationId).toBe('encrypted');
      expect(result.customerId).toBe('176234319');
      expect(result.status).toBe('confirmed');
      expect(result.httpStatus).toBe(200);
    });

    it('accepts success=false when enc_res_id is present (soft success)', async () => {
      httpPostMock = jest
        .spyOn(provider as any, 'httpPost')
        .mockResolvedValue({
          status: 200,
          text: JSON.stringify({
            success: false,
            id: '178174824',
            reservation_id: '9066723849016',
            enc_res_id: 'encrypted-token',
            customer_id: '178971184',
            payment_url: '',
          }),
        });

      const result = await provider.prepareBooking({
        ...baseInput,
        cartToken: 'token',
        rooms: [{ rateId: '551718', adults: 2, kids: 0 }],
        firstName: 'Ceferino',
        lastName: 'Herrera',
        email: 'test@mail.com',
        phone: '+543874025678',
        country: 'AR',
        bookingEstimatedArrivalTime: 1,
        paymentSdk: true,
        cfarOffersPresented: false,
        bookingEngineSource: 'hosted',
        iframe: false,
      });

      expect(result.success).toBe(true);
      expect(result.cloudbedsSuccessFlag).toBe(false);
      expect(result.reservationId).toBe('178174824');
      expect(result.encryptedReservationId).toBe('encrypted-token');
    });

    it('rejects when success=false and enc_res_id is missing', async () => {
      httpPostMock = jest
        .spyOn(provider as any, 'httpPost')
        .mockResolvedValue({
          status: 200,
          text: JSON.stringify({
            success: false,
            statusMessage: 'Cart expired',
          }),
        });

      await expect(
        provider.prepareBooking({
          ...baseInput,
          cartToken: 'token',
          rooms: [{ rateId: '551718', adults: 1, kids: 0 }],
          firstName: 'A',
          lastName: 'B',
          email: 'a@b.com',
          phone: '+5412345678',
          country: 'AR',
          bookingEstimatedArrivalTime: 1,
          paymentSdk: true,
          cfarOffersPresented: false,
          bookingEngineSource: 'hosted',
          iframe: false,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('getConfirmation (JSON API)', () => {
    let httpGetMock: jest.SpyInstance;

    afterEach(() => {
      httpGetMock?.mockRestore?.();
    });

    it('parses JSON confirmation payload from GET /booking/confirmation', async () => {
      httpGetMock = jest.spyOn(provider as any, 'httpGet').mockResolvedValue({
        status: 200,
        text: JSON.stringify({
          success: true,
          data: {
            identifier: '9279324628160',
            status: 'confirmed',
            property_id: '288413',
            total: 62500,
            first: 'Armando',
            mail_info: {
              reservation_id: '178174178',
              first_name: 'Armando',
              last_name: 'Herrera',
              email: 'armandoher01@gmail.com',
              phone: '+543874025678',
              checkin_date: '2026-06-21',
              checkout_date: '2026-06-22',
              grand_total: 62500,
              currency_from: 'ARS',
              booking_rooms: [{ room_type_id: '531507' }],
            },
          },
        }),
      });

      const result = await provider.getConfirmation({ dataRes: 'encrypted-token' });

      expect(result.reservationId).toBe('178174178');
      expect(result.guestName).toBe('Armando Herrera');
      expect(result.guestEmail).toBe('armandoher01@gmail.com');
      expect(result.checkin).toBe('2026-06-21');
      expect(result.checkout).toBe('2026-06-22');
      expect(result.totalAmount).toBe(62500);
      expect(result.propertyExternalId).toBe('288413');
      expect(result.roomTypeId).toBe('531507');
      expect(result.status).toBe('confirmed');
    });
  });
});
