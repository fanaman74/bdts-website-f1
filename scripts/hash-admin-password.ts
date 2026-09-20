/**
 * Generates the ADMIN_PASSWORD_HASH value for the admin area.
 *
 * Run: npm run admin:hash -- "a long unique passphrase"
 * The password itself is never written anywhere — only the salted scrypt hash.
 */
import { hashPassword } from '../src/lib/adminAuth';

const password = process.argv.slice(2).join(' ');

if (!password) {
  console.error('✗ Usage: npm run admin:hash -- "your-password"');
  process.exit(1);
}

if (password.length < 12) {
  console.error('✗ Use at least 12 characters. This protects every form submission in the database.');
  process.exit(1);
}

console.log('Add these to Railway (and to .env for local development):');
console.log('');
console.log(`ADMIN_USER=${process.env.ADMIN_USER?.trim() || 'admin'}`);
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
console.log(`ADMIN_SESSION_SECRET=${hashPassword(`${password}:session`).split('$').slice(1).join('$')}`);
console.log('');
console.log('ADMIN_SESSION_SECRET only needs to be random and secret; rotate it to sign everyone out.');
