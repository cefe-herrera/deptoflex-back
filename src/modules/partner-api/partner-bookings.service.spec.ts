import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PartnerBookingsService } from './partner-bookings.service';
import type { CreatePartnerBookingDto } from './dto/partner-booking.dto';

const client = {
  clientId: 'c1',
  clientName: 'Acme',
  apiKeyId: 'k1',
  rpmLimit: null,
};

const availability = (over: Record<string, unknown> = {}) => ({
  propertyId: 'p1',
  currency: 'ARS',
  nights: 2,
  rooms: [
    {
      roomTypeId: 'rt1',
      rateId: 'r1',
      name: 'Doble',
      remaining: 2,
      totalAmount: 240000,
    },
  ],
  ...over,
});

const dto = (
  over: Partial<CreatePartnerBookingDto> = {},
): CreatePartnerBookingDto => ({
  propertyId: 'p1',
  roomTypeId: 'rt1',
  checkin: '2026-12-16',
  checkout: '2026-12-18',
  adults: 2,
  guest: {
    firstName: 'Ana',
    lastName: 'Paz',
    email: 'Ana@Mail.com',
    phone: '+5491100000000',
  },
  pricing: { currency: 'ARS', finalPrice: 240000, partnerCommission: 36000 },
  ...over,
});

const row = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  clientId: 'c1',
  status: 'PENDING',
  externalReference: null,
  roomTypeId: 'rt1',
  rateId: 'r1',
  roomName: 'Doble',
  checkin: new Date('2026-12-16'),
  checkout: new Date('2026-12-18'),
  nights: 2,
  adults: 2,
  children: 0,
  guestFirstName: 'Ana',
  guestLastName: 'Paz',
  guestEmail: 'ana@mail.com',
  guestPhone: '+54',
  guestDocument: null,
  guestNationality: null,
  notes: null,
  currency: 'ARS',
  finalPrice: new Prisma.Decimal(240000),
  partnerCommission: new Prisma.Decimal(36000),
  netPrice: new Prisma.Decimal(204000),
  quotedPrice: new Prisma.Decimal(240000),
  priceMismatch: false,
  cloudbedsReservationId: null,
  cancellationReason: null,
  rejectionReason: null,
  property: { id: 'p1', name: 'Depto Centro' },
  client: { id: 'c1', name: 'Acme', contactEmail: 'owner@acme.com' },
  ...over,
});

function makeService() {
  const prisma = {
    partnerBookingRequest: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve(row(args.data)),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn(),
    },
  };
  const partner = { availability: jest.fn().mockResolvedValue(availability()) };
  const notifications = { sendToRole: jest.fn().mockResolvedValue([]) };
  const email = { sendNotificationEmail: jest.fn().mockResolvedValue(true) };
  const audit = { log: jest.fn() };
  const service = new PartnerBookingsService(
    prisma as never,
    partner as never,
    notifications as never,
    email as never,
    audit as never,
  );
  return { service, prisma, partner, notifications, email };
}

describe('PartnerBookingsService', () => {
  describe('create', () => {
    it('reserva de 240.000 con 15% de comisión: el partner cobra 36.000 y nosotros 204.000', async () => {
      const { service, prisma, notifications } = makeService();
      const res = await service.create(client, dto(), {}, {});
      const data = (
        prisma.partnerBookingRequest.create.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;
      expect(data).toMatchObject({
        netPrice: 204000,
        quotedPrice: 240000,
        priceMismatch: false,
        guestEmail: 'ana@mail.com',
        roomName: 'Doble',
        rateId: 'r1',
      });
      expect(res.status).toBe('PENDING');
      expect(res.pricing).toEqual({
        currency: 'ARS',
        finalPrice: 240000,
        partnerCommission: 36000,
        commissionRate: 15,
        amountToCollect: 204000,
      });
      expect(notifications.sendToRole).toHaveBeenCalledWith(
        'ADMIN',
        expect.objectContaining({ type: 'BOOKING_CREATED' }),
      );
    });

    it('marca diferencia de precio si el total no coincide con la cotización', async () => {
      const { service, prisma } = makeService();
      await service.create(
        client,
        dto({
          pricing: {
            currency: 'ARS',
            finalPrice: 250000,
            partnerCommission: 30000,
          },
        }),
        {},
        {},
      );
      const data = (
        prisma.partnerBookingRequest.create.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;
      expect(data).toMatchObject({ netPrice: 220000, priceMismatch: true });
    });

    it('rechaza si la habitación no está disponible', async () => {
      const { service, partner } = makeService();
      partner.availability.mockResolvedValue(availability({ rooms: [] }));
      await expect(
        service.create(client, dto(), {}, {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza comisión mayor al precio final', async () => {
      const { service } = makeService();
      await expect(
        service.create(
          client,
          dto({
            pricing: {
              currency: 'ARS',
              finalPrice: 100,
              partnerCommission: 200,
            },
          }),
          {},
          {},
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('es idempotente con externalReference', async () => {
      const { service, prisma, partner } = makeService();
      prisma.partnerBookingRequest.findUnique.mockResolvedValue(
        row({ externalReference: 'X-1' }),
      );
      const res = await service.create(
        client,
        dto({ externalReference: 'X-1' }),
        {},
        {},
      );
      expect(res.id).toBe('b1');
      expect(partner.availability).not.toHaveBeenCalled();
      expect(prisma.partnerBookingRequest.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelación', () => {
    it('una pendiente se cancela directo', async () => {
      const { service, prisma } = makeService();
      prisma.partnerBookingRequest.findFirst.mockResolvedValue(row());
      prisma.partnerBookingRequest.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.partnerBookingRequest.findUniqueOrThrow.mockResolvedValue(
        row({ status: 'CANCELLED' }),
      );
      const res = await service.requestCancellation(
        'c1',
        'b1',
        'cambio de planes',
      );
      expect(prisma.partnerBookingRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1', status: 'PENDING' },
          data: expect.objectContaining({ status: 'CANCELLED' }) as unknown,
        }),
      );
      expect(res.status).toBe('CANCELLED');
    });

    it('una confirmada pasa a cancelación solicitada', async () => {
      const { service, prisma, notifications } = makeService();
      prisma.partnerBookingRequest.findFirst.mockResolvedValue(
        row({ status: 'CONFIRMED' }),
      );
      prisma.partnerBookingRequest.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.partnerBookingRequest.findUniqueOrThrow.mockResolvedValue(
        row({ status: 'CANCELLATION_REQUESTED' }),
      );
      await service.requestCancellation('c1', 'b1', 'cambio de planes');
      expect(prisma.partnerBookingRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1', status: 'CONFIRMED' },
        }),
      );
      expect(notifications.sendToRole).toHaveBeenCalledWith(
        'ADMIN',
        expect.objectContaining({ type: 'BOOKING_CANCELLATION_REQUESTED' }),
      );
    });

    it('no se puede cancelar una rechazada', async () => {
      const { service, prisma } = makeService();
      prisma.partnerBookingRequest.findFirst.mockResolvedValue(
        row({ status: 'REJECTED' }),
      );
      await expect(
        service.requestCancellation('c1', 'b1', 'x'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('admin', () => {
    it('confirmar avisa a la organización por email', async () => {
      const { service, prisma, email } = makeService();
      prisma.partnerBookingRequest.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.partnerBookingRequest.findUniqueOrThrow.mockResolvedValue(
        row({ status: 'CONFIRMED', cloudbedsReservationId: 'CB-123' }),
      );
      const res = await service.confirm('b1', 'CB-123', undefined, 'admin');
      expect(res.confirmationCode).toBe('CB-123');
      expect(email.sendNotificationEmail).toHaveBeenCalledWith(
        'owner@acme.com',
        expect.stringContaining('confirmada'),
        expect.stringContaining('CB-123'),
      );
    });

    it('no confirma si ya no está pendiente', async () => {
      const { service, prisma } = makeService();
      prisma.partnerBookingRequest.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.partnerBookingRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.confirm('b1', 'CB-1', undefined, 'admin'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
