/**
 * Wires a Resend API key into the two places that need it.
 *
 * Run:
 *   npm run resend:key -- --key re_xxxxxxxx [--from "BDT Sironval <hello@your-domain.be>"]
 *
 * The key may also come from the RESEND_API_KEY environment variable, so it need
 * not appear in the shell history. It is never echoed: only a masked form is
 * printed, and the same value is written to:
 *
 *   1. `.env` — read by `src/lib/email.ts` (sendEmail, emailStatus).
 *   2. the Cline MCP settings file — the `env` block of the `resend` stdio
 *      server, which is what the marketplace panel shows as "Required".
 *
 * Before writing anything the key is checked against GET /domains, and the
 * sending domains are listed so EMAIL_FROM can be confirmed to sit on a verified
 * one. Resend rejects a send from an unverified domain, which would otherwise
 * only surface as a failed verification e-mail.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = join(ROOT, '.env');
const MCP_PATH = join(homedir(), '.cline', 'data', 'settings', 'cline_mcp_settings.json');

const argv = process.argv.slice(2);
const option = (name: string) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
};

const key = (option('key') ?? process.env.RESEND_API_KEY)?.trim();
const from = option('from')?.trim();
const skipVerify = argv.includes('--skip-verify');

if (!key || !key.startsWith('re_')) {
  console.error('✗ Usage: npm run resend:key -- --key re_xxxxxxxx [--from "Name <a@b.c>"]');
  console.error('  Create the key under Resend → API Keys. It always starts with "re_".');
  process.exit(1);
}

/** Enough to recognise which key this is, not enough to use it. */
const mask = (value: string) => `${value.slice(0, 3)}…${value.slice(-4)}`;

interface ResendDomain {
  name: string;
  status: string;
}

/** Returns the domains, or null when the key was rejected. */
async function fetchDomains(apiKey: string): Promise<ResendDomain[] | null> {
  const response = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000)
  }).catch((caught: unknown) => {
    console.error(`✗ Could not reach Resend: ${caught instanceof Error ? caught.message : String(caught)}`);
    return null;
  });

  if (!response) return null;

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`✗ Resend rejected the key (HTTP ${response.status}): ${detail.slice(0, 200)}`);
    return null;
  }

  const body = (await response.json()) as { data?: ResendDomain[] };
  return body.data ?? [];
}

let domains: ResendDomain[] = [];

if (skipVerify) {
  console.log('• --skip-verify: not checking the key against Resend.');
} else {
  const fetched = await fetchDomains(key);
  if (!fetched) process.exit(1);
  domains = fetched;

  if (domains.length === 0) {
    console.log('! The key works, but no sending domain exists yet.');
    console.log('  Add and verify one under Resend → Domains, then set EMAIL_FROM on it.');
  } else {
    console.log('• Sending domains:');
    for (const domain of domains) console.log(`    ${domain.name} — ${domain.status}`);
  }
}

/** Replaces an active or commented assignment in place, else appends it. */
function upsertEnv(text: string, name: string, value: string): string {
  const line = `${name}=${/[\s"<>]/.test(value) ? `"${value}"` : value}`;
  const active = new RegExp(`^\\s*${name}=.*$`, 'm');
  if (active.test(text)) return text.replace(active, line);
  const commented = new RegExp(`^\\s*#\\s*${name}=.*$`, 'm');
  if (commented.test(text)) return text.replace(commented, line);
  return `${text.replace(/\s*$/, '')}\n${line}\n`;
}

if (!existsSync(ENV_PATH)) {
  console.error(`✗ ${ENV_PATH} does not exist. Copy .env.example first.`);
  process.exit(1);
}

let env = readFileSync(ENV_PATH, 'utf8');
env = upsertEnv(env, 'RESEND_API_KEY', key);
if (from) env = upsertEnv(env, 'EMAIL_FROM', from);
writeFileSync(ENV_PATH, env);
console.log(`✓ .env — RESEND_API_KEY=${mask(key)}${from ? `, EMAIL_FROM=${from}` : ''}`);

if (!existsSync(MCP_PATH)) {
  console.error(`! ${MCP_PATH} not found: the Resend MCP server is not installed in Cline.`);
  console.error('  Install it from the MCP panel, then run this script again.');
} else {
  // A global config outside the repository: keep a copy in case it is hand-edited.
  copyFileSync(MCP_PATH, `${MCP_PATH}.bak`);

  const settings = JSON.parse(readFileSync(MCP_PATH, 'utf8')) as {
    mcpServers?: Record<string, { transport?: { env?: Record<string, string> }; env?: Record<string, string> }>;
  };
  const server = settings.mcpServers?.resend;

  if (!server) {
    console.error('! The MCP settings file has no "resend" server. Install it from the MCP panel first.');
  } else {
    // For stdio servers env lives inside the transport object; older flat
    // entries keep it at the top level.
    const target = server.transport ? (server.transport.env ??= {}) : (server.env ??= {});
    target.RESEND_API_KEY = key;
    writeFileSync(MCP_PATH, `${JSON.stringify(settings, null, 2)}\n`);
    console.log(`✓ ${MCP_PATH} — resend env.RESEND_API_KEY=${mask(key)} (backup: .bak)`);
    console.log('  Restart the Resend server from the MCP panel to pick it up.');
  }
}

// Report what the application will now do, using the real code path.
process.env.RESEND_API_KEY = key;
if (from) process.env.EMAIL_FROM = from;

const { emailStatus } = await import('../src/lib/email');
const status = emailStatus();

console.log('\nApplication mail status:');
console.log(`  provider:  ${status.provider}`);
console.log(`  from:      ${status.from ?? '(EMAIL_FROM is not set)'}`);
console.log(`  can send:  ${status.configured ? 'yes' : 'no'}`);
console.log(`  verifies:  ${status.verificationRequired ? 'new accounts must confirm their address' : 'not enforced'}`);
for (const problem of status.problems) console.log(`  ! ${problem}`);

const fromDomain = status.from?.match(/@([^>\s]+)/)?.[1];
if (domains.length > 0 && fromDomain) {
  const match = domains.find((domain) => domain.name === fromDomain);
  if (match?.status !== 'verified') {
    console.log(`  ! ${fromDomain} is ${match ? match.status : 'not in this Resend account'} — sends will be rejected.`);
  }
}
