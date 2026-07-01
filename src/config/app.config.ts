import { registerAs } from '@nestjs/config';

function resolveAppUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, '');
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

function resolveFrontendUrl(): string {
  return (process.env.FRONTEND_URL?.trim() || 'http://localhost:3001').replace(/\/$/, '');
}

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  allowedOrigins: (process.env.APP_ALLOWED_ORIGINS ?? 'http://localhost:3001').split(','),
  cloudbedsOrigin: process.env.CLOUDBEDS_BOOKING_ORIGIN ?? 'https://hotels.cloudbeds.com',
  cloudbedsBookingBaseUrl:
    process.env.CLOUDBEDS_BOOKING_BASE_URL ?? 'https://hotels.cloudbeds.com/es/reservation/',
  url: resolveAppUrl(),
  frontendUrl: resolveFrontendUrl(),
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  appleClientId: process.env.APPLE_CLIENT_ID,
}));
