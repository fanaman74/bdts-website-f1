/** Largest PDF we will download, and the most text we keep from it. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const MAX_DOCUMENT_CHARACTERS = 80_000;

export interface ExtractedDocument {
  text: string;
  truncated: boolean;
}

/**
 * Downloads a PDF and extracts its text.
 *
 * Note that this can succeed from a developer machine and fail from Railway:
 * some insurers refuse requests from datacenter IPs, returning 403 even though
 * the document is publicly readable. `scripts/ingest-document-texts.ts` warms
 * the Postgres cache from an unblocked network for those hosts.
 */
export async function fetchDocumentText(url: string, timeoutMs = 30_000): Promise<ExtractedDocument> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BDTS-Document-Assistant/1.0; +https://www.bdts.be)',
      Accept: 'application/pdf,*/*;q=0.8',
      'Accept-Language': 'fr-BE,fr;q=0.9,nl;q=0.8,en;q=0.7',
      Referer: 'https://app.sectorcatalog.be/'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) throw new Error(`la compagnie a répondu HTTP ${response.status}`);

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_DOCUMENT_BYTES) throw new Error('le fichier dépasse la taille maximale de 25 Mo');

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new Error('le fichier dépasse la taille maximale de 25 Mo');
  if (bytes.byteLength === 0) throw new Error('le fichier reçu est vide');

  // Import the parser implementation directly. The package root executes a
  // bundled test fixture when loaded by some ESM development runtimes.
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const parsed = await pdfParse(Buffer.from(bytes), { max: 50 });

  let text = (parsed.text || '').trim();
  if (!text) throw new Error('aucun texte lisible n’a été trouvé; le PDF est peut-être numérisé');

  const truncated = text.length > MAX_DOCUMENT_CHARACTERS;
  if (truncated) text = `${text.slice(0, MAX_DOCUMENT_CHARACTERS)}\n\n[Document tronqué après 80 000 caractères]`;

  return { text, truncated };
}
