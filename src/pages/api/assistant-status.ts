import type { APIRoute } from 'astro';
import { AUTO_MODEL, FREE_FALLBACK_MODEL, resolveModelChain } from '../../lib/assistantModels';

export const prerender = false;

const KEY_ENDPOINT = 'https://openrouter.ai/api/v1/key';

interface KeyInfo {
  label?: string;
  usage?: number;
  limit?: number | null;
  is_free_tier?: boolean;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

/**
 * Reports whether the document assistant can reach OpenRouter, for the status
 * box in the chat drawer. The API key is never returned, only whether the
 * provider accepted it. `GET /api/v1/key` is a cheap authenticated call that
 * needs no completion and spends no credits.
 */
export const GET: APIRoute = async () => {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const pinned = Boolean(process.env.OPENROUTER_MODEL?.trim());
  const models = { auto: AUTO_MODEL, fallback: FREE_FALLBACK_MODEL, chain: resolveModelChain() };

  if (!apiKey) {
    return json({ configured: false, apiKeyValid: false, reason: 'missing-key', pinned, models });
  }

  try {
    const response = await fetch(KEY_ENDPOINT, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      return json({
        configured: true,
        apiKeyValid: false,
        reason: response.status === 401 || response.status === 403 ? 'invalid-key' : `http-${response.status}`,
        pinned,
        models
      });
    }

    const body = (await response.json()) as { data?: KeyInfo };
    return json({
      configured: true,
      apiKeyValid: true,
      reason: null,
      pinned,
      freeTier: body.data?.is_free_tier ?? null,
      usage: body.data?.usage ?? null,
      limit: body.data?.limit ?? null,
      models
    });
  } catch {
    return json({ configured: true, apiKeyValid: false, reason: 'unreachable', pinned, models });
  }
};
