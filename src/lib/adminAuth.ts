import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Admin authentication.
 *
 * Deliberately dependency-free (node:crypto only) and built around three rules:
 *  - the password is never stored, only a salted scrypt hash, and never logged;
 *  - the session is a signed, expiring, HttpOnly cookie, so it cannot be forged
 *    or read by scripts;
 *  - if the secrets are not configured, the admin area refuses access rather
 *    than falling back to a default password.
 */

export const ADMIN_COOKIE = 'bdts_admin';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SCRYPT_KEYLEN = 64;

function passwordHash(): string {
  return process.env.ADMIN_PASSWORD_HASH?.trim() ?? '';
}

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() ?? '';
}

/** True when the admin area has everything it needs to authenticate anyone. */
export function isAdminConfigured(): boolean {
  return passwordHash().length > 0 && sessionSecret().length > 0;
}

export function adminUser(): string {
  return process.env.ADMIN_USER?.trim() || 'admin';
}

/** Produces `scrypt$<saltHex>$<hashHex>`. Used by scripts/hash-admin-password.ts. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Constant-time password check against ADMIN_PASSWORD_HASH. */
export function verifyPassword(password: string): boolean {
  const stored = passwordHash();
  if (!stored) return false;

  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== SCRYPT_KEYLEN) return false;

  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN);
  return timingSafeEqual(actual, expected);
}

/** Signs `<expiryEpochSeconds>.<hmac>`; returns null when unconfigured. */
export function createSessionToken(): string | null {
  const secret = sessionSecret();
  if (!secret) return null;

  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const signature = createHmac('sha256', secret).update(String(expiry)).digest('hex');
  return `${expiry}.${signature}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  const secret = sessionSecret();
  if (!secret || !token) return false;

  const [expiryPart, signature] = token.split('.');
  if (!expiryPart || !signature) return false;

  const expiry = Number(expiryPart);
  if (!Number.isFinite(expiry) || expiry * 1000 < Date.now()) return false;

  const expected = createHmac('sha256', secret).update(expiryPart).digest('hex');
  const provided = Buffer.from(signature, 'hex');
  const wanted = Buffer.from(expected, 'hex');
  if (provided.length !== wanted.length) return false;

  return timingSafeEqual(provided, wanted);
}

/** HttpOnly + SameSite=Lax; Secure is added outside local development. */
export function sessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${ADMIN_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearedCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
