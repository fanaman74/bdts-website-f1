import type { APIRoute } from 'astro';
import { getDeclaration } from '../../../../lib/declarations';
import { declarationReference } from '../../../../lib/declarationSummary';
import { declarationPdfFilename } from '../../../../lib/declarationEmail';
import { renderDeclarationPdf } from '../../../../lib/declarationPdf';

export const prerender = false;

/**
 * The French PDF summary exactly as it is attached when the claim is forwarded
 * to the insurer, so staff can check it before sending. Behind the /admin
 * middleware like the rest of the claim.
 */
export const GET: APIRoute = async ({ params }) => {
  const declaration = params.id ? await getDeclaration(params.id) : null;
  if (!declaration) return new Response('Déclaration introuvable.', { status: 404 });

  const reference = declarationReference(declaration.id);
  const pdf = await renderDeclarationPdf({
    reference,
    submittedAt: new Date(declaration.createdAt),
    declaration,
    attachmentNames: declaration.attachments.map((attachment) => attachment.filename),
    language: 'fr'
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.byteLength),
      'Content-Disposition': `inline; filename="${declarationPdfFilename(reference)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
};
