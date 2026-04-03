import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: Joi.number().default(7),
  R2_ENDPOINT: Joi.string().uri().required(),
  R2_ACCESS_KEY_ID: Joi.string().required(),
  R2_SECRET_ACCESS_KEY: Joi.string().required(),
  R2_BUCKET: Joi.string().required(),
  R2_PUBLIC_BASE_URL: Joi.string().uri().required(),
  APP_ALLOWED_ORIGINS: Joi.string().default('http://localhost:3001'),
  APP_URL: Joi.string().uri().default('http://localhost:3000'),
  RESEND_API_KEY: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().default('onboarding@resend.dev'),
  GOOGLE_CLIENT_ID: Joi.string().required(),
});
