import type { APIRoute } from 'astro';
import { resolveAssistant } from '../../lib/assistantProvider';

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
  const { provider, apiKey, chain } = await resolveAssistant();
  const models = { primary: chain[0] ?? '', fallback: chain[1] ?? '', chain };

  if (!apiKey) {
    return json({ provider: provider.name, keyEnvVar: provider.keyEnvVar, configured: false, apiKeyValid: false, reason: 'missing-key', models });
  }

  try {
    const response = await fetch(provider.statusEndpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      // A provider with no balance endpoint (404/405) is not an invalid key, so
      // report it as unverified rather than accusing the credentials.
      const unsupported = response.status === 404 || response.status === 405;
      return json({
        provider: provider.name,
        keyEnvVar: provider.keyEnvVar,
        configured: true,
        apiKeyValid: !unsupported,
        reason: unsupported
          ? 'unverified'
          : response.status === 401 || response.status === 403 ? 'invalid-key' : `http-${response.status}`,
        models
      });
    }

    // DeepSeek reports whether the balance actually covers API calls.
    let hasCredit: boolean | null = null;
    try {
      const body = (await response.json()) as { is_available?: boolean };
      if (typeof body.is_available === 'boolean') hasCredit = body.is_available;
    } catch {
      // Balance payloads differ per provider; missing detail is not an error.
    }

    return json({ provider: provider.name, keyEnvVar: provider.keyEnvVar, configured: true, apiKeyValid: true, hasCredit, reason: null, models });
  } catch {
    return json({ provider: provider.name, keyEnvVar: provider.keyEnvVar, configured: true, apiKeyValid: false, reason: 'unreachable', models });
  }
};
