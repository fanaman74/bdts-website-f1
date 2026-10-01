import { randomUUID } from 'node:crypto';
import { getDbClient } from './db';
import { toDeclarationLanguage, type DeclarationLanguage } from './declarationI18n';

/**
 * Claim declarations submitted from /declaration.
 *
 * This is the single place that knows how the structured form maps onto the
 * `declarations` and `declaration_attachments` tables, so the API route, the
 * admin list and the future claims automation all read the same shape.
 *
 * Every value is written through bound parameters — never interpolated — and
 * the only dynamic SQL fragments (filter columns, sort direction) are derived
 * from literal unions rather than user input.
 */

export const DECLARATION_STATUSES = ['new', 'in_progress', 'closed', 'spam'] as const;
export type DeclarationStatus = (typeof DECLARATION_STATUSES)[number];

export const DECLARATION_STATUS_LABELS: Record<DeclarationStatus, string> = {
  new: 'Nouveau',
  in_progress: 'En cours',
  closed: 'Clôturé',
  spam: 'Indésirable'
};

export interface DeclarationInput {
  // Mes informations de contact
  personTitle: string | null;
  lastName: string;
  firstName: string;
  dateOfBirth: string | null;
  street: string | null;
  streetNumber: string | null;
  bus: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  company: string | null;
  phoneFixed: string | null;
  phoneMobile: string | null;
  email: string;

  // Identification du sinistre
  insuredPersonOrItem: string | null;
  insurancePolicyNumber: string | null;
  incidentDate: string | null;
  incidentTime: string | null;
  incidentPlace: string | null;
  incidentCircumstances: string | null;

  // Informations sur le témoin
  witnessPresent: boolean;
  witnessTitle: string | null;
  witnessLastName: string | null;
  witnessFirstName: string | null;
  witnessStreet: string | null;
  witnessStreetNumber: string | null;
  witnessBus: string | null;
  witnessPostalCode: string | null;
  witnessCity: string | null;
  witnessCountry: string | null;
  witnessPhone: string | null;

  // Partie adverse
  counterpartyPresent: boolean;
  counterpartyTitle: string | null;
  counterpartyLastName: string | null;
  counterpartyFirstName: string | null;
  counterpartyStreet: string | null;
  counterpartyStreetNumber: string | null;
  counterpartyBus: string | null;
  counterpartyPostalCode: string | null;
  counterpartyCity: string | null;
  counterpartyCountry: string | null;
  counterpartyPhone: string | null;
  counterpartyInsuranceCompany: string | null;
  counterpartyInsurancePolicyNumber: string | null;

  // Autres
  remarks: string | null;
}

export interface Declaration extends DeclarationInput {
  id: string;
  status: DeclarationStatus;
  consentedAt: string;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
  /** Attachments that are photos (image/*), for the "no photos" flag. */
  imageCount: number;
  /** Insurer id from src/lib/insurers.ts, once matched or chosen. */
  insurer: string | null;
  insurerSource: InsurerSource | null;
  /** The language the customer declared in, for emails sent to them. */
  language: DeclarationLanguage;
  /** The staff member following the claim, as typed in /admin. */
  assignedTo: string | null;
  /** Only populated by getDeclaration(). */
  attachments: DeclarationAttachment[];
}

export const INSURER_SOURCES = ['policy', 'customer', 'text', 'manual'] as const;
export type InsurerSource = (typeof INSURER_SOURCES)[number];

export const INSURER_SOURCE_LABELS: Record<InsurerSource, string> = {
  policy: 'même n° de police qu’un dossier précédent',
  customer: 'même client qu’un dossier précédent',
  text: 'nommé par le client dans sa déclaration',
  manual: 'choisi par le bureau'
};

export interface DeclarationAttachment {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  createdAt: string;
}

export interface AttachmentInput {
  filename: string;
  contentType: string;
  byteSize: number;
  contentBase64: string;
}

export interface DeclarationFilters {
  status?: string;
  search?: string;
  /** An insurer id, or 'none' for claims not yet matched to one. */
  insurer?: string;
  order?: 'newest' | 'oldest';
  limit?: number;
}

/**
 * The one mapping between the typed input and the database columns. Keeping it
 * in a single list means a new field cannot silently be written on insert but
 * forgotten on read (or the other way around).
 */
const FIELDS: ReadonlyArray<readonly [column: string, key: keyof DeclarationInput]> = [
  ['person_title', 'personTitle'],
  ['last_name', 'lastName'],
  ['first_name', 'firstName'],
  ['date_of_birth', 'dateOfBirth'],
  ['street', 'street'],
  ['street_number', 'streetNumber'],
  ['bus', 'bus'],
  ['postal_code', 'postalCode'],
  ['city', 'city'],
  ['country', 'country'],
  ['company', 'company'],
  ['phone_fixed', 'phoneFixed'],
  ['phone_mobile', 'phoneMobile'],
  ['email', 'email'],
  ['insured_person_or_item', 'insuredPersonOrItem'],
  ['insurance_policy_number', 'insurancePolicyNumber'],
  ['incident_date', 'incidentDate'],
  ['incident_time', 'incidentTime'],
  ['incident_place', 'incidentPlace'],
  ['incident_circumstances', 'incidentCircumstances'],
  ['witness_present', 'witnessPresent'],
  ['witness_title', 'witnessTitle'],
  ['witness_last_name', 'witnessLastName'],
  ['witness_first_name', 'witnessFirstName'],
  ['witness_street', 'witnessStreet'],
  ['witness_street_number', 'witnessStreetNumber'],
  ['witness_bus', 'witnessBus'],
  ['witness_postal_code', 'witnessPostalCode'],
  ['witness_city', 'witnessCity'],
  ['witness_country', 'witnessCountry'],
  ['witness_phone', 'witnessPhone'],
  ['counterparty_present', 'counterpartyPresent'],
  ['counterparty_title', 'counterpartyTitle'],
  ['counterparty_last_name', 'counterpartyLastName'],
  ['counterparty_first_name', 'counterpartyFirstName'],
  ['counterparty_street', 'counterpartyStreet'],
  ['counterparty_street_number', 'counterpartyStreetNumber'],
  ['counterparty_bus', 'counterpartyBus'],
  ['counterparty_postal_code', 'counterpartyPostalCode'],
  ['counterparty_city', 'counterpartyCity'],
  ['counterparty_country', 'counterpartyCountry'],
  ['counterparty_phone', 'counterpartyPhone'],
  ['counterparty_insurance_company', 'counterpartyInsuranceCompany'],
  ['counterparty_insurance_policy_number', 'counterpartyInsurancePolicyNumber'],
  ['remarks', 'remarks']
];

const BOOLEAN_KEYS = new Set<keyof DeclarationInput>(['witnessPresent', 'counterpartyPresent']);

/** Reads a row into the typed input, coercing the driver's raw values. */
function rowToInput(row: Record<string, unknown>): DeclarationInput {
  const record: Record<string, string | boolean | null> = {};
  for (const [column, key] of FIELDS) {
    if (BOOLEAN_KEYS.has(key)) {
      record[key] = Boolean(row[column]);
      continue;
    }
    const value = row[column];
    // The driver parses `date` columns into a Date at local midnight; keep the
    // stored YYYY-MM-DD rather than "Mon Sep 28 2026 00:00:00 GMT…".
    record[key] = value === null || value === undefined ? null : value instanceof Date ? localIsoDate(value) : String(value);
  }
  return record as unknown as DeclarationInput;
}

/**
 * The triage columns, read defensively: before migration 0008 has run they are
 * simply absent and the claim reads as not yet matched.
 */
function insurerFields(
  row: Record<string, unknown>
): Pick<Declaration, 'insurer' | 'insurerSource' | 'language' | 'assignedTo'> {
  const insurer = typeof row.insurer === 'string' && row.insurer ? row.insurer : null;
  const source = String(row.insurer_source ?? '');
  return {
    language: toDeclarationLanguage(row.language),
    assignedTo: typeof row.assigned_to === 'string' && row.assigned_to.trim() ? row.assigned_to : null,
    insurer,
    insurerSource: insurer && (INSURER_SOURCES as readonly string[]).includes(source) ? (source as InsurerSource) : null
  };
}

/**
 * A timestamp column as ISO text, keeping milliseconds: going through
 * String(Date) drops them, which reorders actions made in the same second.
 */
export function toIsoTimestamp(value: unknown): string {
  return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

function localIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function rowToAttachment(row: Record<string, unknown>): DeclarationAttachment {
  return {
    id: String(row.id),
    filename: String(row.filename),
    contentType: String(row.content_type),
    byteSize: Number(row.byte_size),
    createdAt: toIsoTimestamp(row.created_at)
  };
}

/** A display name, tolerant of the fields being filled in either order. */
export function declarationName(declaration: Pick<DeclarationInput, 'firstName' | 'lastName'>): string {
  return `${declaration.firstName} ${declaration.lastName}`.trim() || 'Déclaration';
}

/** Renders a stored title code ('mr' / 'mrs') for the admin area. */
export function declarationTitleLabel(code: string | null): string {
  if (code === 'mr') return 'Monsieur';
  if (code === 'mrs') return 'Madame';
  return '';
}

/**
 * Stores a declaration and its attachments in one transaction, so a claim is
 * never persisted without the documents that support it.
 *
 * The id is generated here rather than by the database default: the Neon HTTP
 * driver runs the transaction as a batch of statements, and the attachment
 * inserts need the declaration id up front.
 */
export async function createDeclaration(
  input: DeclarationInput,
  attachments: AttachmentInput[] = [],
  language: DeclarationLanguage = 'fr'
): Promise<string | null> {
  const db = getDbClient();
  if (!db) return null;

  const id = randomUUID();
  const columns = ['id', 'language', ...FIELDS.map(([column]) => column)];
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const values: unknown[] = [id, language, ...FIELDS.map(([, key]) => input[key])];

  const statements = [
    db.query(
      `insert into public.declarations (${columns.join(', ')})
       values (${placeholders.join(', ')})`,
      values
    ),
    ...attachments.map((attachment) =>
      db.query(
        `insert into public.declaration_attachments
           (declaration_id, filename, content_type, byte_size, content_base64)
         values ($1, $2, $3, $4, $5)`,
        [id, attachment.filename, attachment.contentType, attachment.byteSize, attachment.contentBase64]
      )
    )
  ];

  await db.transaction(statements);
  return id;
}

/**
 * Declarations for the admin list, newest first by default.
 *
 * The filter columns are fixed literals; only the values are bound.
 */
export async function listDeclarations(filters: DeclarationFilters = {}): Promise<Declaration[]> {
  const db = getDbClient();
  if (!db) return [];

  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.status && (DECLARATION_STATUSES as readonly string[]).includes(filters.status)) {
    params.push(filters.status);
    where.push(`d.status = $${params.length}`);
  }
  if (filters.insurer === 'none') {
    where.push('d.insurer is null');
  } else if (filters.insurer) {
    params.push(filters.insurer);
    where.push(`d.insurer = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const p = `$${params.length}`;
    where.push(
      `(d.last_name ilike ${p} or d.first_name ilike ${p} or d.email ilike ${p}
        or d.phone_mobile ilike ${p} or d.phone_fixed ilike ${p}
        or d.insurance_policy_number ilike ${p} or d.city ilike ${p})`
    );
  }
  // The customer's reference (SIN-1A2B3C4D) is the first block of the id.
  const reference = /^\s*SIN-?([0-9a-f]{4,8})\s*$/i.exec(filters.search ?? '');
  if (reference) {
    params.push(`${reference[1]!.toLowerCase()}%`);
    where[where.length - 1] = `(${where[where.length - 1]} or d.id::text ilike $${params.length})`;
  }

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  params.push(limit);

  // Derived from a literal union, never from user input.
  const direction = filters.order === 'oldest' ? 'asc' : 'desc';

  const rows = await db.query(
    `select d.*,
            (select count(*)::int from public.declaration_attachments a where a.declaration_id = d.id) as attachment_count,
            (select count(*)::int from public.declaration_attachments a
              where a.declaration_id = d.id and a.content_type like 'image/%') as image_count
       from public.declarations d
      ${where.length ? `where ${where.join(' and ')}` : ''}
      order by d.created_at ${direction}
      limit $${params.length}`,
    params
  );

  return rows.map((row) => ({
    id: String(row.id),
    ...rowToInput(row),
    status: String(row.status) as DeclarationStatus,
    consentedAt: toIsoTimestamp(row.consented_at),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
    attachmentCount: Number(row.attachment_count ?? 0),
    imageCount: Number(row.image_count ?? 0),
    ...insurerFields(row),
    attachments: []
  }));
}

/** One declaration with its attachment metadata, or null when absent. */
export async function getDeclaration(id: string): Promise<Declaration | null> {
  const db = getDbClient();
  if (!db) return null;

  const rows = await db.query('select * from public.declarations where id = $1', [id]);
  const row = rows[0];
  if (!row) return null;

  const attachmentRows = await db.query(
    `select id, filename, content_type, byte_size, created_at
       from public.declaration_attachments
      where declaration_id = $1
      order by created_at asc`,
    [id]
  );

  const attachments = attachmentRows.map((attachment) => rowToAttachment(attachment));

  return {
    id: String(row.id),
    ...rowToInput(row),
    status: String(row.status) as DeclarationStatus,
    consentedAt: toIsoTimestamp(row.consented_at),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
    attachmentCount: attachments.length,
    imageCount: attachments.filter((attachment) => attachment.contentType.startsWith('image/')).length,
    ...insurerFields(row),
    attachments
  };
}

/** Counts per status, plus the total, for the dashboard tiles. */
export async function declarationCounts(): Promise<{ total: number; byStatus: Record<DeclarationStatus, number> }> {
  const byStatus: Record<DeclarationStatus, number> = { new: 0, in_progress: 0, closed: 0, spam: 0 };
  const db = getDbClient();
  if (!db) return { total: 0, byStatus };

  const rows = await db.query('select status, count(*)::int as count from public.declarations group by status');
  let total = 0;
  for (const row of rows) {
    const status = String(row.status) as DeclarationStatus;
    const count = Number(row.count);
    if (status in byStatus) byStatus[status] = count;
    total += count;
  }
  return { total, byStatus };
}

export async function updateDeclarationStatus(id: string, status: string): Promise<boolean> {
  const db = getDbClient();
  if (!db) return false;
  if (!(DECLARATION_STATUSES as readonly string[]).includes(status)) return false;

  await db.query('update public.declarations set status = $1 where id = $2', [status, id]);
  return true;
}

/** The raw bytes of one attachment, for the admin download route. */
export async function getDeclarationAttachmentBytes(
  id: string
): Promise<{ filename: string; contentType: string; content: Buffer } | null> {
  const db = getDbClient();
  if (!db) return null;

  const rows = await db.query(
    'select filename, content_type, content_base64 from public.declaration_attachments where id = $1',
    [id]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    filename: String(row.filename),
    contentType: String(row.content_type),
    content: Buffer.from(String(row.content_base64), 'base64')
  };
}

/** Every attachment with its bytes, for forwarding the claim to the insurer. */
export async function getDeclarationAttachmentsWithContent(
  declarationId: string
): Promise<Array<{ filename: string; contentType: string; contentBase64: string }>> {
  const db = getDbClient();
  if (!db) return [];

  const rows = await db.query(
    `select filename, content_type, content_base64
       from public.declaration_attachments
      where declaration_id = $1
      order by created_at asc`,
    [declarationId]
  );
  return rows.map((row) => ({
    filename: String(row.filename),
    contentType: String(row.content_type),
    contentBase64: String(row.content_base64)
  }));
}

export async function setDeclarationInsurer(id: string, insurer: string | null, source: InsurerSource | null): Promise<void> {
  const db = getDbClient();
  if (!db) return;
  await db.query('update public.declarations set insurer = $1, insurer_source = $2 where id = $3', [
    insurer,
    insurer ? source : null,
    id
  ]);
}

/**
 * The insurers already recorded on this customer's earlier claims: first by
 * policy number (punctuation and case ignored), then by email address.
 */
export async function insurersFromHistory(
  declaration: Pick<Declaration, 'id' | 'email' | 'insurancePolicyNumber'>
): Promise<{ byPolicy: string[]; byCustomer: string[] }> {
  const db = getDbClient();
  if (!db) return { byPolicy: [], byCustomer: [] };

  const policy = normalizePolicyNumber(declaration.insurancePolicyNumber);
  // Same policy: equal once punctuation is dropped, or one contains the other
  // ("AXA 123-456" and "123456"), the latter only for numbers long enough not to
  // collide by chance.
  const rows = await db.query(
    `with earlier as (
       select insurer, email,
              lower(regexp_replace(coalesce(insurance_policy_number, ''), '[^0-9A-Za-z]', '', 'g')) as policy
         from public.declarations
        where id <> $1 and insurer is not null and status <> 'spam'
     )
     select distinct insurer,
            ($2 <> '' and (policy = $2 or (length($2) >= 6 and length(policy) >= 6
              and (strpos(policy, $2) > 0 or strpos($2, policy) > 0)))) as same_policy
       from earlier
      where lower(email) = lower($3)
         or ($2 <> '' and (policy = $2 or (length($2) >= 6 and length(policy) >= 6
              and (strpos(policy, $2) > 0 or strpos($2, policy) > 0))))`,
    [declaration.id, policy, declaration.email]
  );

  const byPolicy = new Set<string>();
  const byCustomer = new Set<string>();
  for (const row of rows) {
    const insurer = String(row.insurer);
    if (row.same_policy) byPolicy.add(insurer);
    else byCustomer.add(insurer);
  }
  return { byPolicy: [...byPolicy], byCustomer: [...byCustomer] };
}

export function normalizePolicyNumber(value: string | null): string {
  return (value ?? '').replace(/[^0-9A-Za-z]/g, '').toLowerCase();
}

export interface DeclarationForward {
  id: string;
  insurer: string;
  to: string;
  cc: string | null;
  subject: string;
  attachmentNames: string[];
  sentBy: string | null;
  ok: boolean;
  error: string | null;
  createdAt: string;
}

export async function logDeclarationForward(entry: {
  declarationId: string;
  insurer: string;
  to: string;
  cc: string | null;
  subject: string;
  body: string;
  attachmentNames: string[];
  sentBy: string | null;
  ok: boolean;
  error: string | null;
}): Promise<void> {
  const db = getDbClient();
  if (!db) return;
  await db.query(
    `insert into public.declaration_forwards
       (declaration_id, insurer, to_email, cc_email, subject, body, attachment_names, sent_by, ok, error)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      entry.declarationId,
      entry.insurer,
      entry.to.slice(0, 1000),
      entry.cc?.slice(0, 1000) || null,
      entry.subject.slice(0, 300),
      entry.body.slice(0, 20000),
      entry.attachmentNames.join('\n'),
      entry.sentBy?.slice(0, 200) ?? null,
      entry.ok,
      entry.error?.slice(0, 500) ?? null
    ]
  );
}

/** The forward log of one claim, newest first. Empty before migration 0008. */
export async function listDeclarationForwards(declarationId: string): Promise<DeclarationForward[]> {
  const db = getDbClient();
  if (!db) return [];
  try {
    const rows = await db.query(
      `select id, insurer, to_email, cc_email, subject, attachment_names, sent_by, ok, error, created_at
         from public.declaration_forwards
        where declaration_id = $1
        order by created_at desc`,
      [declarationId]
    );
    return rows.map((row) => ({
      id: String(row.id),
      insurer: String(row.insurer),
      to: String(row.to_email),
      cc: row.cc_email ? String(row.cc_email) : null,
      subject: String(row.subject),
      attachmentNames: String(row.attachment_names ?? '').split('\n').filter(Boolean),
      sentBy: row.sent_by ? String(row.sent_by) : null,
      ok: Boolean(row.ok),
      error: row.error ? String(row.error) : null,
      createdAt: toIsoTimestamp(row.created_at)
    }));
  } catch (error) {
    console.error('[declarations] Forward log read failed:', error instanceof Error ? error.message : error);
    return [];
  }
}
