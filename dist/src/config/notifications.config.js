"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('notifications', () => ({
    fcm: {
        enabled: process.env.FCM_ENABLED === 'true',
        projectId: process.env.FCM_PROJECT_ID,
        clientEmail: process.env.FCM_CLIENT_EMAIL,
        privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    webpush: {
        enabled: process.env.WEBPUSH_ENABLED === 'true',
        publicKey: process.env.WEBPUSH_VAPID_PUBLIC_KEY,
        privateKey: process.env.WEBPUSH_VAPID_PRIVATE_KEY,
        subject: process.env.WEBPUSH_VAPID_SUBJECT ?? 'mailto:admin@deptoflex.com',
    },
}));
//# sourceMappingURL=notifications.config.js.map