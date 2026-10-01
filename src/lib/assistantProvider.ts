import { CUSTOM_PREFIX, customApiKey, getCustomApi, listCustomApis, statusEndpointFor, type CustomApi } from './customApis';
import { getSettings } from './settings';

/**
 * Provider configuration for the document assistant.
 *
 * Both supported providers speak the OpenAI-compatible chat completions shape
 * (`choices[0].delta.content` deltas terminated by `data: [DONE]`), so the SSE
 * parser in `/api/document-chat` is provider-neutral and swapping providers is a
 * configuration change rather than a rewrite.
 *
 * Built-in providers read their key from an environment variable. APIs added
 * from /admin/api keep theirs encrypted in the database (see customApis).
 */
export interface AssistantProvider {
  id: string;
  name: string;
  chatEndpoint: string;
  /** Environment variable holding this provider's API key; empty for an added API. */
  keyEnvVar: string;
  /** Where the key is set, for messages ("OPENROUTER_API_KEY dans Railway"). */
  keyHint: string;
  /** Added from /admin/api rather than built in. */
  custom?: boolean;
  /** Used when the admin has not pinned a model. */
  defaultModel: string;
  /** Tried in order when the configured model is refused. */
  fallbackModels: string[];
  /** Authenticated but token-free endpoint used to prove the key works. */
  statusEndpoint: string;
  /** Extra request body fields this provider needs. */
  extraBody?: Record<string, unknown>;
}

// DeepSeek's thinking mode is on by default at high effort. It adds latency and
// bills the chain of thought as output tokens, while this assistant reads
// answers out of a supplied document rather than reasoning from scratch.
const DEEPSEEK_EXTRA_BODY = { thinking: { type: 'disabled' } };

/** Providers configured through Railway variables. */
export const PROVIDERS: Record<string, AssistantProvider> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    chatEndpoint: 'https://api.deepseek.com/chat/completions',
    keyEnvVar: 'DEEPSEEK_API_KEY',
    keyHint: 'DEEPSEEK_API_KEY dans Railway',
    defaultModel: 'deepseek-flash',
    fallbackModels: ['deepseek-v4-pro'],
    statusEndpoint: 'https://api.deepseek.com/user/balance',
    extraBody: DEEPSEEK_EXTRA_BODY
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    chatEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    keyEnvVar: 'OPENROUTER_API_KEY',
    keyHint: 'OPENROUTER_API_KEY dans Railway',
    defaultModel: 'google/gemini-2.5-flash',
    fallbackModels: ['openai/gpt-4o-mini', 'deepseek/deepseek-chat'],
    // Describes the key (usage, remaining limit) without spending tokens.
    statusEndpoint: 'https://openrouter.ai/api/v1/key'
  }
};

export const DEFAULT_PROVIDER_ID = 'deepseek';

export interface ResolvedAssistant {
  provider: AssistantProvider;
  /** Null when the provider's key is not configured. */
  apiKey: string | null;
  /** Models to try, in order. */
  chain: string[];
}

/** An API added from /admin/api, seen as a provider. */
export function customProvider(api: CustomApi): AssistantProvider {
  const host = new URL(api.chatEndpoint).hostname;
  return {
    id: `${CUSTOM_PREFIX}${api.id}`,
    name: api.name,
    chatEndpoint: api.chatEndpoint,
    keyEnvVar: '',
    keyHint: `la clé de « ${api.name} » dans Administration → API`,
    custom: true,
    defaultModel: api.model,
    fallbackModels: [],
    statusEndpoint: statusEndpointFor(api.chatEndpoint),
    extraBody: host === 'api.deepseek.com' ? DEEPSEEK_EXTRA_BODY : undefined
  };
}

/** Built-in providers followed by the APIs added from the admin area. */
export async function listProviders(): Promise<AssistantProvider[]> {
  const custom = await listCustomApis();
  return [...Object.values(PROVIDERS), ...custom.map(customProvider)];
}

/** A provider by id with its key, built-in or added; null when unknown. */
export async function findProvider(id: string): Promise<{ provider: AssistantProvider; apiKey: string | null } | null> {
  const builtIn = PROVIDERS[id];
  if (builtIn) return { provider: builtIn, apiKey: process.env[builtIn.keyEnvVar]?.trim() || null };
  if (!id.startsWith(CUSTOM_PREFIX)) return null;
  const api = await getCustomApi(id.slice(CUSTOM_PREFIX.length));
  return api ? { provider: customProvider(api), apiKey: customApiKey(api) } : null;
}

/** Reads the active provider and model from the admin-editable settings. */
export async function resolveAssistant(): Promise<ResolvedAssistant> {
  const settings = await getSettings();
  const found = await findProvider(settings.assistant_provider);
  if (!found) {
    // A provider that no longer exists: its saved model means nothing to the
    // default provider, so use that provider's own models.
    const fallback = PROVIDERS[DEFAULT_PROVIDER_ID]!;
    return {
      provider: fallback,
      apiKey: process.env[fallback.keyEnvVar]?.trim() || null,
      chain: [fallback.defaultModel, ...fallback.fallbackModels]
    };
  }

  const { provider, apiKey } = found;
  const chain: string[] = [];
  for (const candidate of [settings.assistant_model, provider.defaultModel, ...provider.fallbackModels]) {
    const model = candidate?.trim();
    if (model && !chain.includes(model)) chain.push(model);
  }

  return { provider, apiKey, chain };
}

/** Chat completion request body, including any provider-specific extras. */
export function completionBody(provider: AssistantProvider, model: string, messages: unknown[]): string {
  return JSON.stringify({
    model,
    messages,
    max_tokens: 1_024,
    temperature: 0.2,
    stream: true,
    ...provider.extraBody
  });
}
