/**
 * Provider configuration for the document assistant.
 *
 * Routera exposes an OpenAI-compatible surface, so the SSE parser in
 * `/api/document-chat` stays provider-neutral: `choices[0].delta.content`
 * deltas terminated by `data: [DONE]`. Changing provider again means editing
 * this file plus the user-facing strings in the two routes.
 *
 * Routera has no free tier: usage is billed per token, so the model picks below
 * are deliberately the cheapest capable streaming options. Document questions
 * are input-heavy (up to 80 000 characters of extracted PDF text, roughly
 * 30 000 tokens), so the input price dominates the cost of an answer.
 */
export const PROVIDER_NAME = 'Routera';

export const CHAT_ENDPOINT = 'https://api.routera.one/v1/chat/completions';

/** Authenticated, token-free call used to prove the API key works. */
export const BALANCE_ENDPOINT = 'https://api.routera.one/v1/balance';

export const PRIMARY_MODEL = 'openai/gpt-5.6-luna';
export const FALLBACK_MODEL = 'qwen/qwen3.5-27b';

/**
 * Preferred models in order. `ROUTERA_MODEL` wins when set, so a model can be
 * pinned from Railway without a deploy. Duplicates are removed so a pinned
 * model that equals a default is not attempted twice.
 *
 * Note that Routera grants model access per plan: the fallback only works if the
 * plan covers it (the pay-as-you-go bundle covers every model).
 */
export function resolveModelChain(): string[] {
  const chain: string[] = [];
  for (const candidate of [process.env.ROUTERA_MODEL?.trim(), PRIMARY_MODEL, FALLBACK_MODEL]) {
    if (candidate && !chain.includes(candidate)) chain.push(candidate);
  }
  return chain;
}
