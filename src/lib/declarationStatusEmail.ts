import type { EmailMessage } from './email';
import type { DeclarationLanguage } from './declarationI18n';
import type { DeclarationStatus } from './declarations';

/**
 * The short email a customer receives when the office moves their claim
 * forward, in the language they declared in.
 *
 * Only the steps a customer cares about are announced: the claim being taken
 * in hand and the claim being closed. Going back to "Nouveau" or marking a
 * submission as spam never emails anyone.
 */

export const CUSTOMER_NOTIFIED_STATUSES: ReadonlySet<DeclarationStatus> = new Set(['in_progress', 'closed']);

type Copy = {
  subject: (ref: string) => string;
  heading: Record<'in_progress' | 'closed', string>;
  line: Record<'in_progress' | 'closed', string>;
  greeting: (name: string) => string;
  messageLabel: string;
  reference: (ref: string) => string;
  contact: string;
  signoff: string;
  team: string;
  footer: string;
};

const COPY: Record<DeclarationLanguage, Copy> = {
  fr: {
    subject: (ref) => `Votre dossier sinistre ${ref} : mise à jour`,
    heading: { in_progress: 'Votre dossier est en cours de traitement', closed: 'Votre dossier est clôturé' },
    line: {
      in_progress: 'Un gestionnaire sinistres a pris votre déclaration en charge et suit le dossier auprès de votre compagnie d’assurance.',
      closed: 'Le traitement de votre déclaration de sinistre est terminé et le dossier est clôturé.'
    },
    greeting: (name) => `Bonjour ${name},`,
    messageLabel: 'Message de votre gestionnaire :',
    reference: (ref) => `Votre référence : ${ref}`,
    contact: 'Une question ? Appelez-nous au +32 2 463 19 25 ou écrivez à bdts@bdts.be.',
    signoff: 'Bien à vous,',
    team: 'L’équipe BDTS',
    footer: 'Vous recevez cet e-mail parce que vous avez déclaré un sinistre sur le site de BDTS.'
  },
  en: {
    subject: (ref) => `Your claim ${ref}: update`,
    heading: { in_progress: 'Your claim is being handled', closed: 'Your claim is closed' },
    line: {
      in_progress: 'A claims handler has taken charge of your claim and is following it up with your insurance company.',
      closed: 'We have finished handling your claim and the file is now closed.'
    },
    greeting: (name) => `Hello ${name},`,
    messageLabel: 'Message from your claims handler:',
    reference: (ref) => `Your reference: ${ref}`,
    contact: 'Any questions? Call us on +32 2 463 19 25 or write to bdts@bdts.be.',
    signoff: 'Kind regards,',
    team: 'The BDTS team',
    footer: 'You are receiving this email because you declared a claim on the BDTS website.'
  },
  nl: {
    subject: (ref) => `Uw schadedossier ${ref}: update`,
    heading: { in_progress: 'Uw dossier wordt behandeld', closed: 'Uw dossier is afgesloten' },
    line: {
      in_progress: 'Een schadebeheerder heeft uw aangifte in behandeling genomen en volgt het dossier op bij uw maatschappij.',
      closed: 'De behandeling van uw schadeaangifte is afgerond en het dossier is afgesloten.'
    },
    greeting: (name) => `Beste ${name},`,
    messageLabel: 'Bericht van uw schadebeheerder:',
    reference: (ref) => `Uw referentie: ${ref}`,
    contact: 'Vragen? Bel ons op +32 2 463 19 25 of schrijf naar bdts@bdts.be.',
    signoff: 'Met vriendelijke groeten,',
    team: 'Het BDTS-team',
    footer: 'U ontvangt deze e-mail omdat u een schade hebt aangegeven op de website van BDTS.'
  }
};

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

export interface StatusEmailInput {
  to: string;
  firstName: string;
  reference: string;
  status: 'in_progress' | 'closed';
  language: DeclarationLanguage;
  /** Optional words from the handler, shown as typed. */
  message: string | null;
  replyTo?: string;
}

export function buildStatusEmail(input: StatusEmailInput): EmailMessage {
  const c = COPY[input.language];
  const message = input.message?.trim() || null;
  const subject = c.subject(input.reference);

  const text = [
    c.greeting(input.firstName),
    '',
    c.heading[input.status] + '.',
    c.line[input.status],
    ...(message ? ['', c.messageLabel, message] : []),
    '',
    c.reference(input.reference),
    c.contact,
    '',
    c.signoff,
    c.team
  ].join('\n');

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
              <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#e7ead9;">BDTS · ${escapeHtml(input.reference)}</div>
              <div style="margin-top:6px;font-size:22px;font-weight:700;color:#ffffff;">${escapeHtml(c.heading[input.status])}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px 8px;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 12px;">${escapeHtml(c.greeting(input.firstName))}</p>
              <p style="margin:0 0 12px;">${escapeHtml(c.line[input.status])}</p>
            </td>
          </tr>
          ${
            message
              ? `<tr>
            <td style="padding:8px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL};border-radius:10px;">
                <tr><td style="padding:14px 18px;font-size:14px;line-height:1.6;">
                  <div style="font-size:12px;color:${MUTED};margin-bottom:6px;">${escapeHtml(c.messageLabel)}</div>
                  ${escapeHtml(message).replace(/\n/g, '<br>')}
                </td></tr>
              </table>
            </td>
          </tr>`
              : ''
          }
          <tr>
            <td style="padding:16px 28px 26px;font-size:14px;line-height:1.6;">
              <p style="margin:0 0 12px;"><strong>${escapeHtml(c.reference(input.reference))}</strong></p>
              <p style="margin:0;">${escapeHtml(c.contact)}</p>
              <p style="margin:18px 0 0;">${escapeHtml(c.signoff)}<br>${escapeHtml(c.team)}</p>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #e6e1d5;padding:14px 28px;font-size:12px;line-height:1.5;color:${MUTED};">
              BDTS · Rue de Wand 29, 1020 Bruxelles · +32 2 463 19 25<br>${escapeHtml(c.footer)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { to: input.to, subject, text, html, ...(input.replyTo ? { replyTo: input.replyTo } : {}) };
}
