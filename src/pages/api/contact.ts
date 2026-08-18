import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getSupabaseAdminClient } from '../../lib/supabaseServer';

export const prerender = false;

const MAX_CONTENT_LENGTH = 25_000;
const BURST_WINDOW_MS = 60_000;
const BURST_LIMIT = 3;
const WINDOW_MS = 15 * 60_000;
const WINDOW_LIMIT = 8;
const rateLimitHits = new Map<string, number[]>();

const submissionSchema = z.object({
  formType: z.enum(['contact', 'devis', 'declaration']),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(6).max(30),
  message: z.string().trim().min(10).max(5000),
  consent: z.union([z.literal('on'), z.literal('true'), z.literal(true)]),
  // Honeypot — must stay empty
  website: z.string().max(0).optional().or(z.literal(''))
});

export const POST: APIRoute = async ({ request }) => {
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH) {
    return json({ ok: false, error: 'Corps de requête trop volumineux.' }, 413);
  }

  let payload: unknown;
  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else {
      payload = Object.fromEntries(await request.formData());
    }
  } catch {
    return json({ ok: false, error: 'Corps de requête invalide.' }, 400);
  }

  const parsed = submissionSchema.safeParse(payload);
  if (!parsed.success) {
    // Honeypot hits get a fake success so bots learn nothing
    const p = payload as Record<string, unknown>;
    if (typeof p?.website === 'string' && p.website.length > 0) {
      return json({ ok: true }, 200);
    }
    return json({ ok: false, error: 'Champs invalides.', details: parsed.error.flatten().fieldErrors }, 422);
  }

  const { formType, name, email, phone, message } = parsed.data;
  const clientIp = getClientIp(request);
  const rateLimitKey = `${clientIp}:${formType}`;
  const rateLimitResult = checkRateLimit(rateLimitKey);

  if (!rateLimitResult.ok) {
    return json(
      {
        ok: false,
        error:
          rateLimitResult.retryAfterSeconds > 60
            ? 'Trop de demandes en peu de temps. Merci de réessayer dans quelques minutes.'
            : 'Trop de demandes en peu de temps. Merci de patienter un instant avant de recommencer.'
      },
      429,
      {
        'Retry-After': String(rateLimitResult.retryAfterSeconds)
      }
    );
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    console.error('[contact] Supabase configuration error:', error instanceof Error ? error.message : 'unknown error');
    return json({ ok: false, error: 'Le service est temporairement indisponible.' }, 503);
  }

  if (!supabase) {
    console.error('[contact] Supabase is not configured.');
    return json({ ok: false, error: 'Le service est temporairement indisponible.' }, 503);
  }

  const { error: insertError } = await supabase.from('inquiries').insert({
    form_type: formType,
    name,
    email,
    phone,
    message
  });

  if (insertError) {
    console.error('[contact] Supabase insert failed:', {
      code: insertError.code,
      message: insertError.message
    });
    return json({ ok: false, error: "Votre demande n'a pas pu être enregistrée. Merci de réessayer." }, 502);
  }

  return json({ ok: true }, 200);
};

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
}

function checkRateLimit(key: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
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
