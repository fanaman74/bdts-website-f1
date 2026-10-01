/**
 * Sends one real message through the configured provider, to prove the mail
 * setup end to end.
 *
 * Run:
 *   npm run resend:test -- --to you@example.com
 *
 * Registration itself cannot be used to check this: the verification link goes
 * to whoever signed up, and a failure is only visible afterwards in
 * `users.verification_last_error`. This sends on demand and prints the
 * provider's own rejection, which is what makes a wrong EMAIL_FROM or an
 * unverified domain obvious.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const to = option('to')?.trim();

if (!to || !to.includes('@')) {
  console.error('✗ Usage: npm run resend:test -- --to you@example.com');
  process.exit(1);
}

const { emailStatus, sendEmail } = await import('../src/lib/email');
const status = emailStatus();

console.log('Configuration:');
console.log(`  provider:  ${status.provider}`);
console.log(`  from:      ${status.from ?? '(EMAIL_FROM is not set)'}`);
console.log(`  can send:  ${status.configured ? 'yes' : 'no'}`);
for (const problem of status.problems) console.log(`  ! ${problem}`);
console.log('');

if (!status.configured) {
  console.error('✗ Refusing to send: the configuration is incomplete.');
  process.exit(1);
}

const result = await sendEmail({
  to,
  subject: 'Test — BDT Sironval',
  text:
    'Ceci est un message de test envoyé depuis le site.\n\n' +
    'Si vous le lisez, la configuration e-mail fonctionne : la clé est valide et ' +
    'le domaine expéditeur est vérifié.'
});

if (result.ok) {
  console.log(`✓ Accepted by ${status.provider} for ${to}.`);
  console.log('  Check the inbox, and the spam folder: a fresh domain has no reputation yet.');
} else {
  console.error(`✗ ${result.error}`);
  process.exit(1);
}
