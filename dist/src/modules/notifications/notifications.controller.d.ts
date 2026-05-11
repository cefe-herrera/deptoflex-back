import { NotificationsService } from './notifications.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
export declare class NotificationsController {
    private notifications;
    constructor(notifications: NotificationsService);
    list(user: CurrentUserPayload, page?: number, limit?: number, unread?: string): Promise<{
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
    unreadCount(user: CurrentUserPayload): Promise<{
        count: number;
    }>;
    markAsRead(user: CurrentUserPayload, id: string): Promise<{
        id: string;
        createdAt: Date;
        data: import("@prisma/client/runtime/library").JsonValue | null;
        userId: string;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        body: string;
        readAt: Date | null;
    }>;
    markAllAsRead(user: CurrentUserPayload): Promise<{
        updated: number;
    }>;
    remove(user: CurrentUserPayload, id: string): Promise<{
        deleted: boolean;
    }>;
    registerDevice(user: CurrentUserPayload, dto: RegisterDeviceDto): Promise<{
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
    listDevices(user: CurrentUserPayload): Promise<{
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
    unregisterDevice(user: CurrentUserPayload, token: string): Promise<{
        deleted: boolean;
    }>;
}
