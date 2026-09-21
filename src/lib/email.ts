/**
 * Transactional email, provider-agnostic.
 *
 * The `console` provider is the fallback: with no credentials configured it
 * prints the message — verification link included — to the server log, so the
 * whole sign-up flow can be exercised locally without an email account.
 *
 * Verification is only enforced when a real provider is configured, because
 * requiring a link we cannot send would dead-end registration.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface EmailProvider {
  id: string;
  name: string;
  /** Environment variable holding the API key; null when the provider needs none. */
  apiKeyEnv: string | null;
  send(message: EmailMessage, apiKey: string, from: string): Promise<void>;
}

const PROVIDERS: Record<string, EmailProvider> = {
  brevo: {
    id: 'brevo',
    name: 'Brevo',
    apiKeyEnv: 'BREVO_API_KEY',
    async send(message, apiKey, from) {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        // Brevo authenticates with a plain `api-key` header, not a Bearer token.
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: parseFromAddress(from),
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          ...(message.html ? { htmlContent: message.html } : {})
        }),
        signal: AbortSignal.timeout(15_000)
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Brevo HTTP ${response.status}: ${detail.slice(0, 200)}`);
      }
    }
  },
  resend: {
    id: 'resend',
    name: 'Resend',
    apiKeyEnv: 'RESEND_API_KEY',
    async send(message, apiKey, from) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html
        }),
        signal: AbortSignal.timeout(15_000)
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Resend HTTP ${response.status}: ${detail.slice(0, 200)}`);
      }
    }
  },
  console: {
    id: 'console',
    name: 'Console',
    apiKeyEnv: null,
    async send(message, _apiKey, from) {
      console.info('[email] console provider — nothing was actually sent');
      console.info(`[email] from: ${from}`);
      console.info(`[email] to:   ${message.to}`);
      console.info(`[email] subj: ${message.subject}`);
      console.info(message.text);
    }
  }
};

/** Brevo wants the sender split into name and email. */
function parseFromAddress(from: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (match) return match[1] ? { name: match[1], email: match[2]! } : { email: match[2]! };
  return { email: from.trim() };
}

/** The provider to use: explicit EMAIL_PROVIDER, else a keyed provider, else console. */
export function emailProvider(): EmailProvider {
  const requested = process.env.EMAIL_PROVIDER?.trim();
  if (requested && PROVIDERS[requested]) return PROVIDERS[requested]!;
  if (process.env.BREVO_API_KEY?.trim()) return PROVIDERS.brevo!;
  if (process.env.RESEND_API_KEY?.trim()) return PROVIDERS.resend!;
  return PROVIDERS.console!;
}

/**
 * True when mail can actually leave the building.
 *
 * An *explicitly requested* console provider counts as configured, so the
 * verification-enforced path can be exercised locally (links appear in the
 * server log). Never set EMAIL_PROVIDER=console in production: real users would
 * never receive their link.
 */
export function isEmailConfigured(): boolean {
  if (process.env.EMAIL_PROVIDER?.trim() === 'console') return true;

  const provider = emailProvider();
  if (!provider.apiKeyEnv) return false;
  return Boolean(process.env[provider.apiKeyEnv]?.trim());
}

/**
 * Whether accounts must verify their address before signing in.
 *
 * Requires both a working provider and a From address: a verified sending domain
 * is what stops mail being rejected or filed as spam, and a link that never
 * arrives must not lock someone out.
 */
export function requiresEmailVerification(): boolean {
  return isEmailConfigured() && Boolean(process.env.EMAIL_FROM?.trim());
}

/** Sends a message. Returns false and logs instead of throwing, so no flow breaks. */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const provider = emailProvider();
  const apiKey = provider.apiKeyEnv ? (process.env[provider.apiKeyEnv]?.trim() ?? '') : '';
  const from = process.env.EMAIL_FROM?.trim() || 'BDTS <no-reply@example.invalid>';

  if (provider.apiKeyEnv && !apiKey) {
    console.error(`[email] ${provider.apiKeyEnv} is not set; not sending.`);
    return false;
  }

  try {
    await provider.send(message, apiKey, from);
    return true;
  } catch (error) {
    console.error('[email] Send failed:', error instanceof Error ? error.message : error);
    return false;
  }
}
