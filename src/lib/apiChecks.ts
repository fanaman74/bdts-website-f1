import { getDbClient } from './db';
import { emailProvider, emailStatus, sendEmail } from './email';
import { PROVIDERS as ASSISTANT_PROVIDERS, resolveAssistant } from './assistantProvider';

/**
 * Live checks for the external services the site depends on, run from the
 * admin "API" page.
 *
 * Every check runs on the server and reports only an outcome, a latency and an
 * error message: no key, connection string or response body that could carry
 * one is ever returned.
 */
export interface CheckResult {
  ok: boolean;
  /** Short French summary shown next to the status pill. */
  summary: string;
  /** Extra non-secret facts (provider, model, database version…). */
  details: string[];
  /** Bounded error text when the check failed. */
  error: string | null;
  latencyMs: number | null;
}

export interface ApiCheck {
  id: string;
  name: string;
  description: string;
  /** Environment variables the check relies on, shown by name only. */
  envVars: string[];
  /** True when this check sends a real email and needs a recipient. */
  needsRecipient?: boolean;
  run(input: { recipient?: string }): Promise<CheckResult>;
}

const TIMEOUT_MS = 15_000;

function has(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

/** Error text safe to show: bounded, with anything key-shaped masked. */
function cleanError(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : String(caught);
  return message
    .replace(/postgres(ql)?:\/\/[^\s'"]+/gi, 'postgresql://…')
    .replace(/\b(sk|re|xkeysib)[-_][A-Za-z0-9_-]{8,}/g, '$1-…')
    .slice(0, 300);
}

function fail(summary: string, error: string | null, latencyMs: number | null = null, details: string[] = []): CheckResult {
  return { ok: false, summary, details, error, latencyMs };
}

async function timed<T>(work: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const started = performance.now();
  const value = await work();
  return { value, latencyMs: Math.round(performance.now() - started) };
}

/** Reads a provider's error body without letting it grow unbounded. */
async function httpError(service: string, response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  return cleanError(`${service} HTTP ${response.status}${body ? ` : ${body.slice(0, 200)}` : ''}`);
}

const databaseCheck: ApiCheck = {
  id: 'database',
  name: 'Base de données Neon',
  description: 'Exécute une requête de lecture et vérifie que les tables du site existent.',
  envVars: ['DATABASE_URL'],
  async run() {
    if (!has('DATABASE_URL')) return fail('Non configurée', 'DATABASE_URL n’est pas défini.');

    const started = performance.now();
    try {
      const db = getDbClient();
      if (!db) return fail('Non configurée', 'DATABASE_URL n’est pas défini.');

      const rows = await db.query(
        `select current_database() as database, split_part(version(), ' ', 2) as version,
                (select count(*) from information_schema.tables where table_schema = 'public')::int as tables`
      );
      const latencyMs = Math.round(performance.now() - started);
      const row = rows[0] ?? {};
      return {
        ok: true,
        summary: 'Connexion établie',
        details: [`Base : ${row.database}`, `PostgreSQL ${row.version}`, `${row.tables} tables dans le schéma public`],
        error: null,
        latencyMs
      };
    } catch (caught) {
      return fail('Échec de la connexion', cleanError(caught), Math.round(performance.now() - started));
    }
  }
};

/** Proves the active email key is accepted, without sending anything. */
const emailKeyCheck: ApiCheck = {
  id: 'email-key',
  name: 'E-mail — clé API',
  description: 'Vérifie que le fournisseur d’e-mail accepte la clé configurée. Aucun message n’est envoyé.',
  envVars: ['RESEND_API_KEY', 'BREVO_API_KEY', 'EMAIL_PROVIDER', 'EMAIL_FROM'],
  async run() {
    const status = emailStatus();
    const provider = emailProvider();
    const details = [`Fournisseur : ${status.provider}`, `Expéditeur : ${status.from ?? 'non défini'}`, ...status.problems.map((p) => `À corriger : ${p}`)];

    if (!provider.apiKeyEnv) {
      return fail('Aucun fournisseur', 'Aucune clé d’e-mail n’est configurée : les messages sont seulement écrits dans les logs.', null, details);
    }
    const apiKey = process.env[provider.apiKeyEnv]?.trim();
    if (!apiKey) return fail('Non configurée', `${provider.apiKeyEnv} n’est pas défini.`, null, details);

    // Resend: GET /domains also lists whether the sending domain is verified.
    // Brevo: GET /account is the documented key check.
    const request: { url: string; headers: Record<string, string> } =
      provider.id === 'brevo'
        ? { url: 'https://api.brevo.com/v3/account', headers: { 'api-key': apiKey, Accept: 'application/json' } }
        : { url: 'https://api.resend.com/domains', headers: { Authorization: `Bearer ${apiKey}` } };

    try {
      const { value: response, latencyMs } = await timed(() =>
        fetch(request.url, { headers: request.headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
      );

      if (provider.id === 'resend' && response.status === 401) {
        // A "sending access" key is valid but may not list domains.
        const body = await response.text().catch(() => '');
        if (body.includes('restricted_api_key')) {
          return { ok: true, summary: 'Clé acceptée (envoi uniquement)', details, error: null, latencyMs };
        }
        return fail('Clé refusée', cleanError(`Resend HTTP 401 : ${body.slice(0, 200)}`), latencyMs, details);
      }
      if (!response.ok) return fail('Clé refusée', await httpError(status.provider, response), latencyMs, details);

      if (provider.id === 'resend') {
        const body = (await response.json().catch(() => ({}))) as { data?: Array<{ name?: string; status?: string }> };
        for (const domain of body.data ?? []) details.push(`Domaine ${domain.name} : ${domain.status}`);
      }
      return { ok: true, summary: 'Clé acceptée', details, error: null, latencyMs };
    } catch (caught) {
      return fail('Fournisseur injoignable', cleanError(caught), null, details);
    }
  }
};

const emailSendCheck: ApiCheck = {
  id: 'email-send',
  name: 'E-mail — envoi de test',
  description: 'Envoie un vrai message de test à l’adresse indiquée, avec la configuration utilisée par le site.',
  envVars: ['RESEND_API_KEY', 'BREVO_API_KEY', 'EMAIL_PROVIDER', 'EMAIL_FROM'],
  needsRecipient: true,
  async run({ recipient }) {
    const to = recipient?.trim() ?? '';
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) return fail('Adresse invalide', 'Indiquez une adresse e-mail valide.');

    const status = emailStatus();
    const details = [`Fournisseur : ${status.provider}`, `Expéditeur : ${status.from ?? 'non défini'}`, `Destinataire : ${to}`];

    const { value: result, latencyMs } = await timed(() =>
      sendEmail({
        to,
        subject: 'Test d’envoi — administration BDTS',
        text: [
          'Ceci est un message de test envoyé depuis la page « API » de l’administration BDTS.',
          '',
          'Si vous le recevez, l’envoi d’e-mails du site fonctionne.',
          `Envoyé le ${new Date().toLocaleString('fr-BE', { timeZone: 'Europe/Brussels' })}.`
        ].join('\n')
      })
    );

    if (!result.ok) return fail('Envoi refusé', cleanError(result.error), latencyMs, details);
    if (status.provider === 'Console') {
      return fail('Rien n’a été envoyé', 'Fournisseur « console » : le message a seulement été écrit dans les logs du serveur.', latencyMs, details);
    }
    return { ok: true, summary: 'Message accepté par le fournisseur', details: [...details, 'Vérifiez la boîte de réception (et les indésirables).'], error: null, latencyMs };
  }
};

/** The office alert has its own sender path (Resend + INQUIRY_NOTIFY_TO). */
const inquiryAlertCheck: ApiCheck = {
  id: 'inquiry-alert',
  name: 'Alerte au bureau (formulaires)',
  description: 'Vérifie la configuration de l’e-mail envoyé au bureau à chaque demande. Aucun message n’est envoyé.',
  envVars: ['RESEND_API_KEY', 'INQUIRY_NOTIFY_TO', 'INQUIRY_NOTIFY_FROM'],
  async run() {
    const recipients = (process.env.INQUIRY_NOTIFY_TO ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    const from = process.env.INQUIRY_NOTIFY_FROM?.trim() || process.env.EMAIL_FROM?.trim() || 'BDTS Website <onboarding@resend.dev>';
    const details = [`Destinataires : ${recipients.length ? recipients.join(', ') : 'aucun'}`, `Expéditeur : ${from}`];

    const missing = [!has('RESEND_API_KEY') && 'RESEND_API_KEY', !recipients.length && 'INQUIRY_NOTIFY_TO'].filter(Boolean);
    if (missing.length) {
      return fail('Alerte désactivée', `${missing.join(' et ')} ${missing.length > 1 ? 'ne sont pas définis' : 'n’est pas défini'} : les demandes sont enregistrées mais le bureau n’est pas prévenu.`, null, details);
    }
    return { ok: true, summary: 'Configurée', details: [...details, 'Pour un envoi réel, utilisez « E-mail — envoi de test ».'], error: null, latencyMs: null };
  }
};

/** One check per assistant provider, so a backup can be tested before switching. */
function assistantCheck(providerId: string): ApiCheck {
  const provider = ASSISTANT_PROVIDERS[providerId]!;
  return {
    id: `assistant-${provider.id}`,
    name: `Assistant documents — ${provider.name}`,
    description: 'Demande une très courte réponse au modèle configuré (quelques jetons facturés).',
    envVars: [provider.keyEnvVar],
    async run() {
      const assistant = await resolveAssistant();
      const active = assistant.provider.id === provider.id;
      // The admin-chosen model applies to the active provider only.
      const model = active ? assistant.chain[0]! : provider.defaultModel;
      const details = [active ? 'Fournisseur actif' : 'Fournisseur de secours (non actif)', `Modèle : ${model}`];

      const apiKey = process.env[provider.keyEnvVar]?.trim();
      if (!apiKey) return fail('Non configuré', `${provider.keyEnvVar} n’est pas défini.`, null, details);

      try {
        const { value: response, latencyMs } = await timed(() =>
          fetch(provider.chatEndpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'Réponds uniquement par le mot OK.' }],
              max_tokens: 8,
              temperature: 0,
              stream: false,
              ...provider.extraBody
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS * 2)
          })
        );
        if (!response.ok) {
          const reason = response.status === 401 || response.status === 403 ? 'Clé refusée' : 'Requête refusée';
          return fail(reason, await httpError(provider.name, response), latencyMs, details);
        }
        const body = (await response.json().catch(() => ({}))) as { model?: string; choices?: Array<{ message?: { content?: string } }> };
        const answer = body.choices?.[0]?.message?.content?.trim();
        if (body.model && body.model !== model) details.push(`Modèle ayant répondu : ${body.model}`);
        details.push(`Réponse : « ${(answer || '(vide)').slice(0, 60)} »`);
        return { ok: true, summary: 'Le modèle répond', details, error: null, latencyMs };
      } catch (caught) {
        return fail('Fournisseur injoignable', cleanError(caught), null, details);
      }
    }
  };
}

export const API_CHECKS: ApiCheck[] = [
  databaseCheck,
  emailKeyCheck,
  emailSendCheck,
  inquiryAlertCheck,
  ...Object.keys(ASSISTANT_PROVIDERS).map(assistantCheck)
];

export function findCheck(id: string): ApiCheck | undefined {
  return API_CHECKS.find((check) => check.id === id);
}

/** Whether each check's variables are present, for the list (no network). */
export function isCheckConfigured(check: ApiCheck): boolean {
  switch (check.id) {
    case 'database':
      return has('DATABASE_URL');
    case 'email-key':
    case 'email-send':
      return Boolean(emailProvider().apiKeyEnv && has(emailProvider().apiKeyEnv!));
    case 'inquiry-alert':
      return has('RESEND_API_KEY') && has('INQUIRY_NOTIFY_TO');
    default:
      return check.envVars.every(has);
  }
}
