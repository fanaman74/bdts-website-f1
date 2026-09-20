import { getDbClient } from './db';

export const INQUIRY_STATUSES = ['new', 'in_progress', 'closed', 'spam'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const FORM_TYPES = ['contact', 'devis', 'declaration'] as const;

export interface Inquiry {
  id: string;
  formType: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InquiryFilters {
  status?: string;
  formType?: string;
  search?: string;
  limit?: number;
}

/**
 * Every submission received from the site's forms.
 *
 * Filters are applied in SQL so the admin list stays usable as the table grows,
 * and all values are bound parameters — never interpolated.
 */
export async function listInquiries(filters: InquiryFilters = {}): Promise<Inquiry[]> {
  const db = getDbClient();
  if (!db) return [];

  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.status && (INQUIRY_STATUSES as readonly string[]).includes(filters.status)) {
    params.push(filters.status);
    where.push(`status = $${params.length}`);
  }
  if (filters.formType && (FORM_TYPES as readonly string[]).includes(filters.formType)) {
    params.push(filters.formType);
    where.push(`form_type = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where.push(`(name ilike $${params.length} or email ilike $${params.length} or phone ilike $${params.length} or message ilike $${params.length})`);
  }

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  params.push(limit);

  const rows = await db.query(
    `select id, form_type, name, email, phone, message, status, created_at, updated_at
       from public.inquiries
      ${where.length ? `where ${where.join(' and ')}` : ''}
      order by created_at desc
      limit $${params.length}`,
    params
  );

  return rows.map((row) => ({
    id: String(row.id),
    formType: String(row.form_type),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone),
    message: String(row.message),
    status: String(row.status) as InquiryStatus,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  }));
}

/** Counts per status, plus the total, for the dashboard tiles. */
export async function inquiryCounts(): Promise<{ total: number; byStatus: Record<InquiryStatus, number> }> {
  const byStatus: Record<InquiryStatus, number> = { new: 0, in_progress: 0, closed: 0, spam: 0 };
  const db = getDbClient();
  if (!db) return { total: 0, byStatus };

  const rows = await db.query('select status, count(*)::int as count from public.inquiries group by status');
  let total = 0;
  for (const row of rows) {
    const status = String(row.status) as InquiryStatus;
    const count = Number(row.count);
    if (status in byStatus) byStatus[status] = count;
    total += count;
  }
  return { total, byStatus };
}

export async function updateInquiryStatus(id: string, status: string): Promise<boolean> {
  const db = getDbClient();
  if (!db) return false;
  if (!(INQUIRY_STATUSES as readonly string[]).includes(status)) return false;

  await db.query('update public.inquiries set status = $1 where id = $2', [status, id]);
  return true;
}

/** How many PDFs have had their text extracted and cached. */
export async function cachedDocumentCount(): Promise<number> {
  const db = getDbClient();
  if (!db) return 0;

  const rows = await db.query('select count(*)::int as count from public.document_texts');
  return Number(rows[0]?.count ?? 0);
}
