import type { APIRoute } from 'astro';
import { sectorCatalogDocuments } from '../../data/sectorCatalog';
import { getCachedDocumentText, saveDocumentText } from '../../lib/documentText';
import { fetchDocumentText } from '../../lib/pdfText';

export const prerender = false;

const WINDOW_MS = 15 * 60_000;
const WINDOW_LIMIT = 20;
const hits = new Map<string, number[]>();

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
}

/** Only real downloads count against the limit; cache hits are free. */
function allowDownload(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= WINDOW_LIMIT) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

/**
 * Prepares one catalogue document for the assistant: downloads and extracts its
 * text once, then serves it from cache afterwards. The chat drawer calls this as
 * soon as it opens, so the download overlaps with the visitor reading and typing
 * instead of delaying their first question.
 *
 * Two deliberate constraints:
 * - only ids present in the catalogue are accepted, so this can never become a
 *   general "fetch any URL" endpoint;
 * - no model is called, so it costs nothing at the provider.
 */
export const POST: APIRoute = async ({ request }) => {
  let documentId: unknown;
  try {
    ({ documentId } = (await request.json()) as { documentId?: unknown });
  } catch {
    return json({ ok: false, error: 'invalid-body' }, 400);
  }
  if (typeof documentId !== 'string') return json({ ok: false, error: 'invalid-body' }, 400);

  const document = sectorCatalogDocuments.find((candidate) => candidate.id === documentId);
  if (!document) return json({ ok: false, error: 'unknown-document' }, 404);

  const cached = await getCachedDocumentText(documentId).catch(() => null);
  if (cached) return json({ ok: true, cached: true, chars: cached.content.length }, 200);

  if (!allowDownload(clientIp(request))) return json({ ok: false, error: 'rate-limited' }, 429);

  const url = document.externalUrl || document.fileUrl;
  try {
    const extracted = await fetchDocumentText(url);
    await saveDocumentText(documentId, url, extracted.text, extracted.truncated).catch(() => undefined);
    return json({ ok: true, cached: true, fetched: true, chars: extracted.text.length }, 200);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erreur inconnue';
    console.error('[document-text] Extraction failed:', reason, '·', documentId);
    return json({ ok: false, error: reason }, 422);
  }
};
