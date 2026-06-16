import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingSource,
  BookingStatus,
  Prisma,
  UnitStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudbedsService } from '../cloudbeds/cloudbeds.service';
import { DashboardModality } from './dto/admin-dashboard-query.dto';

const ACTIVE_STATUSES: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];
const HIGH_OCCUPANCY_THRESHOLD = 85;

export interface DashboardBookingRow {
  id: string;
  clientName: string;
  status: BookingStatus;
  source: BookingSource;
  checkInDate: string;
  checkOutDate: string;
  totalNights: number;
  totalAmount: number;
  currency: string;
  unitName: string | null;
  propertyName: string | null;
}

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function dayRange(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

function overlapsNight(checkIn: Date, checkOut: Date, day: Date): boolean {
  return checkIn <= day && checkOut > day;
}

function decimalToNumber(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === 'number' ? v : Number(v);
}

@Injectable()
export class AdminDashboardService {
  constructor(
    private prisma: PrismaService,
    private cloudbeds: CloudbedsService,
  ) {}

  async getDashboard(query: {
    date?: string;
    propertyId?: string;
    modality?: DashboardModality;
  }) {
    const refDate = query.date ? parseDateOnly(query.date) : parseDateOnly(toDateStr(new Date()));
    const dateStr = toDateStr(refDate);
    const modality = query.modality ?? DashboardModality.TEMPORAL;
    const tomorrow = addDays(refDate, 1);

    const [platform, properties, bookings, flexBookings, units, blocks, intentCounts, flexInventory] =
      await Promise.all([
        this.getPlatformStats(),
        this.listProperties(),
        this.loadBookings(query.propertyId, modality),
        modality !== DashboardModality.TEMPORAL ? this.loadFlexBookings() : Promise.resolve([]),
        this.loadUnits(query.propertyId, modality),
        this.loadBlocks(query.propertyId),
        this.loadIntentFunnel(query.propertyId, refDate),
        modality !== DashboardModality.TEMPORAL ? this.countFlexInventory() : Promise.resolve(0),
      ]);

    const bookingRows = bookings.map((b) => this.toRow(b));
    const activeBookings = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status));

    const todayKpis = this.computeTodayKpis(
      activeBookings,
      bookings,
      flexBookings,
      units,
      flexInventory,
      refDate,
      tomorrow,
      modality,
    );

    const activity = this.computeActivity(bookings, flexBookings, refDate, modality);
    const reservations = this.buildReservationLists(
      bookingRows,
      flexBookings,
      refDate,
      tomorrow,
      modality,
    );

    const forecastDays = dayRange(refDate, 14);
    const forecast = this.buildForecast(
      activeBookings,
      flexBookings,
      units,
      blocks,
      forecastDays,
      modality,
    );

    const availability = this.buildAvailabilityMatrix(
      activeBookings,
      units,
      blocks,
      forecastDays,
    );

    const cloudbedsSnapshot = await this.getLatestCloudbedsSnapshot(query.propertyId);

    return {
      date: dateStr,
      propertyId: query.propertyId ?? null,
      modality,
      disclaimer:
        'Métricas basadas en reservas registradas en DeptoFlex. Puede diferir de Cloudbeds si hay reservas externas.',
      today: todayKpis,
      activity,
      reservations,
      platform,
      properties,
      forecast,
      availability,
      intentFunnel: intentCounts,
      cloudbedsSnapshot,
    };
  }

  async syncCloudbeds(propertyId: string, date?: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('Property not found');
    if (!property.cloudbedsWidgetPropertyId) {
      throw new BadRequestException('La propiedad no tiene mapeo Cloudbeds');
    }

    const start = date ? parseDateOnly(date) : parseDateOnly(toDateStr(new Date()));
    const end = addDays(start, 14);

    const result = await this.cloudbeds.searchAvailability({
      propertyId: property.cloudbedsWidgetPropertyId,
      checkin: toDateStr(start),
      checkout: toDateStr(end),
      currencyCode: property.defaultCurrency ?? 'ARS',
      lang: property.defaultLanguage ?? 'es',
      adults: 1,
      children: 0,
    });

    return {
      syncedAt: new Date().toISOString(),
      propertyId: property.id,
      propertyName: property.name,
      checkin: toDateStr(start),
      checkout: toDateStr(end),
      totalAvailable: result.totalAvailable,
      rooms: result.rooms.map((r) => ({
        roomTypeId: r.roomTypeId,
        name: r.name,
        remaining: r.remaining,
        totalRooms: r.totalRooms,
      })),
    };
  }

  private async getPlatformStats() {
    const [totalUsers, totalProperties, pendingAmbassadors, activeAmbassadors] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.property.count({ where: { deletedAt: null } }),
        this.prisma.professionalProfile.count({
          where: { ambassadorRequestedAt: { not: null }, status: 'PENDING' },
        }),
        this.prisma.professionalProfile.count({ where: { status: 'ACTIVE' } }),
      ]);
    return { totalUsers, totalProperties, pendingAmbassadors, activeAmbassadors };
  }

  private async listProperties() {
    return this.prisma.property.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, cloudbedsWidgetPropertyId: true },
      orderBy: { name: 'asc' },
    });
  }

  private bookingWhere(propertyId?: string, modality?: DashboardModality): Prisma.BookingWhereInput {
    const where: Prisma.BookingWhereInput = { deletedAt: null };
    if (propertyId) where.propertyId = propertyId;
    if (modality === DashboardModality.TEMPORAL) {
      where.source = { in: [BookingSource.CLOUDBEDS, BookingSource.DIRECT] };
    } else if (modality === DashboardModality.FLEX) {
      where.source = BookingSource.FLEX;
    }
    return where;
  }

  private async loadBookings(propertyId?: string, modality?: DashboardModality) {
    return this.prisma.booking.findMany({
      where: this.bookingWhere(propertyId, modality),
      include: {
        unit: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
      orderBy: { checkInDate: 'asc' },
    });
  }

  private async loadFlexBookings(_propertyId?: string) {
    return this.prisma.flexBooking.findMany({
      where: {
        deletedAt: null,
        status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING'] },
      },
      include: {
        propertyFlex: { select: { id: true, name: true } },
      },
    });
  }

  private async countFlexInventory() {
    return this.prisma.propertyFlex.count({
      where: { deletedAt: null, status: 'ACTIVE' },
    });
  }

  private async loadUnits(propertyId?: string, modality?: DashboardModality) {
    const where: Prisma.UnitWhereInput = {
      deletedAt: null,
      status: UnitStatus.ACTIVE,
    };
    if (propertyId) where.propertyId = propertyId;
    if (modality === DashboardModality.TEMPORAL) {
      where.OR = [{ rentalModality: 'TEMPORAL' }, { rentalModality: null }];
    } else if (modality === DashboardModality.FLEX) {
      where.rentalModality = 'FLEX';
    }
    return this.prisma.unit.findMany({
      where,
      select: { id: true, name: true, propertyId: true, cloudbedsRoomTypeId: true },
    });
  }

  private async loadBlocks(propertyId?: string) {
    return this.prisma.unitAvailability.findMany({
      where: {
        isAvailable: false,
        ...(propertyId && { unit: { propertyId } }),
      },
      include: { unit: { select: { id: true, name: true, cloudbedsRoomTypeId: true } } },
    });
  }

  private async loadIntentFunnel(propertyId: string | undefined, refDate: Date) {
    const since = addDays(refDate, -30);
    const counts = await this.prisma.reservationIntent.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: since, lte: addDays(refDate, 1) },
        ...(propertyId && { propertyId }),
      },
      _count: { _all: true },
    });

    const map = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
    const pending = map.PENDING ?? 0;
    const redirected = map.REDIRECTED ?? 0;
    const confirmed = map.CONFIRMED ?? 0;
    const expired = map.EXPIRED ?? 0;
    const started = pending + redirected + confirmed + expired;
    const conversionRate = started > 0 ? Math.round((confirmed / started) * 1000) / 10 : 0;

    return { pending, redirected, confirmed, expired, conversionRate };
  }

  private async getLatestCloudbedsSnapshot(propertyId?: string) {
    if (!propertyId) return null;
    const snap = await this.prisma.availabilitySnapshot.findFirst({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      include: { property: { select: { name: true } } },
    });
    if (!snap) return null;
    return {
      syncedAt: snap.createdAt.toISOString(),
      totalAvailable: snap.totalAvailable,
      propertyName: snap.property.name,
      checkin: toDateStr(snap.checkin),
      checkout: toDateStr(snap.checkout),
    };
  }

  private toRow(b: Awaited<ReturnType<typeof this.loadBookings>>[number]): DashboardBookingRow {
    return {
      id: b.id,
      clientName: b.clientName,
      status: b.status,
      source: b.source,
      checkInDate: toDateStr(b.checkInDate),
      checkOutDate: toDateStr(b.checkOutDate),
      totalNights: b.totalNights,
      totalAmount: decimalToNumber(b.totalAmount),
      currency: b.currency,
      unitName: b.unit?.name ?? null,
      propertyName: b.property?.name ?? null,
    };
  }

  private computeTodayKpis(
    activeBookings: Awaited<ReturnType<typeof this.loadBookings>>,
    allBookings: Awaited<ReturnType<typeof this.loadBookings>>,
    flexBookings: Awaited<ReturnType<typeof this.loadFlexBookings>>,
    units: Awaited<ReturnType<typeof this.loadUnits>>,
    flexInventory: number,
    refDate: Date,
    tomorrow: Date,
    modality: DashboardModality,
  ) {
    const refStr = toDateStr(refDate);
    const tomorrowStr = toDateStr(tomorrow);

    let arrivals = 0;
    let departures = 0;
    let inHouse = 0;
    let occupiedUnits = 0;

    for (const b of activeBookings) {
      const ci = toDateStr(b.checkInDate);
      const co = toDateStr(b.checkOutDate);
      if (ci === refStr) arrivals += 1;
      if (co === refStr) departures += 1;
      if (overlapsNight(b.checkInDate, b.checkOutDate, refDate)) {
        inHouse += 1;
        occupiedUnits += 1;
      }
    }

    if (modality !== DashboardModality.TEMPORAL) {
      for (const fb of flexBookings.filter((f) => ['CONFIRMED', 'COMPLETED'].includes(f.status))) {
        const start = parseDateOnly(toDateStr(fb.startDate));
        const end = parseDateOnly(toDateStr(fb.endDate));
        const ci = toDateStr(fb.startDate);
        const co = toDateStr(fb.endDate);
        if (ci === refStr) arrivals += 1;
        if (co === refStr) departures += 1;
        if (overlapsNight(start, end, refDate)) {
          inHouse += 1;
          occupiedUnits += 1;
        }
      }
    }

    const pendingConfirmation =
      allBookings.filter((b) => b.status === BookingStatus.PENDING).length +
      (modality !== DashboardModality.TEMPORAL
        ? flexBookings.filter((f) => f.status === 'PENDING').length
        : 0);

    const totalInventory =
      modality === DashboardModality.FLEX
        ? flexInventory
        : modality === DashboardModality.ALL
          ? units.length + flexInventory
          : units.length;

    const occupancyPercent =
      totalInventory > 0 ? Math.round((occupiedUnits / totalInventory) * 10000) / 100 : null;

    return {
      arrivals,
      departures,
      inHouse,
      pendingConfirmation,
      occupancyPercent,
      totalInventory,
      tomorrowArrivals: this.countArrivalsOn(activeBookings, flexBookings, tomorrowStr, modality),
      tomorrowDepartures: this.countDeparturesOn(activeBookings, flexBookings, tomorrowStr, modality),
    };
  }

  private countArrivalsOn(
    bookings: Awaited<ReturnType<typeof this.loadBookings>>,
    flexBookings: Awaited<ReturnType<typeof this.loadFlexBookings>>,
    dateStr: string,
    modality: DashboardModality,
  ) {
    let n = bookings.filter(
      (b) => ACTIVE_STATUSES.includes(b.status) && toDateStr(b.checkInDate) === dateStr,
    ).length;
    if (modality !== DashboardModality.TEMPORAL) {
      n += flexBookings.filter(
        (f) => ['CONFIRMED', 'COMPLETED'].includes(f.status) && toDateStr(f.startDate) === dateStr,
      ).length;
    }
    return n;
  }

  private countDeparturesOn(
    bookings: Awaited<ReturnType<typeof this.loadBookings>>,
    flexBookings: Awaited<ReturnType<typeof this.loadFlexBookings>>,
    dateStr: string,
    modality: DashboardModality,
  ) {
    let n = bookings.filter(
      (b) => ACTIVE_STATUSES.includes(b.status) && toDateStr(b.checkOutDate) === dateStr,
    ).length;
    if (modality !== DashboardModality.TEMPORAL) {
      n += flexBookings.filter(
        (f) => ['CONFIRMED', 'COMPLETED'].includes(f.status) && toDateStr(f.endDate) === dateStr,
      ).length;
    }
    return n;
  }

  private computeActivity(
    bookings: Awaited<ReturnType<typeof this.loadBookings>>,
    flexBookings: Awaited<ReturnType<typeof this.loadFlexBookings>>,
    refDate: Date,
    modality: DashboardModality,
  ) {
    const refStr = toDateStr(refDate);
    const dayStart = refDate;
    const dayEnd = addDays(refDate, 1);

    const createdToday = bookings.filter(
      (b) => b.createdAt >= dayStart && b.createdAt < dayEnd,
    );
    const flexCreatedToday =
      modality !== DashboardModality.TEMPORAL
        ? flexBookings.filter((f) => f.createdAt >= dayStart && f.createdAt < dayEnd)
        : [];
    const cancelledToday = bookings.filter(
      (b) =>
        b.status === BookingStatus.CANCELLED &&
        b.updatedAt >= dayStart &&
        b.updatedAt < dayEnd,
    );

    let revenueToday = 0;
    let nightsSoldToday = 0;
    const sales: DashboardBookingRow[] = [];

    for (const b of createdToday.filter((x) => ACTIVE_STATUSES.includes(x.status))) {
      revenueToday += decimalToNumber(b.totalAmount);
      nightsSoldToday += b.totalNights;
      sales.push(this.toRow(b));
    }

    if (modality !== DashboardModality.TEMPORAL) {
      for (const fb of flexBookings.filter(
        (f) => f.createdAt >= dayStart && f.createdAt < dayEnd && this.isConfirmedLike(f),
      )) {
        revenueToday += decimalToNumber(fb.totalAmount);
        nightsSoldToday += fb.totalMonths * 30;
        sales.push({
          id: fb.id,
          clientName: fb.clientName,
          status: fb.status as BookingStatus,
          source: BookingSource.FLEX,
          checkInDate: toDateStr(fb.startDate),
          checkOutDate: toDateStr(fb.endDate),
          totalNights: fb.totalMonths * 30,
          totalAmount: decimalToNumber(fb.totalAmount),
          currency: 'ARS',
          unitName: fb.propertyFlex?.name ?? null,
          propertyName: fb.propertyFlex?.name ?? null,
        });
      }
    }

    return {
      bookingsCreatedToday: createdToday.length + flexCreatedToday.length,
      nightsSoldToday,
      revenueToday,
      currency: 'ARS',
      cancellationsToday: cancelledToday.length,
      sales: sales.slice(0, 20),
    };
  }

  private isConfirmedLike(b: { status: string }) {
    return ['CONFIRMED', 'COMPLETED'].includes(b.status);
  }

  private buildReservationLists(
    bookingRows: DashboardBookingRow[],
    flexBookings: Awaited<ReturnType<typeof this.loadFlexBookings>>,
    refDate: Date,
    tomorrow: Date,
    modality: DashboardModality,
  ) {
    const refStr = toDateStr(refDate);
    const tomorrowStr = toDateStr(tomorrow);

    const flexRows: DashboardBookingRow[] =
      modality === DashboardModality.TEMPORAL
        ? []
        : flexBookings
            .filter((f) => ['CONFIRMED', 'COMPLETED', 'PENDING'].includes(f.status))
            .map((fb) => ({
              id: fb.id,
              clientName: fb.clientName,
              status: fb.status as BookingStatus,
              source: BookingSource.FLEX,
              checkInDate: toDateStr(fb.startDate),
              checkOutDate: toDateStr(fb.endDate),
              totalNights: fb.totalMonths * 30,
              totalAmount: decimalToNumber(fb.totalAmount),
              currency: 'ARS',
              unitName: fb.propertyFlex?.name ?? null,
              propertyName: fb.propertyFlex?.name ?? null,
            }));

    const all = [...bookingRows.filter((b) => ACTIVE_STATUSES.includes(b.status)), ...flexRows];

    return {
      arrivals: all.filter((b) => b.checkInDate === refStr),
      departures: all.filter((b) => b.checkOutDate === refStr),
      inHouse: all.filter((b) => {
        const ci = parseDateOnly(b.checkInDate);
        const co = parseDateOnly(b.checkOutDate);
        return overlapsNight(ci, co, refDate);
      }),
      tomorrowArrivals: all.filter((b) => b.checkInDate === tomorrowStr),
      tomorrowDepartures: all.filter((b) => b.checkOutDate === tomorrowStr),
    };
  }

  private buildForecast(
    activeBookings: Awaited<ReturnType<typeof this.loadBookings>>,
    flexBookings: Awaited<ReturnType<typeof this.loadFlexBookings>>,
    units: Awaited<ReturnType<typeof this.loadUnits>>,
    blocks: Awaited<ReturnType<typeof this.loadBlocks>>,
    days: Date[],
    modality: DashboardModality,
  ) {
    const totalUnits = units.length || 1;
    const dayLabels = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

    const forecastDays = days.map((day) => {
      let occupied = 0;
      let blocked = 0;
      let revenue = 0;

      for (const b of activeBookings) {
        if (overlapsNight(b.checkInDate, b.checkOutDate, day)) {
          occupied += 1;
          const nights = Math.max(b.totalNights, 1);
          revenue += decimalToNumber(b.totalAmount) / nights;
        }
      }

      if (modality !== DashboardModality.TEMPORAL) {
        for (const fb of flexBookings.filter((f) => ['CONFIRMED', 'COMPLETED'].includes(f.status))) {
          const start = parseDateOnly(toDateStr(fb.startDate));
          const end = parseDateOnly(toDateStr(fb.endDate));
          if (overlapsNight(start, end, day)) {
            occupied += 1;
            const contractDays = Math.max(
              Math.ceil((end.getTime() - start.getTime()) / 86400000),
              1,
            );
            revenue += decimalToNumber(fb.totalAmount) / contractDays;
          }
        }
      }

      for (const bl of blocks) {
        if (overlapsNight(bl.startDate, bl.endDate, day)) blocked += 1;
      }

      const occupancyPercent = Math.round((occupied / totalUnits) * 10000) / 100;

      return {
        date: toDateStr(day),
        dayLabel: `${dayLabels[day.getUTCDay()]} ${day.getUTCDate()}`,
        occupiedUnits: occupied,
        blockedUnits: blocked,
        totalUnits,
        occupancyPercent,
        revenue: Math.round(revenue * 100) / 100,
        highOccupancy: occupancyPercent >= HIGH_OCCUPANCY_THRESHOLD,
      };
    });

    const occupancyPercent14d =
      forecastDays.length > 0
        ? Math.round(
            (forecastDays.reduce((s, d) => s + d.occupancyPercent, 0) / forecastDays.length) * 100,
          ) / 100
        : 0;
    const revenue14d = Math.round(forecastDays.reduce((s, d) => s + d.revenue, 0) * 100) / 100;

    return { occupancyPercent14d, revenue14d, days: forecastDays };
  }

  private buildAvailabilityMatrix(
    activeBookings: Awaited<ReturnType<typeof this.loadBookings>>,
    units: Awaited<ReturnType<typeof this.loadUnits>>,
    blocks: Awaited<ReturnType<typeof this.loadBlocks>>,
    days: Date[],
  ) {
    type Group = { key: string; name: string; unitIds: string[] };
    const groups = new Map<string, Group>();

    for (const u of units) {
      const key = u.cloudbedsRoomTypeId ?? u.name;
      if (!groups.has(key)) {
        groups.set(key, { key, name: u.name, unitIds: [] });
      }
      groups.get(key)!.unitIds.push(u.id);
    }

    if (groups.size === 0) {
      groups.set('general', { key: 'general', name: 'General', unitIds: [] });
    }

    const unitToGroup = new Map<string, string>();
    for (const g of groups.values()) {
      for (const id of g.unitIds) unitToGroup.set(id, g.key);
    }

    const overbookings: { date: string; unitTypeName: string; deficit: number }[] = [];
    const rows = [...groups.values()].map((group) => {
      const totalUnits = Math.max(group.unitIds.length, 1);
      const dayCells = days.map((day) => {
        let reserved = 0;
        let blocked = 0;

        for (const b of activeBookings) {
          if (!overlapsNight(b.checkInDate, b.checkOutDate, day)) continue;
          if (b.unitId && group.unitIds.includes(b.unitId)) reserved += 1;
          else if (!b.unitId && group.key === 'general') reserved += 1;
        }

        for (const bl of blocks) {
          if (!overlapsNight(bl.startDate, bl.endDate, day)) continue;
          if (group.unitIds.includes(bl.unitId)) blocked += 1;
        }

        const available = Math.max(totalUnits - reserved - blocked, 0);
        const deficit = reserved + blocked - totalUnits;
        if (deficit > 0) {
          overbookings.push({
            date: toDateStr(day),
            unitTypeName: group.name,
            deficit,
          });
        }

        return {
          date: toDateStr(day),
          available,
          reserved,
          blocked,
          isSoldOut: available === 0,
        };
      });

      return { unitTypeName: group.name, unitTypeKey: group.key, totalUnits, days: dayCells };
    });

    const summaryRow = days.map((day) => {
      const date = toDateStr(day);
      let totalAvailable = 0;
      for (const row of rows) {
        const cell = row.days.find((d) => d.date === date);
        if (cell) totalAvailable += cell.available;
      }
      return { date, totalAvailable };
    });

    return { rows, summaryRow, overbookings };
  }
}
