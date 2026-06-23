import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, DeviceProvider } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';
import { FcmProvider } from './providers/fcm.provider';
import { WebPushProvider } from './providers/webpush.provider';
import { EmailService } from '../email/email.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationTarget, SendNotificationDto } from './dto/send-notification.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

export interface SendNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

const PROMOTIONAL_TYPES: NotificationType[] = [NotificationType.PROMOTION];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
    private fcm: FcmProvider,
    private webpush: WebPushProvider,
    private emailService: EmailService,
  ) {}

  private isPromotional(type: NotificationType, explicit?: boolean): boolean {
    if (PROMOTIONAL_TYPES.includes(type)) return true;
    return type === NotificationType.GENERIC && explicit === true;
  }

  async getOrCreatePreferences(userId: string) {
    return this.prisma.userNotificationPreferences.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async getPreferences(userId: string) {
    return this.getOrCreatePreferences(userId);
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    await this.getOrCreatePreferences(userId);
    return this.prisma.userNotificationPreferences.update({
      where: { userId },
      data: {
        ...(dto.pushEnabled !== undefined && { pushEnabled: dto.pushEnabled }),
        ...(dto.emailEnabled !== undefined && { emailEnabled: dto.emailEnabled }),
        ...(dto.promosEnabled !== undefined && { promosEnabled: dto.promosEnabled }),
        // WhatsApp aún no implementado — nunca persistir true
        ...(dto.whatsappEnabled !== undefined && { whatsappEnabled: false }),
      },
    });
  }

  /**
   * Persists notification, emits via WebSocket and optionally pushes/emails per user prefs.
   */
  async sendToUser(input: SendNotificationInput, options?: { isPromotional?: boolean }) {
    const prefs = await this.getOrCreatePreferences(input.userId);
    const promotional = this.isPromotional(input.type, options?.isPromotional);

    if (promotional && !prefs.promosEnabled) {
      return null;
    }

    const notif = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? undefined,
      },
    });

    this.gateway.emitToUser(input.userId, 'notification:new', notif);
    const unreadCount = await this.unreadCount(input.userId);
    this.gateway.emitToUser(input.userId, 'notification:unread-count', { count: unreadCount });

    if (prefs.pushEnabled) {
      this.pushToDevices(input.userId, {
        title: input.title,
        body: input.body,
        data: input.data,
      }).catch((err) => this.logger.error('pushToDevices failed', err));
    }

    if (prefs.emailEnabled) {
      this.sendNotificationEmail(input.userId, input.title, input.body, input.data?.url).catch((err) =>
        this.logger.error('sendNotificationEmail failed', err),
      );
    }

    return notif;
  }

  private async sendNotificationEmail(
    userId: string,
    title: string,
    body: string,
    actionUrl?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, emailVerified: true },
      select: { email: true },
    });
    if (!user?.email) return;
    await this.emailService.sendNotificationEmail(user.email, title, body, actionUrl);
  }

  async sendToRole(role: string, input: Omit<SendNotificationInput, 'userId'>, options?: { isPromotional?: boolean }) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, deletedAt: null, userRoles: { some: { role: { name: role } } } },
      select: { id: true },
    });
    const results = await Promise.all(
      users.map((u) => this.sendToUser({ ...input, userId: u.id }, options)),
    );
    return results.filter(Boolean);
  }

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

  async notifyBookingCreated(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        propertyFlex: { select: { name: true } },
        property: { select: { name: true } },
        unit: { select: { name: true } },
      },
    });
    if (!booking) return;

    const placeName =
      booking.propertyFlex?.name ??
      booking.property?.name ??
      booking.unit?.name ??
      'una propiedad';
    const kind = booking.source === 'FLEX' ? 'Flex' : 'Temporal';

    const payload = {
      type: NotificationType.BOOKING_CREATED,
      title: 'Nueva solicitud de reserva',
      body: `${booking.clientName} solicitó una reserva ${kind} en ${placeName}.`,
      data: {
        bookingId: booking.id,
        url: '/admin/bookings',
      },
    };

    await Promise.all([
      this.sendToRole('OPERATOR', payload),
      this.sendToRole('ADMIN', payload),
    ]);
  }

  async notifyFlexReservationPaid(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        propertyFlex: { select: { name: true } },
        professionalProfile: { select: { userId: true } },
      },
    });
    if (!booking?.professionalProfile?.userId) return;

    const placeName = booking.propertyFlex?.name ?? 'la propiedad';

    await this.sendToUser({
      userId: booking.professionalProfile.userId,
      type: NotificationType.BOOKING_CONFIRMED,
      title: 'Pago de reserva recibido',
      body: `${booking.clientName} pagó la reserva en ${placeName}. La reserva quedó confirmada — coordiná los próximos pasos con el huésped.`,
      data: {
        bookingId: booking.id,
        url: '/dashboard/activity',
      },
    });
  }

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

  async notifyCancellationRequested(bookingId: string, requestId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        propertyFlex: { select: { name: true } },
        property: { select: { name: true } },
        unit: { select: { name: true } },
        professionalProfile: {
          select: {
            firstName: true,
            lastName: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        cancellationRequests: {
          where: { id: requestId },
          take: 1,
          select: { reason: true },
        },
      },
    });
    if (!booking) return;

    const placeName =
      booking.propertyFlex?.name ??
      booking.property?.name ??
      booking.unit?.name ??
      'una propiedad';
    const ambassadorName =
      [booking.professionalProfile?.user?.firstName, booking.professionalProfile?.user?.lastName]
        .filter(Boolean)
        .join(' ') ||
      booking.professionalProfile?.firstName ||
      'Un embajador';
    const reason = booking.cancellationRequests[0]?.reason ?? '';

    const payload = {
      type: NotificationType.BOOKING_CANCELLATION_REQUESTED,
      title: 'Solicitud de cancelación de reserva',
      body: `${ambassadorName} solicitó cancelar la reserva de ${booking.clientName} en ${placeName}. Motivo: ${reason}`,
      data: {
        bookingId: booking.id,
        cancellationRequestId: requestId,
        url: '/admin/bookings',
      },
    };

    await this.sendToRole('ADMIN', payload);
  }

  async notifyBookingCancelled(bookingId: string, reason?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        unit: { select: { name: true } },
        propertyFlex: { select: { name: true } },
        property: { select: { name: true } },
        professionalProfile: { select: { userId: true } },
      },
    });
    if (!booking) return;

    const placeName =
      booking.unit?.name ??
      booking.propertyFlex?.name ??
      booking.property?.name ??
      'la propiedad';
    const dateRange = `${this.fmtDate(booking.checkInDate)} al ${this.fmtDate(booking.checkOutDate)}`;

    if (booking.professionalProfile?.userId) {
      await this.sendToUser({
        userId: booking.professionalProfile.userId,
        type: NotificationType.BOOKING_CANCELLED,
        title: 'Reserva cancelada',
        body: `La reserva de ${booking.clientName} en ${placeName} fue cancelada.`,
        data: {
          bookingId: booking.id,
          url: `/dashboard/activity/${booking.id}`,
        },
      });
    }

    if (booking.clientEmail) {
      this.emailService
        .sendBookingCancelledEmail(
          booking.clientEmail,
          booking.clientName,
          placeName,
          dateRange,
          reason,
        )
        .catch((err) => this.logger.error('sendBookingCancelledEmail failed', err));
    } else {
      this.logger.warn(`Booking ${bookingId} cancelled but client has no email`);
    }
  }

  async notifyCancellationRejected(requestId: string) {
    const request = await this.prisma.bookingCancellationRequest.findUnique({
      where: { id: requestId },
      include: {
        booking: {
          include: {
            propertyFlex: { select: { name: true } },
            property: { select: { name: true } },
            unit: { select: { name: true } },
          },
        },
      },
    });
    if (!request) return;

    const booking = request.booking;
    const placeName =
      booking.propertyFlex?.name ??
      booking.property?.name ??
      booking.unit?.name ??
      'la propiedad';
    const notes = request.adminNotes ? ` Nota: ${request.adminNotes}` : '';

    await this.sendToUser({
      userId: request.requestedById,
      type: NotificationType.BOOKING_CANCELLED,
      title: 'Solicitud de cancelación rechazada',
      body: `Tu solicitud de cancelación para la reserva de ${booking.clientName} en ${placeName} fue rechazada.${notes}`,
      data: {
        bookingId: booking.id,
        url: `/dashboard/activity/${booking.id}`,
      },
    });
  }

  private fmtDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  async broadcast(dto: SendNotificationDto): Promise<{ sent: number; skipped: number }> {
    const isPromotional = this.isPromotional(dto.type, dto.isPromotional);
    const base = {
      type: dto.type,
      title: dto.title,
      body: dto.body,
      data: {
        url: dto.url ?? '/dashboard/notifications',
        ...dto.data,
      },
    };
    const options = { isPromotional };

    if (dto.target === NotificationTarget.USER) {
      if (!dto.userId) throw new BadRequestException('userId is required when target is user');
      const notif = await this.sendToUser({ ...base, userId: dto.userId }, options);
      return { sent: notif ? 1 : 0, skipped: notif ? 0 : 1 };
    }

    if (dto.target === NotificationTarget.ROLE) {
      if (!dto.role) throw new BadRequestException('role is required when target is role');
      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          userRoles: { some: { role: { name: dto.role } } },
        },
        select: { id: true },
      });
      let sent = 0;
      let skipped = 0;
      for (const u of users) {
        const notif = await this.sendToUser({ ...base, userId: u.id }, options);
        if (notif) sent += 1;
        else skipped += 1;
      }
      return { sent, skipped };
    }

    const users = await this.prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });
    let sent = 0;
    let skipped = 0;
    for (const u of users) {
      const notif = await this.sendToUser({ ...base, userId: u.id }, options);
      if (notif) sent += 1;
      else skipped += 1;
    }
    return { sent, skipped };
  }

  async listAdmin(page = 1, limit = 50, type?: NotificationType, userId?: string) {
    const skip = (page - 1) * limit;
    const where = {
      ...(type && { type }),
      ...(userId && { userId }),
    };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page, limit };
  }

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

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    await this.getOrCreatePreferences(userId);
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
