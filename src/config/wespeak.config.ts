import { registerAs } from '@nestjs/config';

export default registerAs('wespeak', () => ({
  baseUrl: (
    process.env.WESPEAK_BASE_URL ?? 'https://chat.wespeak.pro/api/webchat'
  )
    .trim()
    .replace(/\/+$/, ''),
  widgetId: (process.env.WESPEAK_WIDGET_ID ?? '').trim(),
  /** Secreto para cifrar el token de WeSpeak en la base. Si falta, se deriva de JWT_SECRET. */
  tokenKey:
    (process.env.WESPEAK_TOKEN_KEY ?? '').trim() ||
    (process.env.JWT_SECRET ?? ''),
}));
