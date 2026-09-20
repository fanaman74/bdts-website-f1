import type { APIRoute } from 'astro';
import { BALANCE_ENDPOINT, FALLBACK_MODEL, PRIMARY_MODEL, PROVIDER_NAME, resolveModelChain } from '../../lib/assistantProvider';

export const prerender = false;

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

/**
 * Reports whether the document assistant can reach its provider, for the status
 * box in the chat drawer. The API key is never returned, only whether the
 * provider accepted it. Routera's GET /balance is authenticated and spends no
 * tokens, so it proves the key without generating anything.
 */
export const GET: APIRoute = async () => {
  const apiKey = process.env.ROUTERA_API_KEY?.trim();
  const pinned = Boolean(process.env.ROUTERA_MODEL?.trim());
  const models = { primary: PRIMARY_MODEL, fallback: FALLBACK_MODEL, chain: resolveModelChain() };

  if (!apiKey) {
    return json({ provider: PROVIDER_NAME, configured: false, apiKeyValid: false, reason: 'missing-key', pinned, models });
  }

  try {
    const response = await fetch(BALANCE_ENDPOINT, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      return json({
        provider: PROVIDER_NAME,
        configured: true,
        apiKeyValid: false,
        reason: response.status === 401 || response.status === 403 ? 'invalid-key' : `http-${response.status}`,
        pinned,
        models
      });
    }

    return json({ provider: PROVIDER_NAME, configured: true, apiKeyValid: true, reason: null, pinned, models });
  } catch {
    return json({ provider: PROVIDER_NAME, configured: true, apiKeyValid: false, reason: 'unreachable', pinned, models });
  }
};
