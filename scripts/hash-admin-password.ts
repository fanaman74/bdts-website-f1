/**
 * Generates the admin credentials, or resets them.
 *
 * Run:
 *   npm run admin:hash -- "a long unique passphrase"           # print the values
 *   npm run admin:hash -- "a long unique passphrase" --env     # also write them to .env
 *
 * The passphrase itself is never stored anywhere — only a salted scrypt hash.
 * Without `--env` the three values are printed so they can be pasted into
 * Railway; with it they are written into `.env` for local development, which
 * avoids hand-copying a 155-character hash into a web form.
 *
 * Resetting the password also rotates ADMIN_SESSION_SECRET, which signs out any
 * existing session.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/lib/adminAuth';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const writeEnv = argv.includes('--env');
// Flags are stripped so `--env` is never mistaken for part of the passphrase.
const password = argv.filter((argument) => !argument.startsWith('--')).join(' ');

if (!password) {
  console.error('✗ Usage: npm run admin:hash -- "your-passphrase" [--env]');
  process.exit(1);
}

if (password.length < 12) {
  console.error('✗ Use at least 12 characters. This protects every form submission in the database.');
  process.exit(1);
}

const user = process.env.ADMIN_USER?.trim() || 'admin';
const hash = hashPassword(password);
const secret = hashPassword(`${password}:session`).split('$').slice(1).join('$');

if (!writeEnv) {
  console.log('Add these to Railway — the variable NAME matters as much as the value:');
  console.log('');
  console.log(`ADMIN_USER=${user}`);
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log(`ADMIN_SESSION_SECRET=${secret}`);
  console.log('');
  console.log('ADMIN_SESSION_SECRET only needs to be random and secret; rotating it signs everyone out.');
  console.log('Tip: add `--env` to write these into .env for local development instead.');
} else {
  const path = join(ROOT, '.env');
  let lines: string[] = [];
  try {
    lines = readFileSync(path, 'utf8').split(/\r?\n/);
  } catch {
    // No .env yet: it will be created.
  }

  const wanted: Record<string, string> = {
    ADMIN_USER: user,
    ADMIN_PASSWORD_HASH: hash,
    ADMIN_SESSION_SECRET: secret
  };

  for (const [key, value] of Object.entries(wanted)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }

  while (lines.length > 0 && (lines[lines.length - 1] ?? '').trim() === '') lines.pop();
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');

  console.log(`✓ Wrote ADMIN_USER, ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET to ${path}`);
  console.log('  Local: restart the dev server — npx astro dev stop && npx astro dev --background');
  console.log('  Railway: set ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET to the same values.');
}
