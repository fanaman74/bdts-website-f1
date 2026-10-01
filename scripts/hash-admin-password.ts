/**
 * Prints the Railway variables for the single admin account.
 *
 * Run:
 *   npm run admin:hash
 *
 * The password is typed at a hidden prompt (or read from ADMIN_NEW_PASSWORD
 * for non-interactive use), is never echoed, and only its scrypt hash is
 * printed. A fresh ADMIN_SESSION_SECRET is printed alongside; reuse the
 * existing one if you only want to change the password.
 */
import { hashPassword, randomSecret, verifyPasswordHash } from '../src/lib/password';

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error('No terminal to prompt on. Set ADMIN_NEW_PASSWORD instead.'));
      return;
    }

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdout.write('\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on('data', onData);
  });
}

let password = process.env.ADMIN_NEW_PASSWORD;
if (!password) {
  password = await promptHidden('New admin password: ');
  const again = await promptHidden('Repeat it: ');
  if (password !== again) {
    console.error('✗ The two entries differ.');
    process.exit(1);
  }
}

if (password.length < 12) {
  console.error('✗ Use at least 12 characters.');
  process.exit(1);
}

const hash = hashPassword(password);
if (!verifyPasswordHash(password, hash)) {
  console.error('✗ Hash self-check failed.');
  process.exit(1);
}

console.log('\nAdd these in Railway → service → Variables (then redeploy):\n');
console.log('ADMIN_USERNAME=<your login name>');
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log(`ADMIN_SESSION_SECRET=${randomSecret()}`);
console.log('\nThe password itself is not printed and is not stored anywhere.');
