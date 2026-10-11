import { getDbClient } from './db';
import {
  DECLARATION_STATUSES,
  listDeclarationForwards,
  toIsoTimestamp,
  updateDeclarationStatus,
  type Declaration,
  type DeclarationStatus
} from './declarations';
import { declarationReference } from './declarationSummary';
import { buildStatusEmail, CUSTOMER_NOTIFIED_STATUSES } from './declarationStatusEmail';
import { emailProvider, isEmailConfigured, sendEmail } from './email';
import { getForwardSettings, parseEmailList } from './insurers';
import {
  buildInfoRequestEmail,
  fillableItems,
  hashInfoRequestToken,
  infoRequestPath,
  INFO_REQUEST_TTL_DAYS,
  itemLabel,
  newInfoRequestToken,
  type FillableItem
} from './infoRequest';
import { toDeclarationLanguage, type DeclarationLanguage } from './declarationI18n';

/**
 * The follow-up of a claim in /admin: who handles it, the notes staff leave on
 * it, and every status change, with the customer told when their claim moves.
 */

export interface TimelineEntry {
  id: string;
  kind: 'created' | 'note' | 'status' | 'assignment' | 'forward' | 'info_request' | 'customer_info';
  at: string;
  author: string | null;
  body: string | null;
  fromStatus: DeclarationStatus | null;
  toStatus: DeclarationStatus | null;
  assignedTo: string | null;
  /** null when no customer email was attempted. */
  customerNotified: boolean | null;
  customerEmailError: string | null;
  /** Forward entries only. */
  forward?: { insurer: string; to: string; ok: boolean; error: string | null };
}

const asStatus = (value: unknown): DeclarationStatus | null =>
  typeof value === 'string' && (DECLARATION_STATUSES as readonly string[]).includes(value) ? (value as DeclarationStatus) : null;

async function logEvent(event: {
  declarationId: string;
  kind: 'note' | 'status' | 'assignment' | 'info_request' | 'customer_info';
  body?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  assignedTo?: string | null;
  author: string | null;
  customerNotified?: boolean | null;
  customerEmailError?: string | null;
}): Promise<void> {
  const db = getDbClient();
  if (!db) return;
  await db.query(
    `insert into public.declaration_events
       (declaration_id, kind, body, from_status, to_status, assigned_to, author, customer_notified, customer_email_error)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      event.declarationId,
      event.kind,
      event.body?.slice(0, 4000) || null,
      event.fromStatus ?? null,
      event.toStatus ?? null,
      event.assignedTo?.slice(0, 120) || null,
      event.author?.slice(0, 200) ?? null,
      event.customerNotified ?? null,
      event.customerEmailError?.slice(0, 500) ?? null
    ]
  );
}

export async function addNote(declarationId: string, body: string, author: string | null): Promise<boolean> {
  const text = body.trim();
  if (!text) return false;
  await logEvent({ declarationId, kind: 'note', body: text, author });
  return true;
}

export async function assignDeclaration(declaration: Declaration, assignee: string, author: string | null): Promise<void> {
  const db = getDbClient();
  if (!db) return;
  const next = assignee.trim().slice(0, 120) || null;
  if (next === declaration.assignedTo) return;
  await db.query('update public.declarations set assigned_to = $1 where id = $2', [next, declaration.id]);
  await logEvent({ declarationId: declaration.id, kind: 'assignment', assignedTo: next, author });
}

export type StatusChangeResult =
  | { changed: false }
  | { changed: true; customerNotified: boolean | null; customerEmailError: string | null };

/**
 * Moves a claim to a new status, logs it, and emails the customer when the
 * new status is one they are told about (unless `notify` is false).
 */
export async function changeDeclarationStatus(
  declaration: Pick<Declaration, 'id' | 'status' | 'email' | 'firstName' | 'language'>,
  status: string,
  options: { author: string | null; notify: boolean; message?: string | null }
): Promise<StatusChangeResult> {
  const next = asStatus(status);
  if (!next || next === declaration.status) return { changed: false };

  await updateDeclarationStatus(declaration.id, next);

  let customerNotified: boolean | null = null;
  let customerEmailError: string | null = null;
  const message = options.message?.trim().slice(0, 2000) || null;

  if (options.notify && CUSTOMER_NOTIFIED_STATUSES.has(next)) {
    const provider = emailProvider();
    if (provider.id === 'console' || !isEmailConfigured() || !process.env.EMAIL_FROM?.trim()) {
      customerNotified = false;
      customerEmailError =
        provider.id === 'console'
          ? 'Le fournisseur console n’envoie pas réellement d’e-mail.'
          : 'Aucun fournisseur d’e-mail ou EMAIL_FROM configuré.';
    } else {
      const { replyTo } = await getForwardSettings();
      const result = await sendEmail(
        buildStatusEmail({
          to: declaration.email,
          firstName: declaration.firstName,
          reference: declarationReference(declaration.id),
          status: next as 'in_progress' | 'closed',
          language: declaration.language,
          message,
          replyTo: replyTo ? parseEmailList(replyTo, 1)?.[0] : undefined
        })
      );
      customerNotified = result.ok;
      customerEmailError = result.ok ? null : result.error;
    }
  }

  try {
    await logEvent({
      declarationId: declaration.id,
      kind: 'status',
      body: customerNotified ? message : null,
      fromStatus: declaration.status,
      toStatus: next,
      author: options.author,
      customerNotified,
      customerEmailError
    });
  } catch (error) {
    // The status did change; a missing history line must not hide that.
    console.error('[timeline] Event write failed:', error instanceof Error ? error.message : error);
  }

  return { changed: true, customerNotified, customerEmailError };
}

/** Everything that happened on a claim, newest first. */
export async function listTimeline(declaration: Declaration): Promise<TimelineEntry[]> {
  const db = getDbClient();
  const entries: TimelineEntry[] = [
    {
      id: `created-${declaration.id}`,
      kind: 'created',
      at: declaration.createdAt,
      author: null,
      body: null,
      fromStatus: null,
      toStatus: null,
      assignedTo: null,
      customerNotified: null,
      customerEmailError: null
    }
  ];

  if (db) {
    try {
      const rows = await db.query(
        `select id, kind, body, from_status, to_status, assigned_to, author, customer_notified, customer_email_error, created_at
           from public.declaration_events
          where declaration_id = $1`,
        [declaration.id]
      );
      for (const row of rows) {
        entries.push({
          id: String(row.id),
          kind: String(row.kind) as TimelineEntry['kind'],
          at: toIsoTimestamp(row.created_at),
          author: row.author ? String(row.author) : null,
          body: row.body ? String(row.body) : null,
          fromStatus: asStatus(row.from_status),
          toStatus: asStatus(row.to_status),
          assignedTo: row.assigned_to ? String(row.assigned_to) : null,
          customerNotified: row.customer_notified === null || row.customer_notified === undefined ? null : Boolean(row.customer_notified),
          customerEmailError: row.customer_email_error ? String(row.customer_email_error) : null
        });
      }
    } catch (error) {
      console.error('[timeline] Read failed:', error instanceof Error ? error.message : error);
    }
  }

  for (const forward of await listDeclarationForwards(declaration.id)) {
    entries.push({
      id: forward.id,
      kind: 'forward',
      at: forward.createdAt,
      author: forward.sentBy,
      body: forward.subject,
      fromStatus: null,
      toStatus: null,
      assignedTo: null,
      customerNotified: null,
      customerEmailError: null,
      forward: { insurer: forward.insurer, to: forward.to, ok: forward.ok, error: forward.error }
    });
  }

  // Newest first; the claim's arrival always closes the list.
  return entries.sort((a, b) =>
    a.kind === 'created' ? 1 : b.kind === 'created' ? -1 : b.at.localeCompare(a.at)
  );
}

/** Names already used for assignment, plus the signed-in operator, for the picker. */
export async function knownAssignees(current: string | null): Promise<string[]> {
  const names = new Set<string>();
  if (current) names.add(current);
  const db = getDbClient();
  if (db) {
    try {
      const rows = await db.query(
        `select distinct assigned_to from public.declarations where assigned_to is not null order by assigned_to limit 50`
      );
      for (const row of rows) names.add(String(row.assigned_to));
    } catch {
      // The picker still works as a free-text field.
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'fr'));
}

export type InfoRequestResult = { ok: true } | { ok: false; error: string };

/**
 * Emails the customer one link listing what the claim is missing. The link
 * carries a random token; only its hash is stored, and it expires after
 * INFO_REQUEST_TTL_DAYS.
 */
export async function requestCustomerInfo(
  declaration: Pick<Declaration, 'id' | 'email' | 'firstName' | 'language'>,
  items: string[],
  options: { author: string | null; origin: string; replyTo?: string | null }
): Promise<InfoRequestResult> {
  const wanted = fillableItems(items);
  const db = getDbClient();
  if (!db || wanted.length === 0) return { ok: false, error: 'Aucune information à demander au client.' };
  if (!isEmailConfigured() || !process.env.EMAIL_FROM?.trim()) {
    return { ok: false, error: 'Aucun fournisseur d’e-mail ou EMAIL_FROM configuré.' };
  }

  const { token, hash } = newInfoRequestToken();
  await db.query(
    `update public.declarations
        set info_request_token = $1,
            info_request_expires_at = now() + make_interval(days => $2),
            info_request_items = $3
      where id = $4`,
    [hash, INFO_REQUEST_TTL_DAYS, wanted.join(','), declaration.id]
  );

  const language: DeclarationLanguage = toDeclarationLanguage(declaration.language);
  const result = await sendEmail(
    buildInfoRequestEmail({
      to: declaration.email,
      firstName: declaration.firstName,
      reference: declarationReference(declaration.id),
      language,
      items: wanted,
      url: `${options.origin}${infoRequestPath(token)}`,
      replyTo: options.replyTo ?? undefined
    })
  );

  try {
    await logEvent({
      declarationId: declaration.id,
      kind: 'info_request',
      body: wanted.map((item) => itemLabel(item, 'fr')).join('\n'),
      author: options.author,
      customerNotified: result.ok,
      customerEmailError: result.ok ? null : result.error
    });
  } catch (error) {
    console.error('[timeline] Event write failed:', error instanceof Error ? error.message : error);
  }

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export interface OpenInfoRequest {
  id: string;
  firstName: string;
  language: DeclarationLanguage;
  items: FillableItem[];
}

/** The claim behind a customer's link, or null when the link is unknown or expired. */
export async function findOpenInfoRequest(token: string): Promise<OpenInfoRequest | null> {
  const db = getDbClient();
  if (!db || !token || token.length > 100) return null;

  const rows = await db.query(
    `select id, first_name, language, info_request_items
       from public.declarations
      where info_request_token = $1 and info_request_expires_at > now()`,
    [hashInfoRequestToken(token)]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    firstName: String(row.first_name),
    language: toDeclarationLanguage(row.language),
    items: fillableItems(String(row.info_request_items ?? '').split(','))
  };
}

export interface CustomerInfoInput {
  policy: string;
  date: string;
  place: string;
  circumstances: string;
  details: string;
}

/**
 * Stores what the customer sent back. Blank claim fields are filled in; fields
 * staff already completed are never overwritten. Everything sent is kept in the
 * timeline, so nothing the customer wrote is lost.
 */
export async function saveCustomerInfo(token: string, input: CustomerInfoInput): Promise<boolean> {
  const db = getDbClient();
  const request = db ? await findOpenInfoRequest(token) : null;
  if (!db || !request) return false;

  await db.query(
    `update public.declarations set
       insurance_policy_number = case when coalesce(btrim(insurance_policy_number), '') = '' then nullif($2, '') else insurance_policy_number end,
       incident_date = coalesce(incident_date, $3::date),
       incident_place = case when coalesce(btrim(incident_place), '') = '' then nullif($4, '') else incident_place end,
       incident_circumstances = case when coalesce(btrim(incident_circumstances), '') = '' then nullif($5, '') else incident_circumstances end
     where id = $1`,
    [request.id, input.policy, input.date || null, input.place, input.circumstances]
  );

  const lines = [
    input.policy && `N° de police : ${input.policy}`,
    input.date && `Date du sinistre : ${input.date}`,
    input.place && `Lieu : ${input.place}`,
    input.circumstances && `Circonstances : ${input.circumstances}`,
    input.details && `Autres informations : ${input.details}`
  ].filter(Boolean);

  try {
    await logEvent({
      declarationId: request.id,
      kind: 'customer_info',
      body: lines.length > 0 ? lines.join('\n') : 'Le client a validé sans rien ajouter.',
      author: 'Client'
    });
  } catch (error) {
    console.error('[timeline] Event write failed:', error instanceof Error ? error.message : error);
  }

  return true;
}
