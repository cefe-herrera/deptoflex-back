import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FcmProvider implements OnModuleInit {
  private readonly logger = new Logger(FcmProvider.name);
  private app?: admin.app.App;
  private enabled = false;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const enabled = this.config.get<boolean>('notifications.fcm.enabled');
    const projectId = this.config.get<string>('notifications.fcm.projectId');
    const clientEmail = this.config.get<string>('notifications.fcm.clientEmail');
    const privateKey = this.config.get<string>('notifications.fcm.privateKey');

    if (!enabled || !projectId || !clientEmail || !privateKey) {
      this.logger.warn('FCM disabled (set FCM_ENABLED=true and credentials to enable)');
      return;
    }

    try {
      this.app = admin.apps.length
        ? admin.app()
        : admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
          });
      this.enabled = true;
      this.logger.log('FCM initialized');
    } catch (err) {
      this.logger.error('FCM init failed', err as Error);
    }
  }

  /** Returns invalid tokens that should be removed from DB. */
  async sendToTokens(tokens: string[], payload: FcmPayload): Promise<string[]> {
    if (!this.enabled || !this.app || tokens.length === 0) return [];

    const invalid: string[] = [];
    const messaging = this.app.messaging();

    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
    });

    result.responses.forEach((res, idx) => {
      if (!res.success) {
        const code = res.error?.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalid.push(tokens[idx]);
        } else {
          this.logger.warn(`FCM send failed for token: ${code} ${res.error?.message}`);
        }
      }
    });

    return invalid;
  }
}
