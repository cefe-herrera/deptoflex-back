import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  AmbassadorSessionStatus,
  BookingSource,
  BookingStatus,
  CommissionStatus,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CommissionRatesService } from '../commissions/commission-rates.service';
import { CreateReservationSessionDto } from './dto/create-reservation-session.dto';
import { CloudbedsReservationDto } from './dto/cloudbeds-reservation.dto';

/**
 * Tracking de reservas de embajador hechas en el motor público de Cloudbeds.
 *
 * NOTA IMPORTANTE: esta integración NO usa la API oficial de Cloudbeds ni sus
 * webhooks firmados. La reserva se concreta 100% en Cloudbeds y un script
 * personalizado inyectado nos avisa (postMessage + fetch). Por eso:
 *  - El `Booking` se crea con status PENDING (no CONFIRMED).
 *  - La `Commission` se crea con status PENDING_VALIDATION.
 * Sin API/webhooks oficiales no podemos validar automáticamente cancelaciones,
 * modificaciones ni no-shows: requiere validación/conciliación manual posterior.
 */
@Injectable()
export class AmbassadorsService {
  private readonly logger = new Logger(AmbassadorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionRates: CommissionRatesService,
  ) {}

  /**
   * Crea la sesión liviana ANTES de abrir Cloudbeds. La invoca el embajador
   * autenticado: validamos que el `professionalProfileId` pertenezca al usuario.
   */
  async createSession(userId: string, dto: CreateReservationSessionDto) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new ForbiddenException(
        'Necesitás un perfil profesional/embajador para iniciar una reserva',
      );
    }

    const session = await this.prisma.ambassadorBookingSession.upsert({
      where: { id: dto.sessionId },
      create: {
        id: dto.sessionId,
        professionalProfileId: profile.id,
        cloudbedsUrl: dto.cloudbedsUrl,
        status: AmbassadorSessionStatus.STARTED,
      },
      update: {
        // Reintento con el mismo session_id: refrescamos la URL pero no cambiamos dueño.
        cloudbedsUrl: dto.cloudbedsUrl,
      },
    });

    this.logger.log(
      `[Ambassador] sesión creada session_id=${session.id} ambassador=${profile.id} status=${session.status}`,
    );

    return {
      sessionId: session.id,
      ambassadorId: session.professionalProfileId,
      status: session.status,
      cloudbedsUrl: session.cloudbedsUrl,
      createdAt: session.createdAt,
    };
  }

  /**
   * Endpoint público: recibe el aviso de `reservation-created` desde el script
   * inyectado en Cloudbeds. Siempre responde OK (idempotente), incluso ante
   * payloads ya procesados, para no romper el `fetch` del navegador.
   */
  async handleCloudbedsReservation(dto: CloudbedsReservationDto) {
    this.logger.log(
      `[Ambassador] payload recibido event=${dto.event} session_id=${dto.sessionId} ambassador_id=${dto.ambassadorId} booking_id=${dto.bookingId ?? 'n/a'}`,
    );

    // event/sessionId/ambassadorId ya validados por el DTO (class-validator).
    const cloudbedsReservationId = dto.bookingId?.trim() || null;

    // 1. Buscar la sesión. Si no existe, no rompemos: logueamos y devolvemos OK.
    const session = await this.prisma.ambassadorBookingSession.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session) {
      this.logger.warn(
        `[Ambassador] sesión no encontrada session_id=${dto.sessionId} (se ignora, posible spoof o sesión expirada)`,
      );
      return { ok: true, status: 'session_not_found' as const };
    }

    // Verificación blanda: el ambassador_id del payload (de la URL) debería
    // coincidir con el dueño real de la sesión. Confiamos en la sesión, no en el payload.
    if (session.professionalProfileId !== dto.ambassadorId) {
      this.logger.warn(
        `[Ambassador] ambassador_id del payload (${dto.ambassadorId}) no coincide con el de la sesión (${session.professionalProfileId}). Se usa el de la sesión.`,
      );
    }
    const professionalProfileId = session.professionalProfileId;

    // 2. Idempotencia / dedupe.
    if (cloudbedsReservationId) {
      const existing = await this.prisma.booking.findUnique({
        where: { cloudbedsReservationId },
        select: { id: true },
      });
      if (existing) {
        this.logger.warn(
          `[Ambassador] duplicado ignorado: reserva Cloudbeds ${cloudbedsReservationId} ya registrada como booking ${existing.id}`,
        );
        return { ok: true, status: 'duplicate' as const, bookingId: existing.id };
      }
    } else if (session.status === AmbassadorSessionStatus.CONFIRMED && session.bookingId) {
      // Sin booking_id de Cloudbeds: dedupe por sesión ya confirmada.
      this.logger.warn(
        `[Ambassador] duplicado ignorado: sesión ${session.id} ya confirmada (booking ${session.bookingId})`,
      );
      return { ok: true, status: 'duplicate' as const, bookingId: session.bookingId };
    }

    // 3. Parseo del payload Cloudbeds BE Plus + fallback desde la URL de la sesión.
    const reservation = dto.reservation ?? {};
    const urlContext = this.parseUrlContext(dto.cloudbedsUrl ?? session.cloudbedsUrl);
    const guestForm = this.parseGuestForm(dto.guestForm);
    const pageMeta = this.parsePageMetadata(dto.pageMetadata);
    const parsed = this.parseReservation(reservation, urlContext, guestForm, pageMeta);

    if (Object.keys(reservation).length > 0) {
      this.logger.debug(
        `[Ambassador] reservation keys=${Object.keys(reservation).join(', ')} parsed checkIn=${parsed.checkIn.toISOString().slice(0, 10)} checkOut=${parsed.checkOut.toISOString().slice(0, 10)} amount=${parsed.totalAmount.toString()} widget_property=${parsed.widgetPropertyId ?? 'n/a'} room_type_id=${parsed.roomTypeId ?? 'n/a'}`,
      );
    }

    // 4. Resolver Property y Unit local (widget_property → Property; room_type_id → Unit).
    let propertyId: string | null = null;
    let unitId: string | null = null;

    if (parsed.widgetPropertyId) {
      const property = await this.prisma.property.findFirst({
        where: { cloudbedsWidgetPropertyId: parsed.widgetPropertyId, deletedAt: null },
        select: { id: true },
      });
      propertyId = property?.id ?? null;
    }

    if (!propertyId && parsed.roomTypeId) {
      const unit = await this.prisma.unit.findFirst({
        where: { cloudbedsRoomTypeId: parsed.roomTypeId, deletedAt: null },
        select: { id: true, propertyId: true },
      });
      if (unit) {
        unitId = unit.id;
        propertyId = unit.propertyId;
      }
    } else if (propertyId && parsed.roomTypeId) {
      const unit = await this.prisma.unit.findFirst({
        where: { propertyId, cloudbedsRoomTypeId: parsed.roomTypeId, deletedAt: null },
        select: { id: true },
      });
      unitId = unit?.id ?? null;
    }

    const notes = this.buildBookingNotes(parsed, propertyId);

    // 5. Crear Booking PENDING + Commission PENDING_VALIDATION en una transacción.
    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          source: BookingSource.CLOUDBEDS,
          status: BookingStatus.PENDING,
          propertyId,
          unitId,
          professionalProfileId,
          cloudbedsReservationId,
          clientName: parsed.clientName,
          clientEmail: parsed.clientEmail,
          clientPhone: parsed.clientPhone,
          checkInDate: parsed.checkIn,
          checkOutDate: parsed.checkOut,
          adults: parsed.adults,
          children: parsed.children,
          totalNights: parsed.totalNights,
          baseAmount: parsed.totalAmount,
          totalAmount: parsed.totalAmount,
          currency: parsed.currency,
          notes,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: created.id,
          toStatus: BookingStatus.PENDING,
          reason: 'Aviso de reservation-created desde Cloudbeds (tracking de embajador)',
        },
      });

      // Comisión NO final: PENDING_VALIDATION porque el origen es spoofable.
      const rate = propertyId
        ? await this.commissionRates.resolveTemporalRate(propertyId, professionalProfileId, tx)
        : await this.resolveDefaultRate(professionalProfileId, tx);
      const commissionAmount = parsed.totalAmount.mul(rate).div(100);
      await tx.commission.create({
        data: {
          bookingId: created.id,
          professionalProfileId,
          rate,
          baseAmount: parsed.totalAmount,
          commissionAmount,
          currency: parsed.currency,
          status: CommissionStatus.PENDING_VALIDATION,
          notes: 'Comisión pendiente de validación (sin API/webhooks oficiales de Cloudbeds).',
        },
      });

      await tx.ambassadorBookingSession.update({
        where: { id: session.id },
        data: {
          status: AmbassadorSessionStatus.CONFIRMED,
          bookingId: created.id,
          cloudbedsReservationId,
        },
      });

      return created;
    });

    this.logger.log(
      `[Ambassador] reserva asociada al embajador booking=${booking.id} ambassador=${professionalProfileId} property=${propertyId ?? 'sin-mapear'}`,
    );
    this.logger.log(
      `[Ambassador] comisión PENDING_VALIDATION creada para booking=${booking.id}`,
    );

    return { ok: true, status: 'created' as const, bookingId: booking.id };
  }

  /** Tasa por defecto del embajador cuando no pudimos mapear la propiedad. */
  private async resolveDefaultRate(
    professionalProfileId: string,
    tx: Prisma.TransactionClient,
  ): Promise<Decimal> {
    const profile = await tx.professionalProfile.findUnique({
      where: { id: professionalProfileId },
      select: { defaultCommissionRate: true },
    });
    return profile?.defaultCommissionRate ?? new Decimal(0);
  }

  /** Contexto parseado de la URL del motor (fallback si el evento viene incompleto). */
  private parseUrlContext(urlStr: string | null | undefined): {
    checkin: string | null;
    checkout: string | null;
    roomTypeId: string | null;
    adults: number | null;
    children: number | null;
    widgetPropertyId: string | null;
    propertyCode: string | null;
  } {
    const empty = {
      checkin: null,
      checkout: null,
      roomTypeId: null,
      adults: null,
      children: null,
      widgetPropertyId: null,
      propertyCode: null,
    };
    if (!urlStr) return empty;
    try {
      const url = new URL(urlStr);
      const params = url.searchParams;
      const adults = params.get('adults');
      const children = params.get('children');
      const pathMatch = url.pathname.match(/\/reservation\/([^/?#]+)/i);
      return {
        checkin: params.get('checkin') ?? params.get('checkin_date'),
        checkout: params.get('checkout') ?? params.get('checkout_date'),
        roomTypeId:
          params.get('room_type_id') ?? params.get('roomTypeId') ?? params.get('rid'),
        adults: adults ? Number(adults) : null,
        children: children ? Number(children) : null,
        widgetPropertyId: params.get('widget_property'),
        propertyCode: pathMatch?.[1] ?? null,
      };
    } catch {
      return empty;
    }
  }

  /** Huésped capturado del DOM por el script (prioridad sobre reservation-created). */
  private parseGuestForm(guestForm?: Record<string, unknown>): {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } {
    if (!guestForm) {
      return { firstName: null, lastName: null, email: null, phone: null };
    }
    return {
      firstName: this.pickString(guestForm, ['firstName', 'first_name', 'guest_first_name']),
      lastName: this.pickString(guestForm, ['lastName', 'last_name', 'guest_last_name']),
      email: this.pickString(guestForm, ['email', 'guest_email']),
      phone: this.pickString(guestForm, ['phone', 'guest_phone', 'telephone', 'mobile']),
    };
  }

  /** Metadata embebida en el HTML del motor (data-metadata / JSON-LD). */
  private parsePageMetadata(pageMetadata?: Record<string, unknown>): {
    propertyCode: string | null;
    hotelName: string | null;
    locationHint: string | null;
  } {
    if (!pageMetadata) {
      return { propertyCode: null, hotelName: null, locationHint: null };
    }
    const hotelName = this.pickString(pageMetadata, ['hotelName', 'name']);
    const city = this.pickString(pageMetadata, ['city', 'addressLocality']);
    const region = this.pickString(pageMetadata, ['region', 'addressRegion']);
    const street = this.pickString(pageMetadata, ['streetAddress']);
    const locationParts = [street, city, region].filter(Boolean);
    return {
      propertyCode: this.pickString(pageMetadata, ['propertyCode', 'property_code']),
      hotelName,
      locationHint: locationParts.length > 0 ? locationParts.join(', ') : null,
    };
  }

  /** Lee el primer string no vacío entre varias claves candidatas. */
  private pickString(obj: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return null;
  }

  private pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const n = Number(value.replace(/[^0-9.-]/g, ''));
        if (Number.isFinite(n)) return n;
      }
    }
    return null;
  }

  private buildBookingNotes(
    parsed: ReturnType<AmbassadorsService['parseReservation']>,
    propertyId: string | null,
  ): string {
    let notes =
      'Reserva atribuida vía tracking de embajador (Cloudbeds, sin API oficial). Pendiente de validación.';
    if (!propertyId) {
      if (parsed.hotelName) notes += ` Hotel: ${parsed.hotelName}.`;
      if (parsed.locationHint) notes += ` Ubicación reportada: ${parsed.locationHint}.`;
    }
    return notes;
  }

  /**
   * Parsea el objeto `reservation` del evento `reservation-created` de Cloudbeds BE Plus.
   * Campos documentados: checkin_date, checkout_date, booking_total, real_booking_total,
   * currency_code, widget_property, resRooms[], hotel_name.
   */
  private parseReservation(
    reservation: Record<string, unknown>,
    urlContext?: ReturnType<AmbassadorsService['parseUrlContext']>,
    guestForm?: ReturnType<AmbassadorsService['parseGuestForm']>,
    pageMeta?: ReturnType<AmbassadorsService['parsePageMetadata']>,
  ): {
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    checkIn: Date;
    checkOut: Date;
    adults: number;
    children: number;
    totalNights: number;
    totalAmount: Decimal;
    currency: string;
    widgetPropertyId: string | null;
    roomTypeId: string | null;
    hotelName: string | null;
    locationHint: string | null;
  } {
    const resRooms = Array.isArray(reservation.resRooms)
      ? (reservation.resRooms as Array<Record<string, unknown>>)
      : [];
    const firstRoom = resRooms[0] ?? {};
    const mailInfo =
      reservation.mail_info && typeof reservation.mail_info === 'object'
        ? (reservation.mail_info as Record<string, unknown>)
        : null;

    const firstName =
      guestForm?.firstName ??
      this.pickString(reservation, ['guest_first_name', 'firstName', 'first_name']) ??
      (mailInfo ? this.pickString(mailInfo, ['first_name']) : null);
    const lastName =
      guestForm?.lastName ??
      this.pickString(reservation, ['guest_last_name', 'lastName', 'last_name']) ??
      (mailInfo ? this.pickString(mailInfo, ['last_name']) : null);
    const fullName =
      this.pickString(reservation, ['guest_name', 'guestName', 'name']) ??
      (mailInfo ? this.pickString(mailInfo, ['name']) : null);
    const clientName = fullName ?? [firstName, lastName].filter(Boolean).join(' ').trim();

    const clientEmail =
      guestForm?.email ??
      this.pickString(reservation, ['guest_email', 'email']) ??
      (mailInfo ? this.pickString(mailInfo, ['email']) : null);
    const clientPhone =
      guestForm?.phone ??
      this.pickString(reservation, ['guest_phone', 'phone']) ??
      (mailInfo ? this.pickString(mailInfo, ['phone']) : null);

    const checkInStr =
      this.pickString(reservation, [
        'checkin_date',
        'checkin',
        'checkIn',
        'check_in',
        'start_date',
      ]) ??
      urlContext?.checkin ??
      null;
    const checkOutStr =
      this.pickString(reservation, [
        'checkout_date',
        'checkout',
        'checkOut',
        'check_out',
        'end_date',
      ]) ??
      urlContext?.checkout ??
      null;

    const checkIn = this.toDate(checkInStr) ?? new Date();
    const checkOut =
      this.toDate(checkOutStr) ?? new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);

    const nights = Math.max(
      1,
      Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const adults =
      this.pickNumber(firstRoom, ['adults']) ??
      this.pickNumber(reservation, ['adults', 'total_adults']) ??
      urlContext?.adults ??
      1;
    const children =
      this.pickNumber(firstRoom, ['kids']) ??
      this.pickNumber(reservation, ['children', 'kids', 'total_kids']) ??
      urlContext?.children ??
      0;

    const amount =
      this.pickNumber(reservation, ['real_booking_total', 'booking_total']) ??
      this.pickNumber(firstRoom, ['room_total']) ??
      this.pickNumber(reservation, [
        'grand_total',
        'grandTotal',
        'total',
        'total_amount',
        'totalAmount',
        'balance',
      ]);

    const currency =
      this.pickString(reservation, ['currency_code', 'currency', 'currencyCode'])?.toUpperCase() ??
      'ARS';

    const widgetPropertyId =
      this.pickString(reservation, [
        'widget_property',
        'property_id',
        'propertyID',
        'propertyId',
      ]) ??
      urlContext?.widgetPropertyId ??
      null;

    const roomTypeId =
      this.pickString(firstRoom, ['room_type_id', 'roomTypeId']) ??
      this.pickString(reservation, ['room_type_id', 'roomTypeId']) ??
      urlContext?.roomTypeId ??
      null;

    const hotelName =
      this.pickString(reservation, ['hotel_name']) ?? pageMeta?.hotelName ?? null;
    const city = this.pickString(reservation, ['city']);
    const state = this.pickString(reservation, ['state']);
    const locationHint =
      [city, state].filter(Boolean).join(', ') || pageMeta?.locationHint || null;

    return {
      clientName: clientName || 'Cloudbeds Guest',
      clientEmail,
      clientPhone,
      checkIn,
      checkOut,
      adults: Math.trunc(adults),
      children: Math.trunc(children),
      totalNights: nights,
      totalAmount: new Decimal(amount ?? 0),
      currency: currency.slice(0, 3),
      widgetPropertyId,
      roomTypeId,
      hotelName,
      locationHint,
    };
  }

  private toDate(value: string | null): Date | null {
    if (!value) return null;
    const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
}
