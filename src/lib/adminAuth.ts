import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { hashPassword, isPasswordHash, verifyPasswordHash } from './password';
import { findUserWithHash, passwordFingerprint, type UserRole } from './users';

/**
 * Authentication for the admin area.
 *
 * Two kinds of account can sign in:
 *
 *  - the built-in administrator, whose credentials live only in Railway:
 *      ADMIN_USERNAME        the login name
 *      ADMIN_PASSWORD_HASH   scrypt hash from `npm run admin:hash` (never the password)
 *    It always has the admin role, does not depend on the database, and cannot
 *    be edited or removed from the admin area, so nobody can lock it out;
 *  - accounts added from /admin/users (src/lib/users.ts), signing in with their
 *    email address.
 *
 * ADMIN_SESSION_SECRET signs the session cookie: signed, expiring, HttpOnly.
 * The signing key mixes the secret with the built-in password hash, so changing
 * either signs everyone out. A database account's session also carries a
 * fingerprint of its own hash, and its role is re-read on every request, so a
 * password reset, role change or deletion takes effect immediately.
 */

export const ADMIN_COOKIE = 'bdts_admin';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface AdminSession {
  kind: 'builtin' | 'user';
  /** `builtin` for the Railway account, else the users row id. */
  id: string;
  /** Login name or email address. */
  username: string;
  name: string | null;
  role: UserRole;
}

/** Paths only the admin role may open. Everything else under /admin is open to every role. */
const ADMIN_ONLY_PREFIXES = ['/admin/users'];

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function sessionSecret(): string {
  return env('ADMIN_SESSION_SECRET');
}

export function adminUsername(): string {
  return env('ADMIN_USERNAME');
}

function adminPasswordHash(): string {
  return env('ADMIN_PASSWORD_HASH');
}

/** Which required variables are missing or malformed, for the login page. */
export function missingAdminConfig(): string[] {
  const missing: string[] = [];
  if (!adminUsername()) missing.push('ADMIN_USERNAME');
  if (!isPasswordHash(adminPasswordHash())) missing.push('ADMIN_PASSWORD_HASH');
  if (sessionSecret().length < 32) missing.push('ADMIN_SESSION_SECRET');
  return missing;
}

export function isAdminConfigured(): boolean {
  return missingAdminConfig().length === 0;
}

function sameText(a: string, b: string): boolean {
  // Hash first so the comparison is constant-time regardless of length.
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

// Burned when no account matches, so an unknown login takes as long as a wrong
// password and the response time does not reveal which one was wrong.
let decoyHash: string | null = null;

function burnDecoy(password: string): void {
  decoyHash ??= hashPassword('decoy');
  verifyPasswordHash(password, decoyHash);
}

function logLookupFailure(error: unknown): null {
  console.error('[admin] Account lookup failed:', error instanceof Error ? error.message : error);
  return null;
}

function builtinSession(): AdminSession {
  return { kind: 'builtin', id: 'builtin', username: adminUsername(), name: null, role: 'admin' };
}

/** Checks submitted credentials: the Railway account first, then database accounts by email. */
export async function verifyAdminCredentials(login: string, password: string): Promise<AdminSession | null> {
  if (!isAdminConfigured()) return null;

  const submitted = login.trim().toLowerCase();
  if (sameText(submitted, adminUsername().toLowerCase())) {
    return verifyPasswordHash(password, adminPasswordHash()) ? builtinSession() : null;
  }

  const found = submitted.includes('@') ? await findUserWithHash({ email: submitted }).catch(logLookupFailure) : null;
  if (!found || !found.user.canSignIn || !found.user.role) {
    burnDecoy(password);
    return null;
  }
  if (!verifyPasswordHash(password, found.hash)) return null;

  return { kind: 'user', id: found.user.id, username: found.user.email, name: found.user.name, role: found.user.role };
}

function signingKey(): string {
  return `${sessionSecret()}:${adminPasswordHash()}`;
}

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('hex');
}

/**
 * Token format: `<base64url subject>.<fingerprint>.<expiryEpochSeconds>.<hmac>`,
 * where the subject is `builtin:<username>` or `user:<id>`.
 */
export async function createSessionToken(session: AdminSession): Promise<string | null> {
  if (!isAdminConfigured()) return null;

  let subject = `builtin:${session.username}`;
  let fingerprint = '-';
  if (session.kind === 'user') {
    const found = await findUserWithHash({ id: session.id });
    if (!found) return null;
    subject = `user:${session.id}`;
    fingerprint = passwordFingerprint(found.hash);
  }

  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${Buffer.from(subject).toString('base64url')}.${fingerprint}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the session for a valid, unexpired token whose account still has access, else null. */
export async function verifySessionToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token || !isAdminConfigured()) return null;

  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [subjectPart, fingerprint, expiryPart, signature] = parts as [string, string, string, string];
  if (!subjectPart || !fingerprint || !expiryPart || !/^[0-9a-f]{64}$/.test(signature)) return null;

  const expiry = Number(expiryPart);
  if (!Number.isFinite(expiry) || expiry * 1000 < Date.now()) return null;

  const expected = Buffer.from(sign(`${subjectPart}.${fingerprint}.${expiryPart}`), 'hex');
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), expected)) return null;

  const subject = Buffer.from(subjectPart, 'base64url').toString();

  // A token for a previous username stops working once ADMIN_USERNAME changes.
  if (subject.startsWith('builtin:')) {
    return subject === `builtin:${adminUsername()}` ? builtinSession() : null;
  }

  if (!subject.startsWith('user:')) return null;
  // A database outage signs database accounts out; the built-in account above keeps working.
  const found = await findUserWithHash({ id: subject.slice('user:'.length) }).catch(logLookupFailure);
  if (!found || !found.user.canSignIn || !found.user.role) return null;
  if (passwordFingerprint(found.hash) !== fingerprint) return null;

  return { kind: 'user', id: found.user.id, username: found.user.email, name: found.user.name, role: found.user.role };
}

/**
 * The origin a browser actually used.
 *
 * The Node adapter ignores `x-forwarded-proto`, so `Astro.url.protocol` is
 * `http:` behind Railway's TLS termination. Reading the forwarded headers keeps
 * the session cookie's `Secure` flag correct.
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
  return /^\/admin(\/|$)/.test(next) && !next.startsWith('/admin/login') ? next : fallback;
}

/* ---------- Login rate limiting ---------- */

const WINDOW_MS = 15 * 60_000;
/** Attempts per client address per window. */
const PER_CLIENT_LIMIT = 8;
/**
 * Failed attempts across all addresses per window. A backstop for an attacker
 * rotating addresses; it can briefly lock the real admin out too, which is the
 * accepted trade-off for an account that guards customer data.
 */
const GLOBAL_FAILURE_LIMIT = 50;

const attempts = new Map<string, number[]>();
let failures: number[] = [];

/**
 * The client address as Railway's edge reports it. `X-Real-IP` is set by the
 * edge; in `X-Forwarded-For` the last entry is the one the edge appended, while
 * earlier entries are whatever the client chose to send.
 */
export function clientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',').at(-1)!.trim();
  return 'unknown';
}

function recent(list: number[], now: number): number[] {
  return list.filter((timestamp) => now - timestamp < WINDOW_MS);
}

/** Records an attempt and says whether it may proceed. */
export function allowLoginAttempt(ip: string): boolean {
  const now = Date.now();
  failures = recent(failures, now);
  const mine = recent(attempts.get(ip) ?? [], now);

  if (mine.length >= PER_CLIENT_LIMIT || failures.length >= GLOBAL_FAILURE_LIMIT) {
    attempts.set(ip, mine);
    return false;
  }

  mine.push(now);
  attempts.set(ip, mine);

  // Keep the map from growing without bound under a spray of addresses.
  if (attempts.size > 10_000) {
    for (const [key, list] of attempts) if (!recent(list, now).length) attempts.delete(key);
  }
  return true;
}

export function recordLoginFailure(): void {
  failures.push(Date.now());
}

/** A successful sign-in clears that address's counter. */
export function clearLoginAttempts(ip: string): void {
  attempts.delete(ip);
}
