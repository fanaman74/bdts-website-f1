import { createHash, randomBytes } from 'node:crypto';
import { getDbClient } from './db';
import { hashPassword, verifyPasswordHash } from './password';

export const USER_ROLES = ['admin', 'member', 'pending'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  /** Provider rejection from the last verification email; null when accepted. */
  verificationLastError: string | null;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrateur',
  member: 'Membre',
  pending: 'En attente'
};

type Row = Record<string, unknown>;

function toUser(row: Row): User {
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name === null || row.name === undefined ? null : String(row.name),
    role: String(row.role) as UserRole,
    createdAt: new Date(String(row.created_at)).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(String(row.last_login_at)).toISOString() : null,
    emailVerifiedAt: row.email_verified_at ? new Date(String(row.email_verified_at)).toISOString() : null,
    verificationLastError: row.verification_last_error ? String(row.verification_last_error) : null
  };
}

/** Emails are stored lowercase; the column enforces it too. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserById(id: string): Promise<User | null> {
  const db = getDbClient();
  if (!db) return null;

  const rows = await db.query('select id, email, name, role, created_at, last_login_at, email_verified_at, verification_last_error from public.users where id = $1', [id]);
  const row = rows[0];
  return row ? toUser(row) : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getDbClient();
  if (!db) return null;

  const rows = await db.query(
    'select id, email, name, role, created_at, last_login_at, email_verified_at, verification_last_error from public.users where email = $1',
    [normaliseEmail(email)]
  );
  const row = rows[0];
  return row ? toUser(row) : null;
}

export async function listUsers(): Promise<User[]> {
  const db = getDbClient();
  if (!db) return [];

  const rows = await db.query(
    'select id, email, name, role, created_at, last_login_at, email_verified_at, verification_last_error from public.users order by role, created_at asc'
  );
  return rows.map(toUser);
}

export async function userCounts(): Promise<Record<UserRole, number>> {
  const counts: Record<UserRole, number> = { admin: 0, member: 0, pending: 0 };
  const db = getDbClient();
  if (!db) return counts;

  const rows = await db.query('select role, count(*)::int as count from public.users group by role');
  for (const row of rows) {
    const role = String(row.role) as UserRole;
    if (role in counts) counts[role] = Number(row.count);
  }
  return counts;
}

export type CreateUserResult = { ok: true; user: User } | { ok: false; reason: 'exists' | 'unavailable' };

/** Creates an account. The caller decides the role; the default is `pending`. */
export async function createUser(input: {
  email: string;
  name?: string | null;
  password: string;
  role?: UserRole;
}): Promise<CreateUserResult> {
  const db = getDbClient();
  if (!db) return { ok: false, reason: 'unavailable' };

  const email = normaliseEmail(input.email);
  const role = input.role ?? 'pending';

  try {
    const rows = await db.query(
      `insert into public.users (email, name, password_hash, role)
       values ($1, $2, $3, $4)
       returning id, email, name, role, created_at, last_login_at, email_verified_at, verification_last_error`,
      [email, input.name?.trim() || null, hashPassword(input.password), role]
    );
    const row = rows[0];
    if (!row) return { ok: false, reason: 'unavailable' };
    return { ok: true, user: toUser(row) };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('users_email_key') || message.includes('duplicate key')) {
      return { ok: false, reason: 'exists' };
    }
    throw error;
  }
}

/** Validates credentials without revealing whether the email exists. */
export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const db = getDbClient();
  if (!db) return null;

  const rows = await db.query(
    'select id, email, name, role, created_at, last_login_at, email_verified_at, verification_last_error, password_hash from public.users where email = $1',
    [normaliseEmail(email)]
  );
  const row = rows[0];
  if (!row) return null;

  if (!verifyPasswordHash(password, String(row.password_hash))) return null;
  return toUser(row);
}

export async function recordLogin(id: string): Promise<void> {
  const db = getDbClient();
  if (!db) return;
  await db.query('update public.users set last_login_at = now() where id = $1', [id]);
}

export async function updateUserRole(id: string, role: string): Promise<boolean> {
  const db = getDbClient();
  if (!db) return false;
  if (!(USER_ROLES as readonly string[]).includes(role)) return false;

  await db.query('update public.users set role = $1 where id = $2', [role, id]);
  return true;
}

export async function setUserPassword(id: string, password: string): Promise<boolean> {
  const db = getDbClient();
  if (!db) return false;

  await db.query('update public.users set password_hash = $1 where id = $2', [hashPassword(password), id]);
  return true;
}

export async function deleteUser(id: string): Promise<boolean> {
  const db = getDbClient();
  if (!db) return false;
  await db.query('delete from public.users where id = $1', [id]);
  return true;
}

/** How many admins exist — used to refuse removing the last one. */
export async function adminCount(): Promise<number> {
  const db = getDbClient();
  if (!db) return 0;

  const rows = await db.query("select count(*)::int as count from public.users where role = 'admin'");
  return Number(rows[0]?.count ?? 0);
}

/* ---------- Email verification ---------- */

/** How long a verification link stays valid. */
const VERIFICATION_TTL_MINUTES = 24 * 60;

/** Minimum gap between two verification emails for the same account. */
const VERIFICATION_COOLDOWN_SECONDS = 60;

export function createVerificationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, hash: hashVerificationToken(token) };
}

/** Only the hash is stored; the raw token exists solely inside the emailed link. */
export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Stores a fresh token on the account, replacing any previous one. */
export async function setVerificationToken(userId: string, hash: string): Promise<void> {
  const db = getDbClient();
  if (!db) return;

  await db.query(
    `update public.users
        set verification_token_hash = $1,
            verification_expires_at = now() + make_interval(mins => $2::int),
            verification_sent_at = now()
      where id = $3`,
    [hash, VERIFICATION_TTL_MINUTES, userId]
  );
}

/** Resolves a raw token to its account, or null when unknown or expired. */
export async function findUserByVerificationToken(token: string): Promise<User | null> {
  const db = getDbClient();
  if (!db) return null;

  const rows = await db.query(
    `select id, email, name, role, created_at, last_login_at, email_verified_at, verification_last_error
       from public.users
      where verification_token_hash = $1
        and verification_expires_at > now()`,
    [hashVerificationToken(token)]
  );
  const row = rows[0];
  return row ? toUser(row) : null;
}

/** Marks the address verified and burns the token so it cannot be replayed. */
export async function markEmailVerified(userId: string): Promise<void> {
  const db = getDbClient();
  if (!db) return;

  await db.query(
    `update public.users
        set email_verified_at = now(),
            verification_token_hash = null,
            verification_expires_at = null
      where id = $1`,
    [userId]
  );
}

/** True when a link was sent too recently to send another. */
export async function verificationOnCooldown(userId: string): Promise<boolean> {
  const db = getDbClient();
  if (!db) return false;

  const rows = await db.query(
    `select verification_sent_at > now() - make_interval(secs => $1::int) as recent
       from public.users where id = $2`,
    [VERIFICATION_COOLDOWN_SECONDS, userId]
  );
  return Boolean(rows[0]?.recent);
}

/**
 * Records whether the mail provider accepted the last verification email.
 *
 * Pass null on success, or the provider's message on failure. This is what makes
 * a silent rejection visible in the admin area instead of only in the logs.
 */
export async function recordVerificationOutcome(userId: string, error: string | null): Promise<void> {
  const db = getDbClient();
  if (!db) return;

  await db.query('update public.users set verification_last_error = $1 where id = $2', [error, userId]);
}
