import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  allowedOrigins: (process.env.APP_ALLOWED_ORIGINS ?? 'http://localhost:3001').split(','),
}));
