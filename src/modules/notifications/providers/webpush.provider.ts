import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface WebPushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class WebPushProvider implements OnModuleInit {
  private readonly logger = new Logger(WebPushProvider.name);
  private enabled = false;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const enabled = this.config.get<boolean>('notifications.webpush.enabled');
    const publicKey = this.config.get<string>('notifications.webpush.publicKey');
    const privateKey = this.config.get<string>('notifications.webpush.privateKey');
    const subject = this.config.get<string>('notifications.webpush.subject');

    if (!enabled || !publicKey || !privateKey) {
      this.logger.warn('Web Push disabled (set WEBPUSH_ENABLED=true and VAPID keys to enable)');
      return;
    }

    webpush.setVapidDetails(subject!, publicKey, privateKey);
    this.enabled = true;
    this.logger.log('Web Push initialized');
  }

  /** Returns endpoints that should be removed (gone subscriptions). */
  async sendToSubscriptions(
    subs: WebPushSubscription[],
    payload: WebPushPayload,
  ): Promise<string[]> {
    if (!this.enabled || subs.length === 0) return [];

    const invalid: string[] = [];
    const body = JSON.stringify(payload);

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, body);
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            invalid.push(sub.endpoint);
          } else {
            this.logger.warn(`Web Push failed: ${err.statusCode} ${err.message}`);
          }
        }
      }),
    );

    return invalid;
  }
}
