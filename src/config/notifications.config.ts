import { registerAs } from '@nestjs/config';

export default registerAs('notifications', () => ({
  // FCM (Firebase Cloud Messaging)
  fcm: {
    enabled: process.env.FCM_ENABLED === 'true',
    projectId: process.env.FCM_PROJECT_ID,
    clientEmail: process.env.FCM_CLIENT_EMAIL,
    privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  // Web Push (VAPID)
  webpush: {
    enabled: process.env.WEBPUSH_ENABLED === 'true',
    publicKey: process.env.WEBPUSH_VAPID_PUBLIC_KEY,
    privateKey: process.env.WEBPUSH_VAPID_PRIVATE_KEY,
    subject: process.env.WEBPUSH_VAPID_SUBJECT ?? 'mailto:admin@deptoflex.com',
  },
}));
