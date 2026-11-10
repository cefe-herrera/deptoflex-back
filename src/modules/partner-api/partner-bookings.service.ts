import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, PartnerBookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../../common/services/audit.service';
import type { ExternalRequestLogContext } from '../cloudbeds/external-request.types';
import { PartnerApiService } from './partner-api.service';
import type { ApiClientContext, ApiUsageMeta } from './partner-api.types';
import type {
  AdminListPartnerBookingsQueryDto,
  CreatePartnerBookingDto,
  ListPartnerBookingsQueryDto,
} from './dto/partner-booking.dto';

/**
 * Modelo de precio: `finalPrice` es el total de la reserva y tiene que ser
 * nuestra cotización (`totalAmount` de /partner/availability). El partner le
 * cobra al huésped su comisión como seña y se la queda; nosotros creamos la
 * reserva y cobramos el resto (`finalPrice - partnerCommission`).
 * Ej.: reserva 100, comisión 15% → el partner cobra 15, nosotros 85.
 */
/** Diferencia tolerada entre el precio final y nuestra cotización (redondeos). */
const PRICE_TOLERANCE = 1;
const ADMIN_URL = '/admin/api-reservas';

const WITH_RELATIONS = {
  property: { select: { id: true, name: true } },
  client: { select: { id: true, name: true, contactEmail: true } },
} satisfies Prisma.PartnerBookingRequestInclude;

type BookingWithRelations = Prisma.PartnerBookingRequestGetPayload<{
  include: typeof WITH_RELATIONS;
}>;

const STATUS_LABEL: Record<PartnerBookingStatus, string> = {
  PENDING: 'pendiente',
  CONFIRMED: 'confirmada',
  REJECTED: 'rechazada',
  CANCELLATION_REQUESTED: 'cancelación solicitada',
  CANCELLED: 'cancelada',
};

const toDate = (d: Date) => d.toISOString().slice(0, 10);
const money = (v: Prisma.Decimal | null) => (v == null ? null : Number(v));
const commissionRate = (total: Prisma.Decimal, commission: Prisma.Decimal) =>
  Number(total) > 0
    ? Math.round((Number(commission) / Number(total)) * 10000) / 100
    : null;

/**
 * Solicitudes de reserva y cancelación de partners. No se integran con
 * Cloudbeds: se notifica al admin, que crea/cancela la reserva a mano y
 * registra el resultado acá.
 */
@Injectable()
export class PartnerBookingsService {
  private readonly logger = new Logger(PartnerBookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly partner: PartnerApiService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  // ─── Partner ────────────────────────────────────────────────────────────────

  async create(
    client: ApiClientContext,
    dto: CreatePartnerBookingDto,
    logContext: ExternalRequestLogContext,
    usage: ApiUsageMeta,
  ) {
    const { pricing } = dto;
    if (pricing.partnerCommission > pricing.finalPrice) {
      throw new BadRequestException(
        'La comisión no puede ser mayor que el precio final',
      );
    }

    if (dto.externalReference) {
      const existing = await this.prisma.partnerBookingRequest.findUnique({
        where: {
          clientId_externalReference: {
            clientId: client.clientId,
            externalReference: dto.externalReference,
          },
        },
        include: WITH_RELATIONS,
      });
      if (existing) return this.toPartner(existing);
    }

    // Verifica disponibilidad real y toma nuestra cotización para esa habitación.
    const availability = await this.partner.availability(
      {
        propertyId: dto.propertyId,
        checkin: dto.checkin,
        checkout: dto.checkout,
        adults: dto.adults,
        children: dto.children,
        currency: pricing.currency,
      },
      logContext,
      usage,
    );
    if (availability.currency !== pricing.currency) {
      throw new BadRequestException(
        `La moneda debe ser ${availability.currency}`,
      );
    }
    const room = availability.rooms.find(
      (r) =>
        r.roomTypeId === dto.roomTypeId &&
        (!dto.rateId || r.rateId === dto.rateId),
    );
    if (!room || room.remaining < 1) {
      throw new ConflictException(
        'La habitación no tiene disponibilidad para esas fechas. Volvé a consultar /partner/availability.',
      );
    }

    const netPrice =
      Math.round((pricing.finalPrice - pricing.partnerCommission) * 100) / 100;
    const quotedPrice = room.totalAmount;
    const priceMismatch =
      quotedPrice != null &&
      Math.abs(pricing.finalPrice - quotedPrice) > PRICE_TOLERANCE;

    let booking: BookingWithRelations;
    try {
      booking = await this.prisma.partnerBookingRequest.create({
        data: {
          clientId: client.clientId,
          apiKeyId: client.apiKeyId,
          externalReference: dto.externalReference,
          propertyId: dto.propertyId,
          roomTypeId: dto.roomTypeId,
          roomName: room.name,
          rateId: dto.rateId ?? room.rateId,
          checkin: new Date(dto.checkin),
          checkout: new Date(dto.checkout),
          nights: availability.nights,
          adults: dto.adults,
          children: dto.children ?? 0,
          guestFirstName: dto.guest.firstName,
          guestLastName: dto.guest.lastName,
          guestEmail: dto.guest.email.toLowerCase(),
          guestPhone: dto.guest.phone,
          guestDocument: dto.guest.document,
          guestNationality: dto.guest.nationality,
          notes: dto.notes,
          currency: pricing.currency,
          finalPrice: pricing.finalPrice,
          partnerCommission: pricing.partnerCommission,
          netPrice,
          quotedPrice,
          priceMismatch,
        },
        include: WITH_RELATIONS,
      });
    } catch (err) {
      // Carrera con la misma externalReference: devolver la existente.
      if (
        dto.externalReference &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing =
          await this.prisma.partnerBookingRequest.findUniqueOrThrow({
            where: {
              clientId_externalReference: {
                clientId: client.clientId,
                externalReference: dto.externalReference,
              },
            },
            include: WITH_RELATIONS,
          });
        return this.toPartner(existing);
      }
      throw err;
    }

    this.notifyAdmins(booking, 'created');
    return this.toPartner(booking);
  }

  async listForClient(clientId: string, q: ListPartnerBookingsQueryDto) {
    const rows = await this.prisma.partnerBookingRequest.findMany({
      where: {
        clientId,
        status: q.status,
        externalReference: q.externalReference,
      },
      orderBy: { createdAt: 'desc' },
      take: q.limit ?? 50,
      include: WITH_RELATIONS,
    });
    return rows.map((b) => this.toPartner(b));
  }

  async getForClient(clientId: string, id: string) {
    return this.toPartner(await this.findForClient(clientId, id));
  }

  async requestCancellation(clientId: string, id: string, reason: string) {
    const booking = await this.findForClient(clientId, id);
    const now = new Date();

    switch (booking.status) {
      case 'CANCELLATION_REQUESTED':
      case 'CANCELLED':
        return this.toPartner(booking); // idempotente
      case 'REJECTED':
        throw new ConflictException(
          'La solicitud fue rechazada: no hay nada que cancelar',
        );
      case 'PENDING': {
        // Todavía no se creó en Cloudbeds: se cancela directo y se avisa al admin.
        const updated = await this.transition(
          booking.id,
          'PENDING',
          {
            status: 'CANCELLED',
            cancellationReason: reason,
            cancellationRequestedAt: now,
            cancelledAt: now,
          },
          'La solicitud cambió de estado; volvé a consultarla',
        );
        this.notifyAdmins(updated, 'cancelledBeforeConfirm');
        return this.toPartner(updated);
      }
      case 'CONFIRMED': {
        const updated = await this.transition(
          booking.id,
          'CONFIRMED',
          {
            status: 'CANCELLATION_REQUESTED',
            cancellationReason: reason,
            cancellationRequestedAt: now,
          },
          'La solicitud cambió de estado; volvé a consultarla',
        );
        this.notifyAdmins(updated, 'cancellationRequested');
        return this.toPartner(updated);
      }
    }
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  async adminList(q: AdminListPartnerBookingsQueryDto) {
    const [rows, counts] = await Promise.all([
      this.prisma.partnerBookingRequest.findMany({
        where: {
          status: q.status,
          clientId: q.clientId,
          externalReference: q.externalReference,
        },
        orderBy: { createdAt: 'desc' },
        take: q.limit ?? 50,
        include: WITH_RELATIONS,
      }),
      this.prisma.partnerBookingRequest.groupBy({
        by: ['status'],
        where: { clientId: q.clientId },
        _count: { _all: true },
      }),
    ]);
    return {
      items: rows.map((b) => this.toAdmin(b)),
      counts: Object.fromEntries(
        counts.map((c) => [c.status, c._count._all]),
      ) as Partial<Record<PartnerBookingStatus, number>>,
    };
  }

  async adminGet(id: string) {
    const booking = await this.prisma.partnerBookingRequest.findUnique({
      where: { id },
      include: WITH_RELATIONS,
    });
    if (!booking) throw new NotFoundException('Solicitud no encontrada');
    return this.toAdmin(booking);
  }

  async confirm(
    id: string,
    cloudbedsReservationId: string,
    adminNotes: string | undefined,
    actorId: string,
  ) {
    const updated = await this.transition(
      id,
      'PENDING',
      {
        status: 'CONFIRMED',
        cloudbedsReservationId,
        adminNotes,
        confirmedAt: new Date(),
        handledById: actorId,
      },
      'Solo se pueden confirmar solicitudes pendientes',
    );
    await this.afterAdminAction(updated, actorId, 'PARTNER_BOOKING_CONFIRMED');
    return this.toAdmin(updated);
  }

  async reject(id: string, reason: string, actorId: string) {
    const updated = await this.transition(
      id,
      'PENDING',
      {
        status: 'REJECTED',
        rejectionReason: reason,
        rejectedAt: new Date(),
        handledById: actorId,
      },
      'Solo se pueden rechazar solicitudes pendientes',
    );
    await this.afterAdminAction(updated, actorId, 'PARTNER_BOOKING_REJECTED');
    return this.toAdmin(updated);
  }

  async confirmCancellation(
    id: string,
    adminNotes: string | undefined,
    actorId: string,
  ) {
    const updated = await this.transition(
      id,
      'CANCELLATION_REQUESTED',
      {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        adminNotes,
        handledById: actorId,
      },
      'No hay una cancelación pendiente para esta solicitud',
    );
    await this.afterAdminAction(
      updated,
      actorId,
      'PARTNER_BOOKING_CANCELLATION_CONFIRMED',
    );
    return this.toAdmin(updated);
  }

  // ─── Internos ───────────────────────────────────────────────────────────────

  /** Cambio de estado atómico: solo aplica si la solicitud sigue en `from`. */
  private async transition(
    id: string,
    from: PartnerBookingStatus,
    data: Prisma.PartnerBookingRequestUpdateManyMutationInput,
    conflictMessage: string,
  ): Promise<BookingWithRelations> {
    const exists = await this.prisma.partnerBookingRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Solicitud no encontrada');
    const { count } = await this.prisma.partnerBookingRequest.updateMany({
      where: { id, status: from },
      data,
    });
    if (count === 0) throw new ConflictException(conflictMessage);
    return this.prisma.partnerBookingRequest.findUniqueOrThrow({
      where: { id },
      include: WITH_RELATIONS,
    });
  }

  private async findForClient(clientId: string, id: string) {
    const booking = await this.prisma.partnerBookingRequest.findFirst({
      where: { id, clientId },
      include: WITH_RELATIONS,
    });
    if (!booking) throw new NotFoundException('Solicitud no encontrada');
    return booking;
  }

  private async afterAdminAction(
    booking: BookingWithRelations,
    actorId: string,
    action: string,
  ) {
    await this.audit.log({
      actorId,
      entityType: 'PartnerBookingRequest',
      entityId: booking.id,
      action,
      metadata: {
        clientId: booking.clientId,
        cloudbedsReservationId: booking.cloudbedsReservationId,
      },
    });
    this.notifyOrganization(booking);
  }

  private describe(b: BookingWithRelations) {
    return `${b.guestFirstName} ${b.guestLastName} · ${b.property.name} · ${toDate(b.checkin)} al ${toDate(b.checkout)}`;
  }

  /** Aviso a todos los admins (in-app, push y email según preferencias). */
  private notifyAdmins(
    b: BookingWithRelations,
    kind: 'created' | 'cancellationRequested' | 'cancelledBeforeConfirm',
  ) {
    const org = b.client.name;
    const payload = {
      created: {
        type: NotificationType.BOOKING_CREATED,
        title: `Nueva reserva de ${org} para crear en Cloudbeds`,
        body: `${this.describe(b)}. Reserva ${b.currency} ${Number(b.finalPrice)}, comisión del partner ${Number(b.partnerCommission)} (ya cobrada por el partner), a cobrar al huésped ${Number(b.netPrice)}${b.priceMismatch ? ' — revisar precio: no coincide con la cotización' : ''}.`,
      },
      cancellationRequested: {
        type: NotificationType.BOOKING_CANCELLATION_REQUESTED,
        title: `${org} pidió cancelar una reserva en Cloudbeds`,
        body: `${this.describe(b)} (Cloudbeds #${b.cloudbedsReservationId ?? '—'}). Motivo: ${b.cancellationReason ?? ''}`,
      },
      cancelledBeforeConfirm: {
        type: NotificationType.BOOKING_CANCELLED,
        title: `${org} canceló una solicitud pendiente`,
        body: `${this.describe(b)}. Si ya la habías creado en Cloudbeds, cancelala allá.`,
      },
    }[kind];

    this.notifications
      .sendToRole('ADMIN', {
        ...payload,
        data: { partnerBookingId: b.id, url: `${ADMIN_URL}?id=${b.id}` },
      })
      .catch((err) =>
        this.logger.error(`No se pudo notificar a los admins: ${err}`),
      );
  }

  /** Email a la cuenta principal de la organización con el nuevo estado. */
  private notifyOrganization(b: BookingWithRelations) {
    const status = STATUS_LABEL[b.status];
    const lines = [
      `La solicitud de reserva ${b.externalReference ? `${b.externalReference} ` : ''}(${this.describe(b)}) está ${status}.`,
    ];
    if (b.status === 'CONFIRMED' && b.cloudbedsReservationId) {
      lines.push(`Código de reserva: ${b.cloudbedsReservationId}.`);
      lines.push(
        `Weflex le cobrará al huésped ${b.currency} ${Number(b.netPrice)} (total ${Number(b.finalPrice)} menos tu comisión de ${Number(b.partnerCommission)}).`,
      );
    }
    if (b.status === 'REJECTED' && b.rejectionReason) {
      lines.push(`Motivo: ${b.rejectionReason}`);
    }
    this.email
      .sendNotificationEmail(
        b.client.contactEmail,
        `Weflex - Reserva ${status}`,
        lines.join('\n'),
      )
      .catch((err) =>
        this.logger.error(`No se pudo avisar a la organización: ${err}`),
      );
  }

  /** Forma pública para el partner (sin datos internos de cotización). */
  private toPartner(b: BookingWithRelations) {
    return {
      id: b.id,
      externalReference: b.externalReference,
      status: b.status,
      confirmationCode: b.cloudbedsReservationId,
      property: b.property,
      room: { roomTypeId: b.roomTypeId, rateId: b.rateId, name: b.roomName },
      checkin: toDate(b.checkin),
      checkout: toDate(b.checkout),
      nights: b.nights,
      adults: b.adults,
      children: b.children,
      guest: {
        firstName: b.guestFirstName,
        lastName: b.guestLastName,
        email: b.guestEmail,
        phone: b.guestPhone,
        document: b.guestDocument,
        nationality: b.guestNationality,
      },
      pricing: {
        currency: b.currency,
        /** Total de la reserva. */
        finalPrice: money(b.finalPrice),
        /** Lo que el partner cobró al huésped como reserva y se queda. */
        partnerCommission: money(b.partnerCommission),
        /** Porcentaje de comisión sobre el total. */
        commissionRate: commissionRate(b.finalPrice, b.partnerCommission),
        /** Lo que Weflex le cobra al huésped (total - comisión). */
        amountToCollect: money(b.netPrice),
      },
      notes: b.notes,
      rejectionReason: b.rejectionReason,
      cancellationReason: b.cancellationReason,
      createdAt: b.createdAt,
      confirmedAt: b.confirmedAt,
      cancelledAt: b.cancelledAt,
      updatedAt: b.updatedAt,
    };
  }

  private toAdmin(b: BookingWithRelations) {
    return {
      ...this.toPartner(b),
      organization: b.client,
      pricing: {
        ...this.toPartner(b).pricing,
        quotedPrice: money(b.quotedPrice),
        priceMismatch: b.priceMismatch,
      },
      adminNotes: b.adminNotes,
      rejectedAt: b.rejectedAt,
      cancellationRequestedAt: b.cancellationRequestedAt,
    };
  }
}
