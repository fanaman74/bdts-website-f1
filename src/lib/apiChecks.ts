import { getDbClient } from './db';
import { emailProvider, emailStatus, sendEmail } from './email';
import { customProvider, PROVIDERS as ASSISTANT_PROVIDERS, resolveAssistant, type AssistantProvider } from './assistantProvider';
import { createRateLimiter } from './rateLimit';
import { customApiKey, listCustomApis, type CustomApi } from './customApis';

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
  /** The service is not set up (no key or variable), as opposed to failing. */
  notConfigured?: boolean;
  /** Works, but something needs attention (unverified domain, slow…). */
  warning?: string;
}

/** Traffic-light status: green works, orange needs attention, red fails. */
export type CheckLevel = 'ok' | 'warn' | 'fail';

/** Above this a working service is shown orange rather than green. */
export const SLOW_MS = 3_000;

export function checkLevel(result: CheckResult): CheckLevel {
  if (!result.ok) return result.notConfigured ? 'warn' : 'fail';
  if (result.warning || (result.latencyMs !== null && result.latencyMs > SLOW_MS)) return 'warn';
  return 'ok';
}

export interface ApiCheck {
  id: string;
  name: string;
  description: string;
  /** Environment variables the check relies on, shown by name only. */
  envVars: string[];
  /** True when this check sends a real email and needs a recipient. */
  needsRecipient?: boolean;
  /** The API added from this page that the check tests, when it is one. */
  customApi?: CustomApi;
  run(input: { recipient?: string }): Promise<CheckResult>;
  /**
   * Cheap variant run automatically when the page loads: never sends email
   * and never spends tokens. Defaults to `run` when absent.
   */
  probe?(): Promise<CheckResult>;
}

const TIMEOUT_MS = 15_000;

/** Saving, deleting and paid tests on the API page, capped per admin. */
export const checkApiPageLimit = createRateLimiter([{ windowMs: 60_000, limit: 30 }]);

function has(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

/** Error text safe to show: bounded, with anything key-shaped masked. */
function cleanError(caught: unknown, secret?: string | null): string {
  let message = caught instanceof Error ? caught.message : String(caught);
  if (secret && secret.length >= 6) message = message.split(secret).join('…');
  return message
    .replace(/postgres(ql)?:\/\/[^\s'"]+/gi, 'postgresql://…')
    .replace(/\b(sk|re|xkeysib)[-_][A-Za-z0-9_-]{8,}/g, '$1-…')
    .slice(0, 300);
}

function notConfigured(summary: string, error: string, details: string[] = []): CheckResult {
  return { ok: false, notConfigured: true, summary, details, error, latencyMs: null };
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
async function httpError(service: string, response: Response, secret?: string | null): Promise<string> {
  const body = await response.text().catch(() => '');
  return cleanError(`${service} HTTP ${response.status}${body ? ` : ${body.slice(0, 200)}` : ''}`, secret);
}

const databaseCheck: ApiCheck = {
  id: 'database',
  name: 'Base de données Neon',
  description: 'Exécute une requête de lecture et vérifie que les tables du site existent.',
  envVars: ['DATABASE_URL'],
  async run() {
    if (!has('DATABASE_URL')) return notConfigured('Non configurée', 'DATABASE_URL n’est pas défini.');

    const started = performance.now();
    try {
      const db = getDbClient();
      if (!db) return notConfigured('Non configurée', 'DATABASE_URL n’est pas défini.');

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
      return notConfigured('Aucun fournisseur', 'Aucune clé d’e-mail n’est configurée : les messages sont seulement écrits dans les logs.', details);
    }
    const apiKey = process.env[provider.apiKeyEnv]?.trim();
    if (!apiKey) return notConfigured('Non configurée', `${provider.apiKeyEnv} n’est pas défini.`, details);

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
          return { ok: true, summary: 'Clé acceptée (envoi uniquement)', details, error: null, latencyMs, warning: status.problems[0] };
        }
        return fail('Clé refusée', cleanError(`Resend HTTP 401 : ${body.slice(0, 200)}`), latencyMs, details);
      }
      if (!response.ok) return fail('Clé refusée', await httpError(status.provider, response), latencyMs, details);

      if (provider.id === 'resend') {
        const body = (await response.json().catch(() => ({}))) as { data?: Array<{ name?: string; status?: string }> };
        for (const domain of body.data ?? []) details.push(`Domaine ${domain.name} : ${domain.status}`);
        const unverified = (body.data ?? []).find((domain) => domain.status !== 'verified');
        if (unverified) return { ok: true, summary: 'Clé acceptée', details, error: null, latencyMs, warning: `Domaine ${unverified.name} non vérifié` };
      }
      return { ok: true, summary: 'Clé acceptée', details, error: null, latencyMs, warning: status.problems[0] };
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
  // On page load, prove the key instead of sending anything.
  probe: () => emailKeyCheck.run({}),
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
      return notConfigured('Alerte désactivée', `${missing.join(' et ')} ${missing.length > 1 ? 'ne sont pas définis' : 'n’est pas défini'} : les demandes sont enregistrées mais le bureau n’est pas prévenu.`, details);
    }
    return { ok: true, summary: 'Configurée', details: [...details, 'Pour un envoi réel, utilisez « E-mail — envoi de test ».'], error: null, latencyMs: null };
  }
};

/**
 * One check per assistant provider, built-in or added from this page, so a
 * backup can be tested before switching.
 */
function assistantCheck(provider: AssistantProvider, readKey: () => string | null, customApi?: CustomApi): ApiCheck {
  const missingKey = provider.custom
    ? 'La clé enregistrée ne peut plus être déchiffrée (secret de chiffrement modifié) : saisissez-la à nouveau.'
    : `${provider.keyEnvVar} n’est pas défini.`;
  return {
    id: `assistant-${provider.id.replace(':', '-')}`,
    name: `Assistant documents — ${provider.name}`,
    description: provider.custom
      ? `API ajoutée depuis cette page (${new URL(provider.chatEndpoint).host}). Tester demande une très courte réponse au modèle (quelques jetons facturés).`
      : 'Demande une très courte réponse au modèle configuré (quelques jetons facturés).',
    envVars: provider.custom ? [] : [provider.keyEnvVar],
    customApi,
    // The provider's balance, key or model-list endpoint is authenticated but spends no tokens.
    async probe() {
      const apiKey = readKey();
      if (!apiKey) return notConfigured('Non configuré', missingKey);

      try {
        const { value: response, latencyMs } = await timed(() =>
          fetch(provider.statusEndpoint, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(TIMEOUT_MS) })
        );
        if (response.status === 404 || response.status === 405) {
          return { ok: true, summary: 'Clé présente, non vérifiée', details: [], error: null, latencyMs, warning: 'Cliquez sur Tester pour vérifier le modèle.' };
        }
        if (!response.ok) {
          const reason = response.status === 401 || response.status === 403 ? 'Clé refusée' : 'Requête refusée';
          return fail(reason, await httpError(provider.name, response, apiKey), latencyMs);
        }
        // DeepSeek says whether the balance still covers API calls; OpenRouter
        // reports what is left of the key's spending limit (null = no limit).
        const body = (await response.json().catch(() => ({}))) as { is_available?: boolean; data?: { limit_remaining?: number | null } };
        const remaining = body.data?.limit_remaining;
        if (body.is_available === false || (typeof remaining === 'number' && remaining <= 0)) {
          return { ok: true, summary: 'Clé acceptée', details: [], error: null, latencyMs, warning: 'Crédit épuisé' };
        }
        return { ok: true, summary: 'Clé acceptée', details: [], error: null, latencyMs };
      } catch (caught) {
        return fail('Fournisseur injoignable', cleanError(caught, apiKey));
      }
    },
    async run() {
      const assistant = await resolveAssistant();
      const active = assistant.provider.id === provider.id;
      // The admin-chosen model applies to the active provider only.
      const model = active ? assistant.chain[0]! : provider.defaultModel;
      const details = [active ? 'Fournisseur actif' : 'Fournisseur de secours (non actif)', `Modèle : ${model}`];
      if (customApi?.keyLast4) details.push(`Clé enregistrée : •••• ${customApi.keyLast4}`);

      const apiKey = readKey();
      if (!apiKey) return notConfigured('Non configuré', missingKey, details);

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
          return fail(reason, await httpError(provider.name, response, apiKey), latencyMs, details);
        }
        const body = (await response.json().catch(() => ({}))) as { model?: string; choices?: Array<{ message?: { content?: string } }> };
        const answer = body.choices?.[0]?.message?.content?.trim();
        if (body.model && body.model !== model) details.push(`Modèle ayant répondu : ${body.model}`);
        details.push(`Réponse : « ${(answer || '(vide)').slice(0, 60)} »`);
        return { ok: true, summary: 'Le modèle répond', details, error: null, latencyMs };
      } catch (caught) {
        return fail('Fournisseur injoignable', cleanError(caught, apiKey), null, details);
      }
    }
  };
}

/** Checks that need no database: services and the built-in providers. */
const STATIC_CHECKS: ApiCheck[] = [
  databaseCheck,
  emailKeyCheck,
  emailSendCheck,
  inquiryAlertCheck,
  ...Object.values(ASSISTANT_PROVIDERS).map((provider) => assistantCheck(provider, () => process.env[provider.keyEnvVar]?.trim() || null))
];

/** Every check, including one per API added from the admin area. */
export async function getApiChecks(): Promise<ApiCheck[]> {
  const custom = await listCustomApis();
  return [...STATIC_CHECKS, ...custom.map((api) => assistantCheck(customProvider(api), () => customApiKey(api), api))];
}

const probeCache = new Map<string, { at: number; result: CheckResult }>();
const PROBE_CACHE_MS = 60_000;

/** Forget cached probes, after an API is added, changed or removed. */
export function clearProbeCache(id?: string): void {
  if (id) probeCache.delete(id);
  else probeCache.clear();
}

/**
 * Runs every cheap probe in parallel for the status dots. Each result is
 * cached for a minute so reloading the page does not hammer the providers.
 */
export async function probeAll(checks: ApiCheck[]): Promise<Map<string, CheckResult>> {
  const now = Date.now();
  const outcomes = await Promise.all(
    checks.map(async (check) => {
      const cached = probeCache.get(check.id);
      if (cached && now - cached.at < PROBE_CACHE_MS) return cached.result;
      const result = await (check.probe ? check.probe() : check.run({}));
      probeCache.set(check.id, { at: Date.now(), result });
      return result;
    })
  );
  return new Map(checks.map((check, index) => [check.id, outcomes[index]!]));
}
