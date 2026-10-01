import { createHash } from 'node:crypto';
import { getDbClient } from './db';
import { hashPassword, isPasswordHash } from './password';

/**
 * Admin-area accounts added from /admin/users, stored in the Neon `users` table.
 *
 * These sit alongside the built-in administrator configured in Railway
 * (see src/lib/adminAuth.ts), who can always sign in and cannot be removed here.
 *
 *   admin   everything, including managing these accounts and the settings
 *   member  "Collaborateur": reads and handles messages and claims only
 *
 * Rows left over from the old self-registration flow may still carry the role
 * `pending` or an old-format password hash. Neither can sign in until an
 * administrator gives the account a role and a new password here.
 */

export const USER_ROLES = ['admin', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrateur',
  member: 'Collaborateur'
};

export function isUserRole(value: unknown): value is UserRole {
  return (USER_ROLES as readonly unknown[]).includes(value);
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  /** null for a legacy `pending` row: the account has no access. */
  role: UserRole | null;
  createdAt: string;
  lastLoginAt: string | null;
  /** False until the account has a role and a password set from this page. */
  canSignIn: boolean;
}

type Row = Record<string, unknown>;

const COLUMNS = 'id, email, name, role, created_at, last_login_at, password_hash';

function toUser(row: Row): User {
  const role = isUserRole(row.role) ? row.role : null;
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name === null || row.name === undefined ? null : String(row.name),
    role,
    createdAt: new Date(String(row.created_at)).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(String(row.last_login_at)).toISOString() : null,
    canSignIn: role !== null && isPasswordHash(String(row.password_hash))
  };
}

/** Short digest of the stored hash, carried in the session so a reset signs the account out. */
export function passwordFingerprint(hash: string): string {
  return createHash('sha256').update(hash).digest('hex').slice(0, 16);
}

/** Emails are stored lowercase; the column enforces it too. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isDatabaseConfigured(): boolean {
  return getDbClient() !== null;
}

export async function listUsers(): Promise<User[]> {
  const db = getDbClient();
  if (!db) return [];

  const rows = await db.query(`select ${COLUMNS} from public.users order by created_at asc`);
  return rows.map(toUser);
}

/** The account plus its stored hash, for sign-in and session checks only. */
export async function findUserWithHash(by: { id: string } | { email: string }): Promise<{ user: User; hash: string } | null> {
  const db = getDbClient();
  if (!db) return null;

  const rows =
    'id' in by
      ? await db.query(`select ${COLUMNS} from public.users where id::text = $1`, [by.id])
      : await db.query(`select ${COLUMNS} from public.users where email = $1`, [normaliseEmail(by.email)]);
  const row = rows[0];
  return row ? { user: toUser(row), hash: String(row.password_hash) } : null;
}

export type CreateUserResult = { ok: true; user: User } | { ok: false; reason: 'exists' | 'unavailable' };

export async function createUser(input: { email: string; name?: string | null; password: string; role: UserRole }): Promise<CreateUserResult> {
  const db = getDbClient();
  if (!db) return { ok: false, reason: 'unavailable' };

  try {
    const rows = await db.query(
      `insert into public.users (email, name, password_hash, role, email_verified_at)
       values ($1, $2, $3, $4, now())
       returning ${COLUMNS}`,
      [normaliseEmail(input.email), input.name?.trim() || null, hashPassword(input.password), input.role]
    );
    const row = rows[0];
    return row ? { ok: true, user: toUser(row) } : { ok: false, reason: 'unavailable' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('users_email_key') || message.includes('duplicate key')) return { ok: false, reason: 'exists' };
    throw error;
  }
}

export async function updateUserRole(id: string, role: UserRole): Promise<void> {
  const db = getDbClient();
  if (!db) return;
  await db.query('update public.users set role = $1 where id::text = $2', [role, id]);
}

export async function setUserPassword(id: string, password: string): Promise<void> {
  const db = getDbClient();
  if (!db) return;
  await db.query('update public.users set password_hash = $1 where id::text = $2', [hashPassword(password), id]);
}

export async function deleteUser(id: string): Promise<void> {
  const db = getDbClient();
  if (!db) return;
  await db.query('delete from public.users where id::text = $1', [id]);
}

export async function recordLogin(id: string): Promise<void> {
  const db = getDbClient();
  if (!db) return;
  await db.query('update public.users set last_login_at = now() where id::text = $1', [id]);
}
