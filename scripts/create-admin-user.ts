/**
 * Creates or resets an admin-area account.
 *
 * Run:
 *   npm run admin:user -- --email fredanaman@gmail.com --name Fred --role admin
 *
 * The password comes from `--password` or the ADMIN_NEW_PASSWORD environment
 * variable, so it need not appear in the output. Only a salted scrypt hash is
 * stored. Running it again for an existing email resets that account's password
 * and role.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUser, findUserByEmail, markEmailVerified, setUserPassword, updateUserRole, USER_ROLES, type UserRole } from '../src/lib/users';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// tsx does not load .env automatically; Node >= 22.12 exposes loadEnvFile().
try {
  process.loadEnvFile(join(ROOT, '.env'));
} catch {
  // No .env file: rely on the ambient environment.
}

const argv = process.argv.slice(2);
const option = (name: string) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
};

const email = option('email')?.trim();
const name = option('name')?.trim();
const role = (option('role')?.trim() || 'admin') as UserRole;
const password = option('password') ?? process.env.ADMIN_NEW_PASSWORD;

if (!email || !email.includes('@')) {
  console.error('✗ Usage: npm run admin:user -- --email you@example.com [--name "Full Name"] [--role admin|member|pending]');
  process.exit(1);
}

if (!(USER_ROLES as readonly string[]).includes(role)) {
  console.error(`✗ --role must be one of: ${USER_ROLES.join(', ')}`);
  process.exit(1);
}

if (!password) {
  console.error('✗ No password given. Pass --password "…" or set ADMIN_NEW_PASSWORD.');
  console.error('  It is never echoed by this script and never stored in clear text.');
  process.exit(1);
}

if (password.length < 12) {
  console.error('✗ Use at least 12 characters.');
  process.exit(1);
}

const existing = await findUserByEmail(email);

if (existing) {
  await setUserPassword(existing.id, password);
  await updateUserRole(existing.id, role);
  // Mark verified: an operator creating the account deliberately has already
  // established that the address is real. Without this, a CLI-created admin
  // would be locked out by the email-verification gate.
  await markEmailVerified(existing.id);
  console.log(`✓ Reset ${existing.email} — password updated, role ${role}, address marked verified.`);
} else {
  const result = await createUser({ email, name: name ?? null, password, role });
  if (!result.ok) {
    console.error(`✗ Could not create the account (${result.reason}).`);
    process.exit(1);
  }
  await markEmailVerified(result.user.id);
  console.log(`✓ Created ${result.user.email} with role ${result.user.role} (address marked verified).`);
  console.log('  They can sign in at /admin/login once the site is deployed.');
}
