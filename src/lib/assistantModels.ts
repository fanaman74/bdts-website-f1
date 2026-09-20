/**
 * Model selection for the document assistant.
 *
 * The OpenRouter account runs in "Only Allow" restriction mode, and its
 * allowlist contains the free-models router. A paid model must therefore never
 * be selected here: the allowlist refuses it, and if it were allowed it would
 * spend credits. Prefer letting OpenRouter choose, then fall back to a named
 * free model.
 */
export const AUTO_MODEL = 'openrouter/free';
export const FREE_FALLBACK_MODEL = 'qwen/qwen3.8-27b:free';

/**
 * Preferred models in order. `OPENROUTER_MODEL` wins when set, so a model can be
 * pinned from Railway without a deploy. Duplicates are removed so a pinned model
 * that equals a default is not attempted twice.
 */
export function resolveModelChain(): string[] {
  const chain: string[] = [];
  for (const candidate of [process.env.OPENROUTER_MODEL?.trim(), AUTO_MODEL, FREE_FALLBACK_MODEL]) {
    if (candidate && !chain.includes(candidate)) chain.push(candidate);
  }
  return chain;
}
