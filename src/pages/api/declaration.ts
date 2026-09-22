import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getDbClient, type SqlClient } from '../../lib/db';
import { checkRateLimit, getClientIp, json, rateLimitMessage } from '../../lib/forms';
import { createDeclaration, type AttachmentInput } from '../../lib/declarations';

export const prerender = false;

/** Multipart overhead on top of the attachments we accept below. */
const MAX_CONTENT_LENGTH = 8 * 1024 * 1024;
const MAX_FILES = 3;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 6 * 1024 * 1024;

/**
 * Accepted attachment types, mirroring the BDTS declaration form. The extension
 * map is the fallback for the browsers and phones that send an empty or generic
 * content type for a valid file.
 */
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

/** An optional free-text field: blank inputs become NULL, never ''. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

/** A required free-text field. */
const requiredText = (max: number, label: string) => z.string().trim().min(1, `${label} est requis.`).max(max);

const dateField = z
  .string()
  .trim()
  .max(10)
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), { message: 'Date invalide.' })
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const timeField = z
  .string()
  .trim()
  .max(8)
  .refine((value) => value === '' || /^\d{2}:\d{2}(:\d{2})?$/.test(value), { message: 'Heure invalide.' })
  .optional()
  .transform((value) => (value && value.length > 0 ? (value.length === 5 ? `${value}:00` : value) : null));

/** The title select only ever offers three options ("- Aucun(e) -" being blank). */
const titleField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === 'mr' || value === 'mrs' ? value : null));

/** Yes/no selects (witness, third party) become booleans. */
const presenceField = z
  .string()
  .trim()
  .optional()
  .transform((value) => value === 'yes' || value === 'true' || value === 'on');

const submissionSchema = z.object({
  // Mes informations de contact
  personTitle: titleField,
  lastName: requiredText(120, 'Le nom'),
  firstName: requiredText(120, 'Le prénom'),
  dateOfBirth: dateField,
  street: text(200),
  streetNumber: text(30),
  bus: text(30),
  postalCode: text(20),
  city: text(120),
  country: text(120),
  company: text(200),
  phoneFixed: text(40),
  phoneMobile: text(40),
  email: z.string().trim().email('Adresse e-mail invalide.').max(200),

  // Identification du sinistre
  insuredPersonOrItem: text(500),
  insurancePolicyNumber: text(120),
  incidentDate: dateField,
  incidentTime: timeField,
  incidentPlace: text(500),
  incidentCircumstances: text(8000),

  // Informations sur le témoin
  witnessPresent: presenceField,
  witnessTitle: titleField,
  witnessLastName: text(120),
  witnessFirstName: text(120),
  witnessStreet: text(200),
  witnessStreetNumber: text(30),
  witnessBus: text(30),
  witnessPostalCode: text(20),
  witnessCity: text(120),
  witnessCountry: text(120),
  witnessPhone: text(40),

  // Partie adverse
  counterpartyPresent: presenceField,
  counterpartyTitle: titleField,
  counterpartyLastName: text(120),
  counterpartyFirstName: text(120),
  counterpartyStreet: text(200),
  counterpartyStreetNumber: text(30),
  counterpartyBus: text(30),
  counterpartyPostalCode: text(20),
  counterpartyCity: text(120),
  counterpartyCountry: text(120),
  counterpartyPhone: text(40),
  counterpartyInsuranceCompany: text(200),
  counterpartyInsurancePolicyNumber: text(120),

  // Autres
  remarks: text(8000),

  consent: z.union([z.literal('on'), z.literal('true'), z.literal(true)]),
  // Honeypot — must stay empty. Named after the field BDTS uses.
  url: z.string().max(0).optional().or(z.literal(''))
});

export const POST: APIRoute = async ({ request }) => {
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH) {
    return json(
      { ok: false, error: 'La demande est trop volumineuse. Réduisez le nombre ou la taille des fichiers joints.' },
      413
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'Corps de requête invalide.' }, 400);
  }

  // Honeypot first: bots get a plausible success and no database work happens.
  const honeypot = form.get('url');
  if (typeof honeypot === 'string' && honeypot.length > 0) {
    return json({ ok: true }, 200);
  }

  // Only the scalar fields are validated together; the files are read below.
  const payload: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') payload[key] = value;
  }

  if (payload.consent !== 'on' && payload.consent !== 'true') {
    return json(
      { ok: false, error: 'Champs invalides.', details: { consent: ["L'accord avec la politique de confidentialité est requis."] } },
      422
    );
  }

  const parsed = submissionSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ ok: false, error: 'Champs invalides.', details: parsed.error.flatten().fieldErrors }, 422);
  }

  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`${clientIp}:declaration`);
  if (!rateLimitResult.ok) {
    return json({ ok: false, error: rateLimitMessage(rateLimitResult.retryAfterSeconds) }, 429, {
      'Retry-After': String(rateLimitResult.retryAfterSeconds)
    });
  }

  const files = form.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);
  const attachmentResult = await readAttachments(files);
  if ('error' in attachmentResult) {
    return json({ ok: false, error: attachmentResult.error }, attachmentResult.status);
  }

  let db: SqlClient | null;
  try {
    db = getDbClient();
  } catch (error) {
    console.error('[declaration] Database configuration error:', error instanceof Error ? error.message : 'unknown error');
    return json({ ok: false, error: 'Le service est temporairement indisponible.' }, 503);
  }

  if (!db) {
    console.error('[declaration] DATABASE_URL is not configured.');
    return json({ ok: false, error: 'Le service est temporairement indisponible.' }, 503);
  }

  try {
    const id = await createDeclaration(parsed.data, attachmentResult.attachments);
    if (!id) return json({ ok: false, error: 'Le service est temporairement indisponible.' }, 503);
  } catch (error) {
    console.error('[declaration] Database insert failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ ok: false, error: "Votre déclaration n'a pas pu être enregistrée. Merci de réessayer." }, 502);
  }

  return json({ ok: true }, 200);
};

type AttachmentResult = { attachments: AttachmentInput[] } | { error: string; status: number };

/** Validates and base64-encodes the uploaded files, or explains why not. */
async function readAttachments(files: File[]): Promise<AttachmentResult> {
  if (files.length > MAX_FILES) {
    return { error: `Vous pouvez joindre au maximum ${MAX_FILES} fichiers.`, status: 422 };
  }

  let total = 0;
  const attachments: AttachmentInput[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return { error: `Le fichier « ${file.name} » dépasse 4 Mo.`, status: 413 };
    }

    total += file.size;
    if (total > MAX_TOTAL_BYTES) {
      return { error: 'Les fichiers joints dépassent 6 Mo au total. Merci de les envoyer en plusieurs fois.' , status: 413 };
    }

    const contentType = resolveContentType(file);
    if (!contentType) {
      return {
        error: `Format non autorisé pour « ${file.name} ». Formats acceptés : jpg, jpeg, png, pdf, doc, docx.`,
        status: 415
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    attachments.push({
      filename: file.name.slice(0, 255),
      contentType,
      byteSize: buffer.byteLength,
      contentBase64: buffer.toString('base64')
    });
  }

  return { attachments };
}

/** The declared MIME type when it is one we accept, otherwise the extension. */
function resolveContentType(file: File): string | null {
  const declared = file.type.toLowerCase();
  if (ALLOWED_TYPES.has(declared)) return declared;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[extension] ?? null;
}

