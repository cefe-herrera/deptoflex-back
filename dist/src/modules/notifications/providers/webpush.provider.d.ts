import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface WebPushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}
export interface WebPushPayload {
    title: string;
    body: string;
    data?: Record<string, unknown>;
}
export declare class WebPushProvider implements OnModuleInit {
    private config;
    private readonly logger;
    private enabled;
    constructor(config: ConfigService);
    onModuleInit(): void;
    sendToSubscriptions(subs: WebPushSubscription[], payload: WebPushPayload): Promise<string[]>;
}
