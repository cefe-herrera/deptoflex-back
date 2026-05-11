import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';
import { FcmProvider } from './providers/fcm.provider';
import { WebPushProvider } from './providers/webpush.provider';
import { RegisterDeviceDto } from './dto/register-device.dto';
export interface SendNotificationInput {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
}
export declare class NotificationsService {
    private prisma;
    private gateway;
    private fcm;
    private webpush;
    private readonly logger;
    constructor(prisma: PrismaService, gateway: NotificationsGateway, fcm: FcmProvider, webpush: WebPushProvider);
    sendToUser(input: SendNotificationInput): Promise<{
        id: string;
        createdAt: Date;
        data: import("@prisma/client/runtime/library").JsonValue | null;
        userId: string;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        body: string;
        readAt: Date | null;
    }>;
    sendToRole(role: string, input: Omit<SendNotificationInput, 'userId'>): Promise<{
        id: string;
        createdAt: Date;
        data: import("@prisma/client/runtime/library").JsonValue | null;
        userId: string;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        body: string;
        readAt: Date | null;
    }[]>;
    list(userId: string, page?: number, limit?: number, onlyUnread?: boolean): Promise<{
        items: {
            id: string;
            createdAt: Date;
            data: import("@prisma/client/runtime/library").JsonValue | null;
            userId: string;
            type: import(".prisma/client").$Enums.NotificationType;
            title: string;
            body: string;
            readAt: Date | null;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    unreadCount(userId: string): Promise<number>;
    markAsRead(userId: string, id: string): Promise<{
        id: string;
        createdAt: Date;
        data: import("@prisma/client/runtime/library").JsonValue | null;
        userId: string;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        body: string;
        readAt: Date | null;
    }>;
    markAllAsRead(userId: string): Promise<{
        updated: number;
    }>;
    remove(userId: string, id: string): Promise<{
        deleted: boolean;
    }>;
    registerDevice(userId: string, dto: RegisterDeviceDto): Promise<{
        id: string;
        createdAt: Date;
        endpoint: string | null;
        userAgent: string | null;
        userId: string;
        token: string;
        platform: import(".prisma/client").$Enums.DevicePlatform;
        provider: import(".prisma/client").$Enums.DeviceProvider;
        p256dh: string | null;
        authKey: string | null;
        lastUsedAt: Date;
    }>;
    unregisterDevice(userId: string, token: string): Promise<{
        deleted: boolean;
    }>;
    listDevices(userId: string): Promise<{
        id: string;
        createdAt: Date;
        endpoint: string | null;
        userAgent: string | null;
        userId: string;
        token: string;
        platform: import(".prisma/client").$Enums.DevicePlatform;
        provider: import(".prisma/client").$Enums.DeviceProvider;
        p256dh: string | null;
        authKey: string | null;
        lastUsedAt: Date;
    }[]>;
    private pushToDevices;
}
