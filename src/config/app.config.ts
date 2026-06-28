import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  allowedOrigins: (process.env.APP_ALLOWED_ORIGINS ?? 'http://localhost:3001').split(','),
  // Origen del motor público de Cloudbeds. Necesario en CORS para que el script
  // inyectado pueda hacer fetch al endpoint público de tracking de embajador.
  // (Esta integración NO usa la API oficial de Cloudbeds.)
  cloudbedsOrigin: process.env.CLOUDBEDS_BOOKING_ORIGIN ?? 'https://hotels.cloudbeds.com',
  cloudbedsBookingBaseUrl:
    process.env.CLOUDBEDS_BOOKING_BASE_URL ?? 'https://hotels.cloudbeds.com/es/reservation/',
  url: process.env.APP_URL ?? 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  appleClientId: process.env.APPLE_CLIENT_ID,
}));
