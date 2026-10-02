import type { AssistantProvider } from './assistantProvider';

/** One choice in the admin model list. */
export interface ModelOption {
  id: string;
  label: string;
}

const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { at: number; models: ModelOption[] }>();

/** OpenRouter prices are in dollars per token; shown per million tokens. */
function openRouterLabel(model: { id: string; name?: string; pricing?: { prompt?: string; completion?: string } }): string {
  const prompt = Number(model.pricing?.prompt ?? NaN);
  const completion = Number(model.pricing?.completion ?? NaN);
  const name = model.name && model.name !== model.id ? ` · ${model.name}` : '';
  if (prompt === 0 && completion === 0) return `${model.id}${name} · gratuit`;
  if (Number.isFinite(prompt) && Number.isFinite(completion)) {
    const perMillion = (value: number) => `$${(value * 1e6).toFixed(2)}`;
    return `${model.id}${name} · ${perMillion(prompt)} / ${perMillion(completion)} par M jetons`;
  }
  return `${model.id}${name}`;
}

/**
 * The models a provider offers, for the admin model picker. OpenRouter's list
 * is public; other OpenAI-compatible APIs list theirs at /models with the key.
 * Null when the list cannot be fetched (the picker then falls back to free text).
 */
export async function listModels(provider: AssistantProvider, apiKey: string | null): Promise<ModelOption[] | null> {
  const isOpenRouter = new URL(provider.chatEndpoint).hostname === 'openrouter.ai';
  const url = isOpenRouter ? 'https://openrouter.ai/api/v1/models' : provider.chatEndpoint.replace(/\/chat\/completions$/, '/models');
  if (!isOpenRouter && !apiKey) return null;

  const cacheKey = `${url}|${isOpenRouter ? '' : apiKey}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.models;

  try {
    const response = await fetch(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: Array<{ id?: string; name?: string; pricing?: { prompt?: string; completion?: string } }> };
    const models = (body.data ?? [])
      .filter((model): model is { id: string; name?: string; pricing?: { prompt?: string; completion?: string } } => typeof model.id === 'string' && model.id.length > 0)
      .map((model) => ({ id: model.id, label: isOpenRouter ? openRouterLabel(model) : model.id }))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!models.length) return null;
    cache.set(cacheKey, { at: Date.now(), models });
    return models;
  } catch {
    return null;
  }
}
