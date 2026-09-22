import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getDbClient, type SqlClient } from '../../lib/db';
import { checkRateLimit, getClientIp, json, rateLimitMessage } from '../../lib/forms';

export const prerender = false;

const MAX_CONTENT_LENGTH = 25_000;

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
    return json({ ok: false, error: rateLimitMessage(rateLimitResult.retryAfterSeconds) }, 429, {
      'Retry-After': String(rateLimitResult.retryAfterSeconds)
    });
  }

  let db: SqlClient | null;
  try {
    db = getDbClient();
  } catch (error) {
    console.error('[contact] Database configuration error:', error instanceof Error ? error.message : 'unknown error');
    return json({ ok: false, error: 'Le service est temporairement indisponible.' }, 503);
  }

  if (!db) {
    console.error('[contact] DATABASE_URL is not configured.');
    return json({ ok: false, error: 'Le service est temporairement indisponible.' }, 503);
  }

  try {
    await db.query(
      `insert into public.inquiries (form_type, name, email, phone, message)
       values ($1, $2, $3, $4, $5)`,
      [formType, name, email, phone, message]
    );
  } catch (error) {
    console.error('[contact] Database insert failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ ok: false, error: "Votre demande n'a pas pu être enregistrée. Merci de réessayer." }, 502);
  }

  return json({ ok: true }, 200);
};
