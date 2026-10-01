/**
 * Helpers shared by the public form endpoints (contact and declaration).
 *
 * The rate limiter is deliberately in-process rather than in Postgres: it is a
 * cheap first line of defence against scripted bursts, not an audit trail. The
 * keys include the form type, so a visitor who files a claim can still send a
 * contact message.
 */

/** JSON response with the no-store header every form endpoint needs. */
export function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

/** The visitor's address as seen through Railway's proxy. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
}

const BURST_WINDOW_MS = 60_000;
const BURST_LIMIT = 3;
const WINDOW_MS = 15 * 60_000;
const WINDOW_LIMIT = 8;
const rateLimitHits = new Map<string, number[]>();

export function checkRateLimit(key: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const timestamps = (rateLimitHits.get(key) ?? []).filter((ts) => now - ts < WINDOW_MS);

  const burstHits = timestamps.filter((ts) => now - ts < BURST_WINDOW_MS);
  if (burstHits.length >= BURST_LIMIT) {
    const oldestBurst = burstHits[0]!;
    const retryAfterSeconds = Math.max(1, Math.ceil((BURST_WINDOW_MS - (now - oldestBurst)) / 1000));
    rateLimitHits.set(key, timestamps);
    return { ok: false, retryAfterSeconds };
  }

  if (timestamps.length >= WINDOW_LIMIT) {
    const oldestWindow = timestamps[0]!;
    const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - oldestWindow)) / 1000));
    rateLimitHits.set(key, timestamps);
    return { ok: false, retryAfterSeconds };
  }

  timestamps.push(now);
  rateLimitHits.set(key, timestamps);
  return { ok: true };
}

/** French message shown when the rate limit is hit. */
export function rateLimitMessage(retryAfterSeconds: number): string {
  return retryAfterSeconds > 60
    ? 'Trop de demandes en peu de temps. Merci de réessayer dans quelques minutes.'
    : 'Trop de demandes en peu de temps. Merci de patienter un instant avant de recommencer.';
}
