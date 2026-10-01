import {
  declarationName,
  declarationTitleLabel,
  getDeclarationAttachmentsWithContent,
  logDeclarationForward,
  setDeclarationInsurer,
  type Declaration,
  type InsurerSource
} from './declarations';
import { declarationReference, formatDeclarationDate } from './declarationSummary';
import { renderDeclarationPdf } from './declarationPdf';
import { declarationPdfFilename } from './declarationEmail';
import { sendEmail } from './email';
import { changeDeclarationStatus } from './claimTimeline';
import { insurerName, parseEmailList, type ForwardSettings } from './insurers';

/**
 * Forwarding a claim to its insurer from the admin claim page.
 *
 * The office always sees and can edit the full message before it goes, and it
 * only goes on an explicit click: nothing here sends on its own.
 */

export interface ForwardDraft {
  insurer: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
}

const SIGNATURE = ['BDTS', 'Rue de Wand 29, 1020 Bruxelles', '+32 2 463 19 25 · bdts@bdts.be'].join('\n');

export function buildForwardDraft(declaration: Declaration, insurer: string, settings: ForwardSettings): ForwardDraft {
  const reference = declarationReference(declaration.id);
  const name = declarationName(declaration);
  const title = declarationTitleLabel(declaration.personTitle);
  const policy = declaration.insurancePolicyNumber?.trim();
  const fileCount = declaration.attachmentCount;

  const subject = ['Déclaration de sinistre', reference, name, policy && `police ${policy}`].filter(Boolean).join(' – ');

  const facts = [
    policy && `N° de police : ${policy}`,
    declaration.insuredPersonOrItem && `Personne ou bien assuré : ${declaration.insuredPersonOrItem}`,
    declaration.incidentDate &&
      `Date du sinistre : ${formatDeclarationDate(declaration.incidentDate)}${
        declaration.incidentTime ? ` à ${declaration.incidentTime.slice(0, 5)}` : ''
      }`,
    declaration.incidentPlace && `Lieu : ${declaration.incidentPlace}`,
    declaration.counterpartyPresent && 'Une partie adverse est impliquée (coordonnées dans le récapitulatif).',
    declaration.witnessPresent && 'Un témoin est renseigné (coordonnées dans le récapitulatif).'
  ].filter(Boolean);

  const body = [
    'Madame, Monsieur,',
    '',
    `Nous vous transmettons la déclaration de sinistre de notre client${declaration.personTitle === 'mrs' ? 'e' : ''} ${
      title ? `${title} ` : ''
    }${name} (notre référence ${reference}).`,
    '',
    ...facts,
    ...(declaration.incidentCircumstances?.trim() ? ['', 'Circonstances :', declaration.incidentCircumstances.trim()] : []),
    '',
    `Vous trouverez en pièce jointe le récapitulatif complet de la déclaration (PDF)${
      fileCount > 0 ? ` ainsi que ${fileCount === 1 ? 'le document transmis' : `les ${fileCount} documents transmis`} par le client` : ''
    }.`,
    'Pourriez-vous nous communiquer la référence de votre dossier ?',
    '',
    'Nous vous remercions et restons à votre disposition.',
    '',
    'Cordialement,',
    '',
    SIGNATURE
  ].join('\n');

  return {
    insurer,
    to: settings.contacts[insurer] ?? '',
    cc: settings.cc,
    subject,
    body
  };
}

export type ForwardResult = { ok: true; to: string[] } | { ok: false; error: string };

/**
 * Sends the claim with its PDF summary and every attached file, logs the
 * attempt on the claim either way, and moves a new claim to "En cours"
 * (which emails the customer, see claimTimeline.ts).
 */
export async function forwardDeclaration(
  declaration: Declaration,
  draft: ForwardDraft,
  options: { replyTo: string; sentBy: string | null; insurerSource: InsurerSource }
): Promise<ForwardResult> {
  const to = parseEmailList(draft.to);
  if (!to || to.length === 0) return { ok: false, error: 'Adresse du destinataire invalide.' };
  const cc = draft.cc.trim() ? parseEmailList(draft.cc) : [];
  if (!cc) return { ok: false, error: 'Adresse en copie invalide.' };
  const replyTo = options.replyTo.trim() ? parseEmailList(options.replyTo, 1)?.[0] : undefined;
  if (!draft.subject.trim() || !draft.body.trim()) return { ok: false, error: 'L’objet et le message sont requis.' };

  const reference = declarationReference(declaration.id);
  let pdfBase64: string;
  try {
    const pdf = await renderDeclarationPdf({
      reference,
      submittedAt: new Date(declaration.createdAt),
      declaration,
      attachmentNames: declaration.attachments.map((attachment) => attachment.filename),
      language: 'fr'
    });
    pdfBase64 = pdf.toString('base64');
  } catch (error) {
    console.error('[forward] PDF summary failed:', error instanceof Error ? error.message : 'unknown error');
    return { ok: false, error: 'Le récapitulatif PDF n’a pas pu être généré.' };
  }

  const files = await getDeclarationAttachmentsWithContent(declaration.id);
  const attachments = [
    { filename: declarationPdfFilename(reference), contentBase64: pdfBase64 },
    ...files.map((file) => ({ filename: file.filename, contentBase64: file.contentBase64 }))
  ];

  const result = await sendEmail({
    to,
    cc,
    replyTo,
    subject: draft.subject.trim(),
    text: draft.body,
    html: textToHtml(draft.body),
    attachments
  });

  try {
    await logDeclarationForward({
      declarationId: declaration.id,
      insurer: draft.insurer,
      to: to.join(', '),
      cc: cc.join(', ') || null,
      subject: draft.subject.trim(),
      body: draft.body,
      attachmentNames: attachments.map((attachment) => attachment.filename),
      sentBy: options.sentBy,
      ok: result.ok,
      error: result.ok ? null : result.error
    });
  } catch (error) {
    // The mail has gone (or not) either way; a missing log line must not hide that.
    console.error('[forward] Log write failed:', error instanceof Error ? error.message : 'unknown error');
  }

  if (!result.ok) return { ok: false, error: `L’envoi a échoué : ${result.error}` };

  if (declaration.insurer !== draft.insurer) {
    await setDeclarationInsurer(declaration.id, draft.insurer, options.insurerSource);
  }
  // Sending a new claim to its insurer is taking it in hand: the customer is told.
  if (declaration.status === 'new') {
    await changeDeclarationStatus(declaration, 'in_progress', { author: options.sentBy, notify: true });
  }

  console.info(`[forward] ${reference} sent to ${insurerName(draft.insurer)} (${to.join(', ')}).`);
  return { ok: true, to };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The edited plain-text message as simple HTML, line breaks kept. */
function textToHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 14px">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#2f2b24">${paragraphs}</div>`;
}
