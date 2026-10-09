import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { saveCustomerInfo } from '../../lib/claimTimeline';

export const prerender = false;

/**
 * The form on /claim/complement/[token]. It is a plain HTML form, so the
 * response is a redirect back to the same page rather than JSON.
 */
const schema = z.object({
  token: z.string().trim().min(20).max(100),
  policy: z.string().trim().max(120).optional().default(''),
  date: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Date invalide.')
    .optional()
    .default(''),
  place: z.string().trim().max(500).optional().default(''),
  circumstances: z.string().trim().max(8000).optional().default(''),
  details: z.string().trim().max(4000).optional().default('')
});

const back = (token: string, query: string) => new Response(null, { status: 303, headers: { Location: `/claim/complement/${token}${query}` } });

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return new Response('Requête invalide.', { status: 400 });

  // Honeypot: bots fill the hidden field, and get the same success page.
  if (String(form.get('website') ?? '') !== '') return back(String(form.get('token') ?? ''), '?sent=1');

  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return back(String(form.get('token') ?? ''), '?error=1');

  const { token, ...input } = parsed.data;
  const saved = await saveCustomerInfo(token, input).catch((error: unknown) => {
    console.error('[claim-complement] Save failed:', error instanceof Error ? error.message : 'unknown error');
    return false;
  });

  return back(token, saved ? '?sent=1' : '?expired=1');
};
