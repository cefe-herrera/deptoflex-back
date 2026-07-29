import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  CommissionStatus,
  LeadStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudbedsService } from '../cloudbeds/cloudbeds.service';
import { DashboardActivityPeriod } from './dto/admin-dashboard-query.dto';
import { countAmbassadorsWithIncompleteDocs } from '../professionals/ambassador-documents.util';

type ActivityPeriod = '7d' | '30d' | 'month';

export interface QueueAmount {
  count: number;
  amount: number;
  currency: string;
}

interface AmbassadorRow {
  id: string;
  name: string;
  bookings: number;
  gmv: number;
  commissions: number;
  leads: number;
  sessions: number;
  sessionsConfirmed: number;
  lastActivityAt: Date | null;
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

function startOfMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function periodStart(period: ActivityPeriod): Date {
  const now = new Date();
  if (period === '7d') return addDays(now, -7);
  if (period === '30d') return addDays(now, -30);
  return startOfMonth(now);
}

function decimalToNumber(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === 'number' ? v : Number(v);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function conversionRate(confirmed: number, started: number): number | null {
  if (started < 3) return null;
  return Math.round((confirmed / started) * 1000) / 10;
}

function maxDate(...dates: (Date | null | undefined)[]): Date | null {
  const valid = dates.filter((d): d is Date => d != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a > b ? a : b));
}

function daysSince(date: Date | null): number {
  if (!date) return 999;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

const DAY_LABELS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

function dayRangeInclusive(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}

function dayLabel(d: Date): string {
  return `${DAY_LABELS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

export interface EvolutionDay {
  date: string;
  dayLabel: string;
  bookings: number;
  bookingsGmv: number;
  commissions: number;
  commissionsAmount: number;
  settlementsPaid: number;
  settlementsPaidAmount: number;
}

function emptyEvolutionDay(d: Date): EvolutionDay {
  return {
    date: toDateStr(d),
    dayLabel: dayLabel(d),
    bookings: 0,
    bookingsGmv: 0,
    commissions: 0,
    commissionsAmount: 0,
    settlementsPaid: 0,
    settlementsPaidAmount: 0,
  };
}

@Injectable()
export class AdminDashboardService {
  constructor(
    private prisma: PrismaService,
    private cloudbeds: CloudbedsService,
  ) {}

  async getDashboard(query: { period?: DashboardActivityPeriod }) {
    const period = (query.period ?? DashboardActivityPeriod['30d']) as ActivityPeriod;
    const refDate = parseDateOnly(toDateStr(new Date()));

    const [queues, health, intentFunnel, ambassadorActivity, evolution] = await Promise.all([
      this.getQueueStats(),
      this.getHealthStats(),
      this.loadIntentFunnel(refDate),
      this.getAmbassadorActivityStats(period),
      this.getOperationsEvolution(period),
    ]);

    return {
      period,
      disclaimer:
        'Centro de operaciones de plataforma. Métricas hoteleras disponibles en Reservas.',
      queues,
      health,
      intentFunnel,
      ambassadorActivity,
      evolution,
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

  private async getQueueStats() {
    const [
      pendingValidation,
      approvedUnpaid,
      settlementsDraft,
      flexPaymentsPending,
      bookingsPending,
      incompleteDocsProfiles,
    ] = await Promise.all([
      this.prisma.commission.aggregate({
        where: { status: CommissionStatus.PENDING_VALIDATION },
        _count: { _all: true },
        _sum: { commissionAmount: true },
      }),
      this.prisma.commission.aggregate({
        where: {
          status: CommissionStatus.APPROVED,
          settlementId: null,
        },
        _count: { _all: true },
        _sum: { commissionAmount: true },
      }),
      this.prisma.commissionSettlement.aggregate({
        where: { status: 'DRAFT' },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.flexBookingPayment.count({ where: { status: 'PENDING' } }),
      this.prisma.booking.count({
        where: { deletedAt: null, status: BookingStatus.PENDING },
      }),
      this.prisma.professionalProfile.findMany({
        where: { status: 'ACTIVE' },
        select: {
          personType: true,
          ambassadorDocuments: { select: { documentType: true } },
        },
      }),
    ]);

    const toQueue = (
      count: number,
      amount: Prisma.Decimal | null | undefined,
    ): QueueAmount => ({
      count,
      amount: roundMoney(decimalToNumber(amount)),
      currency: 'ARS',
    });

    return {
      commissionsPendingValidation: toQueue(
        pendingValidation._count._all,
        pendingValidation._sum.commissionAmount,
      ),
      commissionsApprovedUnpaid: toQueue(
        approvedUnpaid._count._all,
        approvedUnpaid._sum.commissionAmount,
      ),
      settlementsDraft: toQueue(
        settlementsDraft._count._all,
        settlementsDraft._sum.totalAmount,
      ),
      flexPaymentsPending,
      bookingsPending,
      ambassadorsIncompleteDocs: countAmbassadorsWithIncompleteDocs(incompleteDocsProfiles),
    };
  }

  private async getHealthStats() {
    const monthStart = startOfMonth();
    const sevenDaysAgo = addDays(new Date(), -7);
    const closedLeadStatuses: LeadStatus[] = [
      LeadStatus.WON,
      LeadStatus.LOST,
      LeadStatus.CONVERTED,
    ];
    const activeBookingStatuses: BookingStatus[] = [
      BookingStatus.CONFIRMED,
      BookingStatus.COMPLETED,
    ];

    const [
      monthBookings,
      monthFlexBookings,
      commissionLiability,
      openLeads,
      newLeads7d,
      monthBookingsTotal,
      monthAttributedBookings,
      activeAmbassadors,
      totalProperties,
      totalUsers,
    ] = await Promise.all([
      this.prisma.booking.aggregate({
        where: {
          deletedAt: null,
          status: { in: activeBookingStatuses },
          createdAt: { gte: monthStart },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.flexBooking.aggregate({
        where: {
          deletedAt: null,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          createdAt: { gte: monthStart },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.commission.aggregate({
        where: {
          status: CommissionStatus.APPROVED,
          settlementId: null,
        },
        _sum: { commissionAmount: true },
      }),
      this.prisma.lead.count({
        where: { deletedAt: null, status: { notIn: closedLeadStatuses } },
      }),
      this.prisma.lead.count({
        where: {
          deletedAt: null,
          status: LeadStatus.NEW,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.booking.count({
        where: {
          deletedAt: null,
          status: { in: activeBookingStatuses },
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.booking.count({
        where: {
          deletedAt: null,
          status: { in: activeBookingStatuses },
          createdAt: { gte: monthStart },
          professionalProfileId: { not: null },
        },
      }),
      this.prisma.professionalProfile.count({ where: { status: 'ACTIVE' } }),
      this.prisma.property.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    const gmvMonth =
      decimalToNumber(monthBookings._sum.totalAmount) +
      decimalToNumber(monthFlexBookings._sum.totalAmount);

    const ambassadorAttributionPercent =
      monthBookingsTotal > 0
        ? Math.round((monthAttributedBookings / monthBookingsTotal) * 1000) / 10
        : null;

    return {
      gmvMonth: roundMoney(gmvMonth),
      commissionLiability: roundMoney(decimalToNumber(commissionLiability._sum.commissionAmount)),
      currency: 'ARS',
      openLeads,
      newLeads7d,
      ambassadorAttributionPercent,
      activeAmbassadors,
      totalProperties,
      totalUsers,
    };
  }

  private async loadIntentFunnel(refDate: Date) {
    const since = addDays(refDate, -30);
    const counts = await this.prisma.reservationIntent.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: since, lte: addDays(refDate, 1) },
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

  private async getOperationsEvolution(period: ActivityPeriod) {
    const since = periodStart(period);
    const today = parseDateOnly(toDateStr(new Date()));
    const dayList = dayRangeInclusive(since, today);
    const buckets = new Map(dayList.map((d) => [toDateStr(d), emptyEvolutionDay(d)]));

    const activeBookingStatuses: BookingStatus[] = [
      BookingStatus.CONFIRMED,
      BookingStatus.COMPLETED,
      BookingStatus.PENDING,
    ];

    const [bookings, flexBookings, commissions, settlementsPaid] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: since },
          status: { in: activeBookingStatuses },
        },
        select: { createdAt: true, totalAmount: true },
      }),
      this.prisma.flexBooking.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: since },
          status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING'] },
        },
        select: { createdAt: true, totalAmount: true },
      }),
      this.prisma.commission.findMany({
        where: {
          createdAt: { gte: since },
          status: { not: CommissionStatus.CANCELLED },
        },
        select: { createdAt: true, commissionAmount: true },
      }),
      this.prisma.commissionSettlement.findMany({
        where: {
          status: 'PAID',
          paidAt: { gte: since },
        },
        select: { paidAt: true, totalAmount: true },
      }),
    ]);

    const bumpBooking = (at: Date, amount: number) => {
      const key = toDateStr(at);
      const bucket = buckets.get(key);
      if (!bucket) return;
      bucket.bookings += 1;
      bucket.bookingsGmv = roundMoney(bucket.bookingsGmv + amount);
    };

    for (const b of bookings) bumpBooking(b.createdAt, decimalToNumber(b.totalAmount));
    for (const fb of flexBookings) bumpBooking(fb.createdAt, decimalToNumber(fb.totalAmount));

    for (const c of commissions) {
      const key = toDateStr(c.createdAt);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.commissions += 1;
      bucket.commissionsAmount = roundMoney(
        bucket.commissionsAmount + decimalToNumber(c.commissionAmount),
      );
    }

    for (const s of settlementsPaid) {
      if (!s.paidAt) continue;
      const key = toDateStr(s.paidAt);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.settlementsPaid += 1;
      bucket.settlementsPaidAmount = roundMoney(
        bucket.settlementsPaidAmount + decimalToNumber(s.totalAmount),
      );
    }

    const days = [...buckets.values()];
    const totals = days.reduce(
      (acc, d) => ({
        bookings: acc.bookings + d.bookings,
        bookingsGmv: roundMoney(acc.bookingsGmv + d.bookingsGmv),
        commissions: acc.commissions + d.commissions,
        commissionsAmount: roundMoney(acc.commissionsAmount + d.commissionsAmount),
        settlementsPaid: acc.settlementsPaid + d.settlementsPaid,
        settlementsPaidAmount: roundMoney(acc.settlementsPaidAmount + d.settlementsPaidAmount),
      }),
      {
        bookings: 0,
        bookingsGmv: 0,
        commissions: 0,
        commissionsAmount: 0,
        settlementsPaid: 0,
        settlementsPaidAmount: 0,
      },
    );

    return { period, days, totals };
  }

  private async getAmbassadorActivityStats(period: ActivityPeriod) {
    const since = periodStart(period);
    const inactiveSince = addDays(new Date(), -30);
    const activeBookingStatuses: BookingStatus[] = [
      BookingStatus.CONFIRMED,
      BookingStatus.COMPLETED,
      BookingStatus.PENDING,
    ];

    const [
      bookings,
      flexBookings,
      commissions,
      leads,
      sessions,
      activeProfiles,
      newAmbassadors,
      recentBookings,
      recentFlex,
      recentLeads,
      recentSessions,
      recentCommissions,
    ] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          deletedAt: null,
          professionalProfileId: { not: null },
          createdAt: { gte: since },
          status: { in: activeBookingStatuses },
        },
        select: {
          professionalProfileId: true,
          totalAmount: true,
          createdAt: true,
        },
      }),
      this.prisma.flexBooking.findMany({
        where: {
          deletedAt: null,
          professionalProfileId: { not: null },
          createdAt: { gte: since },
          status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING'] },
        },
        select: {
          professionalProfileId: true,
          totalAmount: true,
          createdAt: true,
        },
      }),
      this.prisma.commission.findMany({
        where: {
          professionalProfileId: { not: null },
          createdAt: { gte: since },
          status: { not: CommissionStatus.CANCELLED },
        },
        select: {
          professionalProfileId: true,
          commissionAmount: true,
          createdAt: true,
        },
      }),
      this.prisma.lead.findMany({
        where: {
          deletedAt: null,
          professionalProfileId: { not: null },
          createdAt: { gte: since },
        },
        select: {
          professionalProfileId: true,
          createdAt: true,
        },
      }),
      this.prisma.ambassadorBookingSession.findMany({
        where: { createdAt: { gte: since } },
        select: {
          professionalProfileId: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.professionalProfile.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          ambassadorRequestedAt: true,
        },
      }),
      this.prisma.professionalProfile.count({
        where: {
          status: 'ACTIVE',
          OR: [
            { ambassadorRequestedAt: { gte: since } },
            { createdAt: { gte: since } },
          ],
        },
      }),
      this.prisma.booking.findMany({
        where: {
          deletedAt: null,
          professionalProfileId: { not: null },
          createdAt: { gte: inactiveSince },
        },
        select: { professionalProfileId: true, createdAt: true },
      }),
      this.prisma.flexBooking.findMany({
        where: {
          deletedAt: null,
          professionalProfileId: { not: null },
          createdAt: { gte: inactiveSince },
        },
        select: { professionalProfileId: true, createdAt: true },
      }),
      this.prisma.lead.findMany({
        where: {
          deletedAt: null,
          professionalProfileId: { not: null },
          createdAt: { gte: inactiveSince },
        },
        select: { professionalProfileId: true, createdAt: true },
      }),
      this.prisma.ambassadorBookingSession.findMany({
        where: { createdAt: { gte: inactiveSince } },
        select: { professionalProfileId: true, createdAt: true },
      }),
      this.prisma.commission.findMany({
        where: {
          professionalProfileId: { not: null },
          createdAt: { gte: inactiveSince },
          status: { not: CommissionStatus.CANCELLED },
        },
        select: { professionalProfileId: true, createdAt: true },
      }),
    ]);

    const rows = new Map<string, AmbassadorRow>();

    const ensure = (id: string): AmbassadorRow => {
      if (!rows.has(id)) {
        rows.set(id, {
          id,
          name: '',
          bookings: 0,
          gmv: 0,
          commissions: 0,
          leads: 0,
          sessions: 0,
          sessionsConfirmed: 0,
          lastActivityAt: null,
        });
      }
      return rows.get(id)!;
    };

    for (const b of bookings) {
      if (!b.professionalProfileId) continue;
      const row = ensure(b.professionalProfileId);
      row.bookings += 1;
      row.gmv += decimalToNumber(b.totalAmount);
      row.lastActivityAt = maxDate(row.lastActivityAt, b.createdAt);
    }

    for (const fb of flexBookings) {
      if (!fb.professionalProfileId) continue;
      const row = ensure(fb.professionalProfileId);
      row.bookings += 1;
      row.gmv += decimalToNumber(fb.totalAmount);
      row.lastActivityAt = maxDate(row.lastActivityAt, fb.createdAt);
    }

    for (const c of commissions) {
      if (!c.professionalProfileId) continue;
      const row = ensure(c.professionalProfileId);
      row.commissions += decimalToNumber(c.commissionAmount);
      row.lastActivityAt = maxDate(row.lastActivityAt, c.createdAt);
    }

    for (const l of leads) {
      if (!l.professionalProfileId) continue;
      const row = ensure(l.professionalProfileId);
      row.leads += 1;
      row.lastActivityAt = maxDate(row.lastActivityAt, l.createdAt);
    }

    for (const s of sessions) {
      const row = ensure(s.professionalProfileId);
      row.sessions += 1;
      if (s.status === 'CONFIRMED') row.sessionsConfirmed += 1;
      row.lastActivityAt = maxDate(row.lastActivityAt, s.createdAt);
    }

    const profileMap = new Map(
      activeProfiles.map((p) => [
        p.id,
        `${p.firstName} ${p.lastName}`.trim(),
      ]),
    );

    for (const row of rows.values()) {
      row.name = profileMap.get(row.id) ?? 'Embajador';
      row.gmv = roundMoney(row.gmv);
      row.commissions = roundMoney(row.commissions);
    }

    const activeInPeriod = new Set(rows.keys());
    const totalSessionsStarted = sessions.length;
    const totalSessionsConfirmed = sessions.filter((s) => s.status === 'CONFIRMED').length;

    const lastActivity30d = new Map<string, Date>();
    const touchActivity = (profileId: string | null | undefined, at: Date) => {
      if (!profileId) return;
      const prev = lastActivity30d.get(profileId);
      if (!prev || at > prev) lastActivity30d.set(profileId, at);
    };
    for (const item of [
      ...recentBookings,
      ...recentFlex,
      ...recentLeads,
      ...recentSessions,
      ...recentCommissions,
    ]) {
      touchActivity(item.professionalProfileId, item.createdAt);
    }

    const ranking = [...rows.values()]
      .filter((r) => profileMap.has(r.id))
      .sort((a, b) => b.gmv - a.gmv || b.bookings - a.bookings)
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        name: r.name,
        bookings: r.bookings,
        gmv: r.gmv,
        commissions: r.commissions,
        leads: r.leads,
        sessions: r.sessions,
        conversionRate: conversionRate(r.sessionsConfirmed, r.sessions),
        lastActivityAt: r.lastActivityAt?.toISOString() ?? null,
      }));

    const inactive = activeProfiles
      .filter((p) => {
        const last = lastActivity30d.get(p.id) ?? p.ambassadorRequestedAt ?? p.createdAt;
        return last < inactiveSince;
      })
      .map((p) => {
        const last = lastActivity30d.get(p.id) ?? p.ambassadorRequestedAt ?? p.createdAt;
        return {
          id: p.id,
          name: `${p.firstName} ${p.lastName}`.trim(),
          daysSinceActivity: daysSince(last),
          lastActivityAt: last?.toISOString() ?? null,
        };
      })
      .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity)
      .slice(0, 15);

    const inactiveCount = activeProfiles.filter((p) => {
      const last = lastActivity30d.get(p.id) ?? p.ambassadorRequestedAt ?? p.createdAt;
      return last < inactiveSince;
    }).length;

    const leadsCreated = leads.length;
    const attributedBookings = bookings.length + flexBookings.length;
    const attributedGmv = roundMoney(
      bookings.reduce((s, b) => s + decimalToNumber(b.totalAmount), 0) +
        flexBookings.reduce((s, b) => s + decimalToNumber(b.totalAmount), 0),
    );
    const commissionsGenerated = roundMoney(
      commissions.reduce((s, c) => s + decimalToNumber(c.commissionAmount), 0),
    );

    return {
      period,
      summary: {
        activeAmbassadors: activeInPeriod.size,
        inactiveAmbassadors: inactiveCount,
        newAmbassadors,
        attributedBookings,
        attributedGmv,
        commissionsGenerated,
        leadsCreated,
        sessionConversionRate: conversionRate(totalSessionsConfirmed, totalSessionsStarted),
      },
      ranking,
      inactive,
    };
  }
}
