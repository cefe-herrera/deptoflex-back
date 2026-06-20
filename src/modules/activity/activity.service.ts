import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingSource, BookingStatus, CommissionStatus, PropertyType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  APARTMENT: 'Departamento',
  HOUSE: 'Casa',
  STUDIO: 'Monoambiente',
  OFFICE: 'Oficina',
  OTHER: 'Otro',
};

const BOOKING_INCLUDE = {
  commission: true,
  unit: {
    select: {
      name: true,
      property: {
        select: {
          name: true,
          type: true,
          address: { select: { city: true, state: true, country: true } },
          propertyImages: {
            where: { isPrimary: true },
            take: 1,
            include: { mediaFile: { select: { url: true } } },
          },
        },
      },
    },
  },
  property: {
    select: {
      name: true,
      type: true,
      address: { select: { city: true, state: true, country: true } },
      propertyImages: {
        where: { isPrimary: true },
        take: 1,
        include: { mediaFile: { select: { url: true } } },
      },
    },
  },
  propertyFlex: {
    select: {
      name: true,
      type: true,
      address: { select: { city: true, state: true, country: true } },
      images: {
        where: { isPrimary: true },
        take: 1,
        include: { mediaFile: { select: { url: true } } },
      },
    },
  },
  professionalProfile: { select: { firstName: true, lastName: true } },
} as const;

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  private async resolveProfileId(userId: string): Promise<string | null> {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  async getEarnings(userId: string) {
    const profileId = await this.resolveProfileId(userId);
    if (!profileId) {
      return this.emptyEarnings();
    }

    const commissions = await this.prisma.commission.findMany({
      where: {
        professionalProfileId: profileId,
        status: { not: CommissionStatus.CANCELLED },
        booking: { deletedAt: null },
      },
      include: {
        booking: {
          select: {
            id: true,
            source: true,
            checkInDate: true,
            checkOutDate: true,
            clientName: true,
            unit: { select: { name: true } },
            property: { select: { name: true } },
            propertyFlex: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const bookings = await this.prisma.booking.findMany({
      where: { professionalProfileId: profileId, deletedAt: null },
      select: { source: true },
    });

    const flexCount = bookings.filter((b) => b.source === BookingSource.FLEX).length;
    const temporalesCount = bookings.filter((b) => b.source !== BookingSource.FLEX).length;

    const total = commissions.reduce((sum, c) => sum + Number(c.commissionAmount), 0);
    const pending = commissions.filter((c) =>
      c.status === CommissionStatus.PENDING || c.status === CommissionStatus.APPROVED,
    );
    const toCollect = pending.reduce((sum, c) => sum + Number(c.commissionAmount), 0);

    const pendingDates = pending
      .map((c) => c.createdAt)
      .sort((a, b) => a.getTime() - b.getTime());

    const collectRange =
      pendingDates.length >= 1
        ? `${this.fmtShort(pendingDates[0])} al ${this.fmtShort(pendingDates[pendingDates.length - 1])}`
        : null;

    const lastUpdated = commissions[0]?.updatedAt ?? new Date();

    const movements = commissions.slice(0, 20).map((c) => {
      const b = c.booking;
      const placeName = b.unit?.name ?? b.property?.name ?? b.propertyFlex?.name ?? 'Reserva';
      const type = b.source === BookingSource.FLEX ? 'FLEX' : 'TEMPORARIO';
      return {
        id: c.id,
        bookingId: b.id,
        title: `Alq. ${placeName}`,
        type,
        rangeLabel: `${this.fmtShort(b.checkInDate)} al ${this.fmtShort(b.checkOutDate)}`,
        amount: Number(c.commissionAmount),
      };
    });

    return {
      total,
      date: this.fmtShort(lastUpdated),
      flexCount,
      temporalesCount,
      toCollect,
      collectRange,
      movements,
    };
  }

  async getBookings(
    userId: string,
    page = 1,
    limit = 20,
    search?: string,
    type?: 'FLEX' | 'TEMPORARIO',
    state?: 'Activo' | 'Finalizado' | 'Cancelado',
  ) {
    const profileId = await this.resolveProfileId(userId);
    if (!profileId) {
      return { items: [], total: 0, page, limit };
    }

    const where: any = { professionalProfileId: profileId, deletedAt: null };

    if (type === 'FLEX') where.source = BookingSource.FLEX;
    if (type === 'TEMPORARIO') where.source = { not: BookingSource.FLEX };

    if (state === 'Activo') {
      where.status = { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] };
    } else if (state === 'Finalizado') {
      where.status = BookingStatus.COMPLETED;
    } else if (state === 'Cancelado') {
      where.status = { in: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] };
    }

    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { clientName: { contains: q, mode: 'insensitive' } },
        { unit: { name: { contains: q, mode: 'insensitive' } } },
        { property: { name: { contains: q, mode: 'insensitive' } } },
        { propertyFlex: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: BOOKING_INCLUDE,
      }),
      this.prisma.booking.count({ where }),
    ]);

    const items = bookings.map((b) => this.mapHistoryItem(b));
    return { items, total, page, limit };
  }

  async getBookingDetail(userId: string, bookingId: string) {
    const profileId = await this.resolveProfileId(userId);
    if (!profileId) throw new NotFoundException('Booking not found');

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, professionalProfileId: profileId, deletedAt: null },
      include: {
        ...BOOKING_INCLUDE,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        cancellationRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const base = this.mapHistoryItem(booking);
    const commission = booking.commission;

    return {
      ...base,
      status: booking.status,
      statusLabel: this.mapStatusLabel(booking.status),
      source: booking.source,
      clientEmail: booking.clientEmail,
      clientPhone: booking.clientPhone,
      currency: booking.currency,
      adults: booking.adults,
      children: booking.children,
      notes: booking.notes,
      createdAt: booking.createdAt.toISOString(),
      dateRange: `${this.fmtShort(booking.checkInDate)} al ${this.fmtShort(booking.checkOutDate)}`,
      commissionStatus: commission?.status ?? null,
      commissionStatusLabel: commission ? this.mapCommissionStatusLabel(commission.status) : null,
      statusHistory: booking.statusHistory.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        toStatusLabel: this.mapStatusLabel(h.toStatus),
        reason: h.reason,
        createdAt: h.createdAt.toISOString(),
      })),
      cancellationRequest: booking.cancellationRequests[0]
        ? {
            id: booking.cancellationRequests[0].id,
            status: booking.cancellationRequests[0].status,
            reason: booking.cancellationRequests[0].reason,
            adminNotes: booking.cancellationRequests[0].adminNotes,
            createdAt: booking.cancellationRequests[0].createdAt.toISOString(),
          }
        : null,
    };
  }

  private mapHistoryItem(b: any) {
    const isFlex = b.source === BookingSource.FLEX;
    const prop = b.propertyFlex ?? b.property ?? b.unit?.property;
    const propType = prop?.type as PropertyType | undefined;
    const address = prop?.address;
    const location = [address?.state, address?.country].filter(Boolean).join(', ') || 'Sin ubicación';
    const image =
      b.propertyFlex?.images?.[0]?.mediaFile?.url ??
      b.property?.propertyImages?.[0]?.mediaFile?.url ??
      b.unit?.property?.propertyImages?.[0]?.mediaFile?.url ??
      null;

    const commission = b.commission;
    const commissionAmount = commission ? Number(commission.commissionAmount) : 0;
    const commissionPct = commission ? Number(commission.rate) : 0;
    const amount = Number(b.totalAmount);

    const nights = b.totalNights;
    const days = Math.max(1, nights - 1);

    let reservation: string;
    if (isFlex) {
      const months = Math.max(
        1,
        Math.round(
          (b.checkOutDate.getTime() - b.checkInDate.getTime()) / (1000 * 60 * 60 * 24 * 30),
        ),
      );
      reservation = `${months} ${months === 1 ? 'mes' : 'meses'}`;
    } else {
      reservation = `${nights} ${nights === 1 ? 'noche' : 'noches'}`;
    }

    return {
      id: b.id,
      state: this.mapState(b.status),
      type: isFlex ? 'FLEX' : 'TEMPORARIO',
      propertyType: propType ? PROPERTY_TYPE_LABELS[propType] : 'Propiedad',
      buildingName: prop?.name ?? b.unit?.name ?? 'Sin nombre',
      clientName: b.clientName,
      reservation,
      nights: isFlex ? undefined : nights,
      days: isFlex ? undefined : days,
      location,
      timeAgo: this.relativeTime(b.createdAt),
      image,
      amount,
      commission: commissionAmount,
      commissionPct,
      checkInDate: b.checkInDate.toISOString(),
      checkOutDate: b.checkOutDate.toISOString(),
    };
  }

  private mapState(status: BookingStatus): 'Activo' | 'Finalizado' | 'Cancelado' {
    if (status === BookingStatus.COMPLETED) return 'Finalizado';
    if (status === BookingStatus.CANCELLED || status === BookingStatus.NO_SHOW) return 'Cancelado';
    return 'Activo';
  }

  private mapStatusLabel(status: BookingStatus): string {
    const labels: Record<BookingStatus, string> = {
      PENDING: 'Pendiente',
      CONFIRMED: 'Confirmada',
      CANCELLED: 'Cancelada',
      COMPLETED: 'Completada',
      NO_SHOW: 'No show',
    };
    return labels[status];
  }

  private mapCommissionStatusLabel(status: CommissionStatus): string {
    const labels: Record<CommissionStatus, string> = {
      PENDING: 'Pendiente de cobro',
      PENDING_VALIDATION: 'Pendiente de validación',
      APPROVED: 'Aprobada',
      PAID: 'Pagada',
      CANCELLED: 'Cancelada',
    };
    return labels[status];
  }

  private fmtShort(date: Date): string {
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  private relativeTime(date: Date): string {
    const diff = Date.now() - date.getTime();
    const min = 60_000;
    const hr = 60 * min;
    const day = 24 * hr;
    if (diff < min) return 'recién';
    if (diff < hr) return `hace ${Math.floor(diff / min)} min`;
    if (diff < day) return `hace ${Math.floor(diff / hr)} h`;
    if (diff < 7 * day) return `hace ${Math.floor(diff / day)} d`;
    return this.fmtShort(date);
  }

  private emptyEarnings() {
    return {
      total: 0,
      date: this.fmtShort(new Date()),
      flexCount: 0,
      temporalesCount: 0,
      toCollect: 0,
      collectRange: null as string | null,
      movements: [] as Array<{
        id: string;
        bookingId: string;
        title: string;
        type: string;
        rangeLabel: string;
        amount: number;
      }>,
    };
  }
}
