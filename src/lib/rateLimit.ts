// In-memory sliding-window limiter. State lives in the Node process, which is
// enough for the single Railway instance; move to a shared store if scaled out.

export interface RateLimitRule {
  windowMs: number;
  limit: number;
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function createRateLimiter(rules: RateLimitRule[]) {
  const hits = new Map<string, number[]>();
  const longestWindow = Math.max(...rules.map((rule) => rule.windowMs));

  return function check(key: string): RateLimitResult {
    const now = Date.now();
    const timestamps = (hits.get(key) ?? []).filter((ts) => now - ts < longestWindow);

    for (const rule of rules) {
      const inWindow = timestamps.filter((ts) => now - ts < rule.windowMs);
      if (inWindow.length >= rule.limit) {
        hits.set(key, timestamps);
        const retryAfterSeconds = Math.max(1, Math.ceil((rule.windowMs - (now - inWindow[0]!)) / 1000));
        return { ok: false, retryAfterSeconds };
      }
    }

    timestamps.push(now);
    hits.set(key, timestamps);
    if (hits.size > 10_000) pruneStale(hits, now, longestWindow);
    return { ok: true };
  };
}

function pruneStale(hits: Map<string, number[]>, now: number, windowMs: number) {
  for (const [key, timestamps] of hits) {
    if (!timestamps.some((ts) => now - ts < windowMs)) hits.delete(key);
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
}
