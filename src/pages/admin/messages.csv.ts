import type { APIRoute } from 'astro';
import { listInquiries } from '../../lib/inquiries';

export const prerender = false;

/** Quotes a CSV field, doubling embedded quotes. */
function field(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/**
 * CSV export of the submissions currently filtered in the admin list.
 * Protected by the same middleware as the rest of /admin.
 */
export const GET: APIRoute = async ({ url }) => {
  const rows = await listInquiries({
    status: url.searchParams.get('status') ?? '',
    formType: url.searchParams.get('type') ?? '',
    search: url.searchParams.get('q')?.trim() ?? '',
    order: 'newest',
    limit: 500
  });

  const header = ['id', 'type', 'nom', 'email', 'telephone', 'message', 'statut', 'recu_le', 'modifie_le'];
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [row.id, row.formType, row.name, row.email, row.phone, row.message, row.status, row.createdAt, row.updatedAt]
        .map(field)
        .join(',')
    )
  ];

  // A BOM keeps Excel from mangling the French accents.
  return new Response(`\uFEFF${lines.join('\r\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="messages-bdts.csv"',
      'Cache-Control': 'no-store'
    }
  });
};
