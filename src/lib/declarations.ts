import { randomUUID } from 'node:crypto';
import { getDbClient } from './db';

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
  /** Only populated by getDeclaration(). */
  attachments: DeclarationAttachment[];
}

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
    record[key] = value === null || value === undefined ? null : String(value);
  }
  return record as unknown as DeclarationInput;
}

function rowToAttachment(row: Record<string, unknown>): DeclarationAttachment {
  return {
    id: String(row.id),
    filename: String(row.filename),
    contentType: String(row.content_type),
    byteSize: Number(row.byte_size),
    createdAt: new Date(String(row.created_at)).toISOString()
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
  attachments: AttachmentInput[] = []
): Promise<string | null> {
  const db = getDbClient();
  if (!db) return null;

  const id = randomUUID();
  const columns = ['id', ...FIELDS.map(([column]) => column)];
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const values: unknown[] = [id, ...FIELDS.map(([, key]) => input[key])];

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
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const p = `$${params.length}`;
    where.push(
      `(d.last_name ilike ${p} or d.first_name ilike ${p} or d.email ilike ${p}
        or d.phone_mobile ilike ${p} or d.phone_fixed ilike ${p}
        or d.insurance_policy_number ilike ${p} or d.city ilike ${p})`
    );
  }

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  params.push(limit);

  // Derived from a literal union, never from user input.
  const direction = filters.order === 'oldest' ? 'asc' : 'desc';

  const rows = await db.query(
    `select d.*,
            (select count(*)::int from public.declaration_attachments a where a.declaration_id = d.id) as attachment_count
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
    consentedAt: new Date(String(row.consented_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    attachmentCount: Number(row.attachment_count ?? 0),
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
    consentedAt: new Date(String(row.consented_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    attachmentCount: attachments.length,
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



