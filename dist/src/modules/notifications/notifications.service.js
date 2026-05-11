"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const notifications_gateway_1 = require("./notifications.gateway");
const fcm_provider_1 = require("./providers/fcm.provider");
const webpush_provider_1 = require("./providers/webpush.provider");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    prisma;
    gateway;
    fcm;
    webpush;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(prisma, gateway, fcm, webpush) {
        this.prisma = prisma;
        this.gateway = gateway;
        this.fcm = fcm;
        this.webpush = webpush;
    }
    async sendToUser(input) {
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
        this.pushToDevices(input.userId, {
            title: input.title,
            body: input.body,
            data: input.data,
        }).catch((err) => this.logger.error('pushToDevices failed', err));
        return notif;
    }
    async sendToRole(role, input) {
        const users = await this.prisma.user.findMany({
            where: { isActive: true, deletedAt: null, userRoles: { some: { role: { name: role } } } },
            select: { id: true },
        });
        return Promise.all(users.map((u) => this.sendToUser({ ...input, userId: u.id })));
    }
    async list(userId, page = 1, limit = 20, onlyUnread = false) {
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
    async unreadCount(userId) {
        return this.prisma.notification.count({ where: { userId, readAt: null } });
    }
    async markAsRead(userId, id) {
        const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
        if (!notif)
            throw new common_1.NotFoundException('Notification not found');
        return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    }
    async markAllAsRead(userId) {
        const result = await this.prisma.notification.updateMany({
            where: { userId, readAt: null },
            data: { readAt: new Date() },
        });
        this.gateway.emitToUser(userId, 'notification:unread-count', { count: 0 });
        return { updated: result.count };
    }
    async remove(userId, id) {
        const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
        if (!notif)
            throw new common_1.NotFoundException('Notification not found');
        await this.prisma.notification.delete({ where: { id } });
        return { deleted: true };
    }
    async registerDevice(userId, dto) {
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
    async unregisterDevice(userId, token) {
        await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
        return { deleted: true };
    }
    async listDevices(userId) {
        return this.prisma.deviceToken.findMany({
            where: { userId },
            orderBy: { lastUsedAt: 'desc' },
        });
    }
    async pushToDevices(userId, payload) {
        const devices = await this.prisma.deviceToken.findMany({ where: { userId } });
        if (devices.length === 0)
            return;
        const fcmTokens = devices.filter((d) => d.provider === client_1.DeviceProvider.FCM).map((d) => d.token);
        const webPushSubs = devices
            .filter((d) => d.provider === client_1.DeviceProvider.WEBPUSH && d.endpoint && d.p256dh && d.authKey)
            .map((d) => ({
            endpoint: d.endpoint,
            keys: { p256dh: d.p256dh, auth: d.authKey },
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
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_gateway_1.NotificationsGateway,
        fcm_provider_1.FcmProvider,
        webpush_provider_1.WebPushProvider])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map