import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, DeviceProvider } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';
import { FcmProvider } from './providers/fcm.provider';
import { WebPushProvider } from './providers/webpush.provider';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationTarget, SendNotificationDto } from './dto/send-notification.dto';

export interface SendNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
    private fcm: FcmProvider,
    private webpush: WebPushProvider,
  ) {}

  /**
   * Persists notification, emits via WebSocket and pushes to all user devices.
   * Use this from any module to notify a user (e.g. new lead, booking confirmed).
   */
  async sendToUser(input: SendNotificationInput) {
    const notif = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? undefined,
      },
    });

    // 1. Real-time in-app via WebSocket
    this.gateway.emitToUser(input.userId, 'notification:new', notif);
    const unreadCount = await this.unreadCount(input.userId);
    this.gateway.emitToUser(input.userId, 'notification:unread-count', { count: unreadCount });

    // 2. Push to all registered devices (fire & forget)
    this.pushToDevices(input.userId, {
      title: input.title,
      body: input.body,
      data: input.data,
    }).catch((err) => this.logger.error('pushToDevices failed', err));

    return notif;
  }

  /** Send the same notification to all users with a given role. */
  async sendToRole(role: string, input: Omit<SendNotificationInput, 'userId'>) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, deletedAt: null, userRoles: { some: { role: { name: role } } } },
      select: { id: true },
    });
    return Promise.all(users.map((u) => this.sendToUser({ ...input, userId: u.id })));
  }

  /** Notifies OPERATOR and ADMIN when a new lead is created. */
  async notifyNewLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        unit: { select: { name: true, property: { select: { id: true, name: true } } } },
      },
    });
    if (!lead) return;

    const placeName = lead.unit?.property?.name ?? lead.unit?.name ?? 'una propiedad';
    const payload = {
      type: NotificationType.LEAD_NEW,
      title: 'Nuevo lead',
      body: `${lead.clientName} consultó por ${placeName}`,
      data: {
        leadId: lead.id,
        propertyId: lead.unit?.property?.id ?? null,
        url: `/dashboard/leads/${lead.id}`,
      },
    };

    await Promise.all([
      this.sendToRole('OPERATOR', payload),
      this.sendToRole('ADMIN', payload),
    ]);
  }

  /** Notifies the professional/ambassador when their booking is confirmed. */
  async notifyBookingConfirmed(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        unit: { select: { name: true } },
        propertyFlex: { select: { name: true } },
        property: { select: { name: true } },
        professionalProfile: { select: { userId: true } },
      },
    });
    if (!booking?.professionalProfile?.userId) return;

    const placeName =
      booking.unit?.name ??
      booking.propertyFlex?.name ??
      booking.property?.name ??
      'tu reserva';

    await this.sendToUser({
      userId: booking.professionalProfile.userId,
      type: NotificationType.BOOKING_CONFIRMED,
      title: 'Reserva confirmada',
      body: `La reserva de ${booking.clientName} en ${placeName} fue confirmada.`,
      data: {
        bookingId: booking.id,
        url: '/dashboard/activity',
      },
    });
  }

  /** Admin broadcast: send to one user, a role, or all active users. */
  async broadcast(dto: SendNotificationDto): Promise<{ sent: number }> {
    const base = {
      type: dto.type,
      title: dto.title,
      body: dto.body,
      data: {
        url: dto.url ?? '/dashboard/notifications',
        ...dto.data,
      },
    };

    if (dto.target === NotificationTarget.USER) {
      if (!dto.userId) throw new BadRequestException('userId is required when target is user');
      await this.sendToUser({ ...base, userId: dto.userId });
      return { sent: 1 };
    }

    if (dto.target === NotificationTarget.ROLE) {
      if (!dto.role) throw new BadRequestException('role is required when target is role');
      const sent = await this.sendToRole(dto.role, base);
      return { sent: sent.length };
    }

    const users = await this.prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });
    await Promise.all(users.map((u) => this.sendToUser({ ...base, userId: u.id })));
    return { sent: users.length };
  }

  // ── Notifications listing ─────────────────────────────────────────────────

  async list(userId: string, page = 1, limit = 20, onlyUnread = false) {
    const skip = (page - 1) * limit;
    const where = { userId, ...(onlyUnread && { readAt: null }) };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markAsRead(userId: string, id: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    this.gateway.emitToUser(userId, 'notification:unread-count', { count: 0 });
    return { updated: result.count };
  }

  async remove(userId: string, id: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Device tokens ─────────────────────────────────────────────────────────

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.deviceToken.upsert({
      where: { userId_token: { userId, token: dto.token } },
      create: {
        userId,
        platform: dto.platform,
        provider: dto.provider,
        token: dto.token,
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        authKey: dto.authKey,
        userAgent: dto.userAgent,
      },
      update: { lastUsedAt: new Date(), userAgent: dto.userAgent },
    });
  }

  async unregisterDevice(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
    return { deleted: true };
  }

  async listDevices(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  // ── Internal: push to all user devices ────────────────────────────────────

  private async pushToDevices(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, any> },
  ) {
    const devices = await this.prisma.deviceToken.findMany({ where: { userId } });
    if (devices.length === 0) return;

    const fcmTokens = devices.filter((d) => d.provider === DeviceProvider.FCM).map((d) => d.token);
    const webPushSubs = devices
      .filter((d) => d.provider === DeviceProvider.WEBPUSH && d.endpoint && d.p256dh && d.authKey)
      .map((d) => ({
        endpoint: d.endpoint!,
        keys: { p256dh: d.p256dh!, auth: d.authKey! },
      }));

    const stringData = payload.data
      ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)]))
      : undefined;

    const [invalidFcm, invalidWebPush] = await Promise.all([
      this.fcm.sendToTokens(fcmTokens, { title: payload.title, body: payload.body, data: stringData }),
      this.webpush.sendToSubscriptions(webPushSubs, {
        title: payload.title,
        body: payload.body,
        data: payload.data,
      }),
    ]);

    // Cleanup invalid tokens
    if (invalidFcm.length) {
      await this.prisma.deviceToken.deleteMany({
        where: { userId, token: { in: invalidFcm } },
      });
    }
    if (invalidWebPush.length) {
      await this.prisma.deviceToken.deleteMany({
        where: { userId, endpoint: { in: invalidWebPush } },
      });
    }
  }
}
