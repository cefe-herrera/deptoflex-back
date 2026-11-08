import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

const VERSION = 'v1';

/**
 * Cifra el token de sesión de WeSpeak antes de guardarlo (AES-256-GCM).
 * Formato: `v1.<iv>.<tag>.<ciphertext>` en base64url.
 */
export class TokenCipher {
  private readonly key: Buffer;

  /** `secret`: WESPEAK_TOKEN_KEY o, si falta, JWT_SECRET. La clave real se deriva con HKDF. */
  constructor(secret: string) {
    if (!secret) throw new Error('TokenCipher necesita un secreto');
    this.key = Buffer.from(
      hkdfSync('sha256', secret, 'weflex', 'wespeak-session-token', 32),
    );
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv, tag, data]
      .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
      .join('.');
  }

  /** Devuelve null si el valor no se puede descifrar (clave rotada, dato corrupto): se abre una sesión nueva. */
  decrypt(value: string | null | undefined): string | null {
    if (!value) return null;
    const [version, iv, tag, data] = value.split('.');
    if (version !== VERSION || !iv || !tag || !data) return null;
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(iv, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return null;
    }
  }
}
