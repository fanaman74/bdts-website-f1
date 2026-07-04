import type { APIRoute } from 'astro';
import { z } from 'astro/zod';

export const prerender = false;

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

  // Dispatch point: wire to an email provider (Resend, SMTP…) or CRM here.
  // Secrets belong in environment variables, never in client code.
  console.info(
    `[contact] ${new Date().toISOString()} type=${formType} name=${JSON.stringify(name)} email=${email} phone=${phone} message=${JSON.stringify(message.slice(0, 200))}`
  );

  return json({ ok: true }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
