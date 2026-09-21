import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing, shared by the account store and the CLI scripts.
 *
 * Only a salted scrypt hash is ever persisted; the password itself is never
 * stored and never logged. Comparisons are constant-time.
 */

const KEYLEN = 64;
const SALT_BYTES = 16;

/** Produces `scrypt$<saltHex>$<hashHex>`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Constant-time check of a password against a stored `scrypt$…` value. */
export function verifyPasswordHash(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== KEYLEN) return false;

  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), KEYLEN);
  return timingSafeEqual(actual, expected);
}

/** A random secret suitable for ADMIN_SESSION_SECRET. */
export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
