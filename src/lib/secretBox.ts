import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Encrypts secrets (API keys added from the admin area) before they reach the
 * database, so a database leak alone exposes nothing.
 *
 * The AES-256-GCM key is derived from APP_ENCRYPTION_KEY when set, otherwise
 * from ADMIN_SESSION_SECRET. Changing that variable makes the stored keys
 * unreadable: they then have to be entered again.
 */
const VERSION = 'v1';

function encryptionKey(): Buffer | null {
  const secret = process.env.APP_ENCRYPTION_KEY?.trim() || process.env.ADMIN_SESSION_SECRET?.trim() || '';
  if (secret.length < 32) return null;
  // Domain-separated from the session-signing use of the same secret.
  return createHash('sha256').update(`bdts:secret-box:${VERSION}:`).update(secret).digest();
}

export function canEncrypt(): boolean {
  return encryptionKey() !== null;
}

export function encryptSecret(plain: string): string {
  const key = encryptionKey();
  if (!key) throw new Error('APP_ENCRYPTION_KEY ou ADMIN_SESSION_SECRET (32 caractères minimum) est requis pour enregistrer une clé.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
}

/** Null when the value cannot be decrypted (secret changed or data altered). */
export function decryptSecret(stored: string): string | null {
  const key = encryptionKey();
  const [version, iv, tag, data] = stored.split(':');
  if (!key || version !== VERSION || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
