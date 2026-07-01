import * as Joi from 'joi';

function resolveAppUrlDefault(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, '');
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

function resolveFrontendUrlDefault(): string {
  const explicit = process.env.FRONTEND_URL?.trim();
  if (explicit) return explicit;
  return 'http://localhost:3001';
}

/** Trims whitespace; empty string becomes undefined so Joi defaults apply. */
const uriEnv = (label: string) =>
  Joi.string()
    .trim()
    .empty('')
    .uri({ scheme: ['http', 'https'] })
    .messages({ 'string.uri': `"${label}" must be a valid uri (include https://, no trailing spaces)` });

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
  APP_URL: uriEnv('APP_URL').default(resolveAppUrlDefault()),
  FRONTEND_URL: uriEnv('FRONTEND_URL').default(resolveFrontendUrlDefault()),
  RESEND_API_KEY: Joi.string().required(),
  EMAIL_FROM: Joi.string().default('Weflex <no-reply@weflex.com.ar>'),
  GOOGLE_CLIENT_ID: Joi.string().required(),
  MERCADOPAGO_ACCESS_TOKEN: Joi.string().allow('').default(''),
  MERCADOPAGO_WEBHOOK_SECRET: Joi.string().allow('').default(''),
  MERCADOPAGO_PAYMENT_LINK_EXPIRATION_DAYS: Joi.number().integer().min(1).max(30).default(7),
});
