import { DevicePlatform, DeviceProvider } from '@prisma/client';
export declare class RegisterDeviceDto {
    platform: DevicePlatform;
    provider: DeviceProvider;
    token: string;
    endpoint?: string;
    p256dh?: string;
    authKey?: string;
    userAgent?: string;
}
