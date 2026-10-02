import { getDbClient } from './db';
import { decryptSecret, encryptSecret } from './secretBox';

/**
 * AI APIs added from the admin area (/admin/api), stored in Neon.
 *
 * Each one is an OpenAI-compatible chat completions endpoint with its own key
 * and model. The key is encrypted at rest (see secretBox) and never sent back
 * to the browser: the admin area only shows its last four characters.
 */
export interface CustomApi {
  id: string;
  name: string;
  chatEndpoint: string;
  model: string;
  keyLast4: string;
  /** Encrypted key, decrypted only on the server when a request is made. */
  apiKeyEncrypted: string;
}

/** Prefix that tells a custom API's provider id from a built-in one. */
export const CUSTOM_PREFIX = 'custom:';

/** Ready-made endpoints offered by the "add an API" form. */
export const API_PRESETS = [
  { name: 'OpenRouter', chatEndpoint: 'https://openrouter.ai/api/v1/chat/completions', model: 'google/gemini-2.5-flash' },
  { name: 'DeepSeek', chatEndpoint: 'https://api.deepseek.com/chat/completions', model: 'deepseek-flash' },
  { name: 'OpenAI', chatEndpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  { name: 'Mistral', chatEndpoint: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' }
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fromRow(row: Record<string, unknown>): CustomApi {
  return {
    id: String(row.id),
    name: String(row.name),
    chatEndpoint: String(row.chat_endpoint),
    model: String(row.model),
    keyLast4: String(row.key_last4 ?? ''),
    apiKeyEncrypted: String(row.api_key_encrypted)
  };
}

/** Every added API, oldest first. Empty when the database is absent or not migrated. */
export async function listCustomApis(): Promise<CustomApi[]> {
  const db = getDbClient();
  if (!db) return [];
  try {
    const rows = await db.query('select * from public.assistant_apis order by created_at');
    return rows.map(fromRow);
  } catch (error) {
    console.error('[custom-apis] Read failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function getCustomApi(id: string): Promise<CustomApi | null> {
  if (!UUID.test(id)) return null;
  const db = getDbClient();
  if (!db) return null;
  try {
    const rows = await db.query('select * from public.assistant_apis where id = $1', [id]);
    return rows[0] ? fromRow(rows[0]) : null;
  } catch (error) {
    console.error('[custom-apis] Read failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** The clear key, or null when it can no longer be decrypted. */
export function customApiKey(api: CustomApi): string | null {
  return decryptSecret(api.apiKeyEncrypted);
}

/** True for hosts a server-side request must never reach (internal network). */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return host.includes(':'); // IPv6 literals: none of the public providers need one.
}

export interface CustomApiInput {
  name: string;
  chatEndpoint: string;
  model: string;
  /** Empty when editing means "keep the saved key". */
  apiKey: string;
}

/** French error message, or null when the input is valid. */
export function validateCustomApi(input: CustomApiInput, requireKey: boolean): string | null {
  if (!input.name || input.name.length > 80) return 'Indiquez un nom (80 caractères maximum).';
  if (!input.model || input.model.length > 200) return 'Indiquez un modèle.';
  let url: URL;
  try {
    url = new URL(input.chatEndpoint);
  } catch {
    return 'L’adresse de l’API est invalide.';
  }
  if (url.protocol !== 'https:') return 'L’adresse de l’API doit commencer par https://.';
  if (input.chatEndpoint.length > 500) return 'L’adresse de l’API est trop longue.';
  if (isPrivateHost(url.hostname)) return 'Cette adresse pointe vers un réseau interne.';
  if (requireKey && !input.apiKey) return 'Indiquez la clé API.';
  if (input.apiKey.length > 500 || /\s/.test(input.apiKey)) return 'La clé API est invalide.';
  return null;
}

/**
 * Accepts a base URL (https://openrouter.ai/api/v1) as well as the full chat
 * completions endpoint, since providers document one or the other.
 */
export function normaliseEndpoint(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return /\/chat\/completions$/.test(trimmed) ? trimmed : `${trimmed}/chat/completions`;
}

export async function createCustomApi(input: CustomApiInput): Promise<string> {
  const db = getDbClient();
  if (!db) throw new Error('La base de données n’est pas configurée.');
  const rows = await db.query(
    `insert into public.assistant_apis (name, chat_endpoint, model, api_key_encrypted, key_last4)
     values ($1, $2, $3, $4, $5) returning id`,
    [input.name, input.chatEndpoint, input.model, encryptSecret(input.apiKey), input.apiKey.slice(-4)]
  );
  return String(rows[0]!.id);
}

export async function updateCustomApi(id: string, input: CustomApiInput): Promise<void> {
  const db = getDbClient();
  if (!db || !UUID.test(id)) return;
  if (input.apiKey) {
    await db.query(
      `update public.assistant_apis
       set name = $2, chat_endpoint = $3, model = $4, api_key_encrypted = $5, key_last4 = $6, updated_at = now()
       where id = $1`,
      [id, input.name, input.chatEndpoint, input.model, encryptSecret(input.apiKey), input.apiKey.slice(-4)]
    );
  } else {
    await db.query(
      'update public.assistant_apis set name = $2, chat_endpoint = $3, model = $4, updated_at = now() where id = $1',
      [id, input.name, input.chatEndpoint, input.model]
    );
  }
}

export async function deleteCustomApi(id: string): Promise<void> {
  const db = getDbClient();
  if (!db || !UUID.test(id)) return;
  await db.query('delete from public.assistant_apis where id = $1', [id]);
}

/**
 * Authenticated endpoint that proves a key without spending tokens: OpenRouter
 * describes the key, DeepSeek reports the balance, and other OpenAI-compatible
 * APIs list their models next to the chat endpoint.
 */
export function statusEndpointFor(chatEndpoint: string): string {
  const url = new URL(chatEndpoint);
  if (url.hostname === 'openrouter.ai') return 'https://openrouter.ai/api/v1/key';
  if (url.hostname === 'api.deepseek.com') return 'https://api.deepseek.com/user/balance';
  return chatEndpoint.replace(/\/chat\/completions$/, '/models');
}

/** Key and model entered in /admin/api for a built-in provider. */
export interface ProviderCredential {
  providerId: string;
  apiKeyEncrypted: string | null;
  keyLast4: string;
  model: string | null;
}

/** Saved credentials of the built-in providers, by provider id. */
export async function listProviderCredentials(): Promise<Map<string, ProviderCredential>> {
  const db = getDbClient();
  const credentials = new Map<string, ProviderCredential>();
  if (!db) return credentials;
  try {
    const rows = await db.query('select * from public.provider_credentials');
    for (const row of rows) {
      credentials.set(String(row.provider_id), {
        providerId: String(row.provider_id),
        apiKeyEncrypted: row.api_key_encrypted ? String(row.api_key_encrypted) : null,
        keyLast4: String(row.key_last4 ?? ''),
        model: row.model ? String(row.model) : null
      });
    }
  } catch (error) {
    console.error('[provider-credentials] Read failed:', error instanceof Error ? error.message : error);
  }
  return credentials;
}

/** Saves the model and, when given, a new key. An empty key keeps the saved one. */
export async function saveProviderCredential(providerId: string, model: string, apiKey: string): Promise<void> {
  const db = getDbClient();
  if (!db) throw new Error('La base de données n’est pas configurée.');
  if (apiKey) {
    await db.query(
      `insert into public.provider_credentials (provider_id, api_key_encrypted, key_last4, model, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (provider_id) do update
       set api_key_encrypted = excluded.api_key_encrypted, key_last4 = excluded.key_last4, model = excluded.model, updated_at = now()`,
      [providerId, encryptSecret(apiKey), apiKey.slice(-4), model || null]
    );
  } else {
    await db.query(
      `insert into public.provider_credentials (provider_id, model, updated_at) values ($1, $2, now())
       on conflict (provider_id) do update set model = excluded.model, updated_at = now()`,
      [providerId, model || null]
    );
  }
}

/** Forgets the saved key, so the provider's Railway variable applies again. */
export async function clearProviderKey(providerId: string): Promise<void> {
  const db = getDbClient();
  if (!db) return;
  await db.query(
    `update public.provider_credentials set api_key_encrypted = null, key_last4 = '', updated_at = now() where provider_id = $1`,
    [providerId]
  );
}
