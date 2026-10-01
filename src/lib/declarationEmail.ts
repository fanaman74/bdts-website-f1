import type { DeclarationInput } from './declarations';
import { formatDeclarationDate } from './declarationSummary';
import type { EmailMessage } from './email';
import { declarationText, type DeclarationLanguage } from './declarationI18n';

/**
 * The confirmation a customer receives after declaring a claim: their
 * reference, what happens next, and the PDF of what they submitted.
 */

export interface DeclarationConfirmationInput {
  reference: string;
  declaration: DeclarationInput;
  attachmentCount: number;
  /** The PDF summary, base64-encoded; null when it could not be produced. */
  pdfBase64: string | null;
  language: DeclarationLanguage;
}

const OFFICE_PHONE = '+32 2 463 19 25';
const OFFICE_PHONE_LINK = 'tel:+3224631925';
const OFFICE_EMAIL = 'bdts@bdts.be';

const BRAND = '#606c38';
const INK = '#2f2b24';
const MUTED = '#77705f';
const PANEL = '#f4f1ea';
const PAGE = '#faf8f3';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function declarationPdfFilename(reference: string, language: DeclarationLanguage = 'fr'): string {
  return `${declarationText(language, 'declaration-sinistre')}-${reference}.pdf`;
}

export function buildDeclarationConfirmation(input: DeclarationConfirmationInput): EmailMessage {
  const d = input.declaration;
  const t = (french: string, values?: Record<string, string | number>) => declarationText(input.language, french, values);
  const hasPdf = input.pdfBase64 !== null;

  const incidentDate = formatDeclarationDate(d.incidentDate);
  const incidentTime = d.incidentTime?.slice(0, 5) ?? null;
  const incidentMoment =
    incidentDate && incidentTime ? t('{date} à {time}', { date: incidentDate, time: incidentTime }) : (incidentDate ?? incidentTime);
  const summary: Array<[string, string]> = (
    [
      [t('Référence'), input.reference],
      [t('Date du sinistre'), incidentMoment || null],
      [t('Lieu'), d.incidentPlace],
      [t('Numéro de police'), d.insurancePolicyNumber],
      [t('Pièces jointes'), input.attachmentCount > 0 ? t('{n} fichier(s)', { n: input.attachmentCount }) : null]
    ] as Array<[string, string | null]>
  ).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));

  const steps = [
    t('Un gestionnaire sinistres vérifie votre déclaration et vous contacte si une information ou un document manque.'),
    t('Nous ouvrons le dossier auprès de votre compagnie d’assurance.'),
    t('Nous suivons l’indemnisation avec vous jusqu’à la clôture du dossier.')
  ];

  const greeting = t('Bonjour {name},', { name: d.firstName });
  const received = t('Nous avons bien reçu votre déclaration de sinistre. Merci d’avoir pris le temps de la compléter.');
  const pdfLine = t('Vous trouverez en pièce jointe le récapitulatif complet de votre déclaration au format PDF.');
  const referenceLine = (reference: string) => t('Mentionnez la référence {ref} dans tous vos échanges avec nous.', { ref: reference });
  const contactLine = (phone: string, email: string) =>
    t('Une question ou une urgence ? Appelez-nous au {phone} ou écrivez à {email}.', { phone, email });

  const subject = t('Votre déclaration de sinistre est bien reçue (réf. {ref})', { ref: input.reference });

  const text = [
    greeting,
    '',
    received,
    '',
    ...summary.map(([label, value]) => `${label}${input.language === 'fr' ? ' : ' : ': '}${value}`),
    '',
    hasPdf ? pdfLine : null,
    hasPdf ? '' : null,
    t('La suite :'),
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    referenceLine(input.reference),
    contactLine(OFFICE_PHONE, OFFICE_EMAIL),
    '',
    t('Bien à vous,'),
    t('L’équipe BDTS'),
    'Rue de Wand 29, 1020 Bruxelles'
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const summaryRows = summary
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 0;width:150px;vertical-align:top;font-size:13px;color:${MUTED};">${escapeHtml(label)}</td>
          <td style="padding:6px 0;vertical-align:top;font-size:14px;color:${INK};${label === t('Référence') ? `font-weight:700;color:${BRAND};` : ''}">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('');

  const stepRows = steps
    .map(
      (step, index) => `
        <tr>
          <td style="padding:6px 12px 6px 0;width:28px;vertical-align:top;">
            <div style="width:24px;height:24px;border-radius:12px;background:${BRAND};color:#ffffff;font-size:12px;font-weight:700;line-height:24px;text-align:center;">${index + 1}</div>
          </td>
          <td style="padding:8px 0 6px;vertical-align:top;font-size:14px;line-height:1.5;color:${INK};">${escapeHtml(step)}</td>
        </tr>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="${input.language}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAGE};font-family:Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND};padding:22px 28px;">
              <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#e7ead9;">${escapeHtml(t('BDTS · Déclaration de sinistre'))}</div>
              <div style="margin-top:6px;font-size:22px;font-weight:700;color:#ffffff;">${escapeHtml(t('Votre déclaration est bien reçue'))}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px 8px;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
              <p style="margin:0 0 12px;">${escapeHtml(received)}</p>
              ${hasPdf ? `<p style="margin:0;">${escapeHtml(pdfLine)}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL};border-radius:10px;">
                <tr><td style="padding:14px 18px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${summaryRows}
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 28px 4px;">
              <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:${BRAND};">${escapeHtml(t('La suite'))}</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${stepRows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 26px;font-size:14px;line-height:1.6;">
              <p style="margin:0 0 12px;">${escapeHtml(referenceLine('\u0000REF\u0000')).replace('\u0000REF\u0000', `<strong>${escapeHtml(input.reference)}</strong>`)}</p>
              <p style="margin:0;">${escapeHtml(contactLine('\u0000PHONE\u0000', '\u0000EMAIL\u0000'))
                .replace('\u0000PHONE\u0000', `<a href="${OFFICE_PHONE_LINK}" style="color:${BRAND};font-weight:700;text-decoration:none;">${OFFICE_PHONE}</a>`)
                .replace('\u0000EMAIL\u0000', `<a href="mailto:${OFFICE_EMAIL}" style="color:${BRAND};font-weight:700;text-decoration:none;">${OFFICE_EMAIL}</a>`)}</p>
              <p style="margin:18px 0 0;">${escapeHtml(t('Bien à vous,'))}<br>${escapeHtml(t('L’équipe BDTS'))}</p>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #e6e1d5;padding:14px 28px;font-size:12px;line-height:1.5;color:${MUTED};">
              BDTS · Rue de Wand 29, 1020 Bruxelles · ${OFFICE_PHONE}<br>
              ${escapeHtml(t('Vous recevez cet e-mail parce qu’une déclaration de sinistre a été envoyée avec cette adresse sur notre site.'))}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    to: d.email,
    subject,
    text,
    html,
    attachments: input.pdfBase64
      ? [{ filename: declarationPdfFilename(input.reference, input.language), contentBase64: input.pdfBase64 }]
      : undefined
  };
}
