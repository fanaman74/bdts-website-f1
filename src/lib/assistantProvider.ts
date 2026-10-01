import { getSettings } from './settings';

/**
 * Provider configuration for the document assistant.
 *
 * Both supported providers speak the OpenAI-compatible chat completions shape
 * (`choices[0].delta.content` deltas terminated by `data: [DONE]`), so the SSE
 * parser in `/api/document-chat` is provider-neutral and swapping providers is a
 * configuration change rather than a rewrite.
 *
 * API keys live in environment variables, never in the database: the admin area
 * stores only the provider id and the model name.
 */
export interface AssistantProvider {
  id: string;
  name: string;
  chatEndpoint: string;
  /** Environment variable holding this provider's API key. */
  keyEnvVar: string;
  /** Used when the admin has not pinned a model. */
  defaultModel: string;
  /** Tried in order when the configured model is refused. */
  fallbackModels: string[];
  /** Authenticated but token-free endpoint used to prove the key works. */
  statusEndpoint: string;
  /** Extra request body fields this provider needs. */
  extraBody?: Record<string, unknown>;
}

export const PROVIDERS: Record<string, AssistantProvider> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    chatEndpoint: 'https://api.deepseek.com/chat/completions',
    keyEnvVar: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-flash',
    fallbackModels: ['deepseek-v4-pro'],
    statusEndpoint: 'https://api.deepseek.com/user/balance',
    // Thinking mode is on by default at high effort. It adds latency and bills
    // the chain of thought as output tokens, while this assistant reads answers
    // out of a supplied document rather than reasoning from scratch.
    extraBody: { thinking: { type: 'disabled' } }
  },
  routera: {
    id: 'routera',
    name: 'Routera',
    chatEndpoint: 'https://api.routera.one/v1/chat/completions',
    keyEnvVar: 'ROUTERA_API_KEY',
    defaultModel: 'openai/gpt-5.6-luna',
    fallbackModels: ['qwen/qwen3.5-27b'],
    statusEndpoint: 'https://api.routera.one/v1/balance'
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

/** Reads the active provider and model from the admin-editable settings. */
export async function resolveAssistant(): Promise<ResolvedAssistant> {
  const settings = await getSettings();
  const provider = PROVIDERS[settings.assistant_provider] ?? PROVIDERS[DEFAULT_PROVIDER_ID]!;

  const apiKey = process.env[provider.keyEnvVar]?.trim() || null;

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
