import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing for the single admin account.
 *
 * Only a salted scrypt hash is ever stored (in the ADMIN_PASSWORD_HASH Railway
 * variable); the password itself is never stored and never logged. The cost
 * parameters are embedded in the hash so they can be raised later without
 * breaking existing values. Fields are `:`-separated rather than `$`-separated
 * so the value can be pasted into Railway or a shell without escaping.
 */

const KEYLEN = 64;
const SALT_BYTES = 16;
const N = 2 ** 15;
const R = 8;
const P = 1;
// scrypt needs ~128 * N * r bytes; leave headroom over Node's 32 MiB default.
const MAXMEM = 64 * 1024 * 1024;

/** Produces `scrypt:<N>:<r>:<p>:<saltHex>:<hashHex>`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt:${N}:${R}:${P}:${salt.toString('hex')}:${derived.toString('hex')}`;
}

/** True when the value has the shape hashPassword() produces. */
export function isPasswordHash(stored: string): boolean {
  return /^scrypt:\d+:\d+:\d+:[0-9a-f]+:[0-9a-f]{128}$/.test(stored);
}

/** Constant-time check of a password against a stored `scrypt:…` value. */
export function verifyPasswordHash(password: string, stored: string): boolean {
  if (!isPasswordHash(stored)) return false;
  const [, nPart, rPart, pPart, saltHex, hashHex] = stored.split(':') as [string, string, string, string, string, string];

  const cost = { N: Number(nPart), r: Number(rPart), p: Number(pPart), maxmem: MAXMEM };
  // Refuse absurd parameters rather than let a mistyped variable exhaust memory.
  if (cost.N < 2 ** 14 || cost.N > 2 ** 17 || cost.r < 1 || cost.r > 16 || cost.p < 1 || cost.p > 4) return false;
  cost.maxmem = Math.max(MAXMEM, 256 * cost.N * cost.r);

  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), KEYLEN, cost);
  return timingSafeEqual(actual, expected);
}

/** A random secret suitable for ADMIN_SESSION_SECRET. */
export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
