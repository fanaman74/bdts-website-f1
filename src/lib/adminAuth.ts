import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Session handling for the admin area.
 *
 * The session is a signed, expiring, HttpOnly cookie carrying only the account
 * id. The role is read from the database on each request, so promoting or
 * suspending an account takes effect immediately rather than at next sign-in.
 *
 * Passwords are no longer compared against an environment variable: accounts
 * live in the `users` table and authentication happens in src/lib/users.ts.
 */

export const ADMIN_COOKIE = 'bdts_admin';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() ?? '';
}

/** Sessions can only be signed when the secret is configured. */
export function isSessionConfigured(): boolean {
  return sessionSecret().length > 0;
}

/** Token format: `<userId>.<expiryEpochSeconds>.<hmac>`. */
export function createSessionToken(userId: string): string | null {
  const secret = sessionSecret();
  if (!secret) return null;

  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${userId}.${expiry}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

/** Returns the account id for a valid, unexpired token, else null. */
export function verifySessionToken(token: string | undefined): { userId: string } | null {
  const secret = sessionSecret();
  if (!secret || !token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiryPart, signature] = parts as [string, string, string];
  if (!userId || !expiryPart || !signature) return null;

  const expiry = Number(expiryPart);
  if (!Number.isFinite(expiry) || expiry * 1000 < Date.now()) return null;

  const expected = createHmac('sha256', secret).update(`${userId}.${expiryPart}`).digest('hex');
  const provided = Buffer.from(signature, 'hex');
  const wanted = Buffer.from(expected, 'hex');
  if (provided.length !== wanted.length) return null;

  return timingSafeEqual(provided, wanted) ? { userId } : null;
}

/**
 * The origin a browser actually used.
 *
 * The Node adapter ignores `x-forwarded-proto`, so `Astro.url.protocol` is
 * `http:` behind Railway's TLS termination. Reading the forwarded headers keeps
 * both the session cookie's `Secure` flag and any link we email correct.
 */
export function externalOrigin(request: Request): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();

  const protocol = forwardedProto || new URL(request.url).protocol.replace(':', '');
  const host = forwardedHost || request.headers.get('host') || new URL(request.url).host;

  return `${protocol}://${host}`;
}

export function isSecureRequest(request: Request): boolean {
  return externalOrigin(request).startsWith('https://');
}

/** Only same-site admin paths, so `next` cannot become an open redirect. */
export function safeNextPath(value: unknown, fallback = '/admin'): string {
  const next = typeof value === 'string' ? value : '';
  return /^\/admin(\/|$)/.test(next) ? next : fallback;
}
