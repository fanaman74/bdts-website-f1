import type { APIRoute } from 'astro';
import { getDeclarationAttachmentBytes } from '../../../../lib/declarations';

export const prerender = false;

/**
 * Streams one declaration attachment back to the browser.
 *
 * Protected by the same middleware as the rest of /admin, so a signed-in staff
 * account is required. `inline` lets an image or PDF be previewed in the tab
 * while the filename still drives "Save as".
 */
export const GET: APIRoute = async ({ params }) => {
  const id = params.id ?? '';
  const attachment = id ? await getDeclarationAttachmentBytes(id) : null;
  if (!attachment) return new Response('Pièce jointe introuvable.', { status: 404 });

  // Quotes and newlines would break the Content-Disposition header.
  const filename = attachment.filename.replace(/[\r\n"]/g, '_');

  return new Response(new Uint8Array(attachment.content), {
    headers: {
      'Content-Type': attachment.contentType,
      'Content-Length': String(attachment.content.byteLength),
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
};
