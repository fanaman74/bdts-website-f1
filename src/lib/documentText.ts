import { getDbClient } from './db';

export interface CachedDocumentText {
  documentId: string;
  content: string;
  truncated: boolean;
}

/**
 * Reads the cached extracted text for a catalogue document.
 *
 * Returns null when the document has never been ingested, or when the database
 * is not configured — callers then fall back to downloading the PDF.
 */
export async function getCachedDocumentText(documentId: string): Promise<CachedDocumentText | null> {
  const db = getDbClient();
  if (!db) return null;

  const rows = await db.query(
    'select document_id, content, truncated from public.document_texts where document_id = $1',
    [documentId]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    documentId: String(row.document_id),
    content: String(row.content),
    truncated: Boolean(row.truncated)
  };
}

/** Stores extracted text, replacing any previous copy of the same document. */
export async function saveDocumentText(
  documentId: string,
  sourceUrl: string,
  content: string,
  truncated: boolean
): Promise<void> {
  const db = getDbClient();
  if (!db) return;

  await db.query(
    `insert into public.document_texts (document_id, source_url, content, char_count, truncated, fetched_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (document_id) do update set
       source_url = excluded.source_url,
       content = excluded.content,
       char_count = excluded.char_count,
       truncated = excluded.truncated,
       fetched_at = excluded.fetched_at`,
    [documentId, sourceUrl, content, content.length, truncated]
  );
}
