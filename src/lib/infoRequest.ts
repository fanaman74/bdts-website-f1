import { createHash, randomBytes } from 'node:crypto';
import type { EmailMessage } from './email';
import type { DeclarationLanguage } from './declarationI18n';

/**
 * Asking a customer for the details a claim is missing. Staff pick the gaps
 * from the claim page; the customer gets one link, valid for a limited time,
 * where they can fill them in without an account.
 */

export const INFO_REQUEST_TTL_DAYS = 14;

/** The gaps a customer can fill in themselves (the insurer is staff's job). */
export const CUSTOMER_FILLABLE_ITEMS = [
  'policy',
  'date',
  'place',
  'circumstances',
  'photos',
  'counterparty',
  'counterparty-insurer',
  'witness',
  'phone',
  'address'
] as const;

export type FillableItem = (typeof CUSTOMER_FILLABLE_ITEMS)[number];

const ITEM_LABELS: Record<FillableItem, Record<DeclarationLanguage, string>> = {
  policy: { fr: 'Votre numéro de police', en: 'Your policy number', nl: 'Uw polisnummer' },
  date: { fr: 'La date du sinistre', en: 'The date of the incident', nl: 'De datum van het schadegeval' },
  place: { fr: 'Le lieu du sinistre', en: 'The place of the incident', nl: 'De plaats van het schadegeval' },
  circumstances: {
    fr: 'Une description détaillée des circonstances',
    en: 'A detailed description of what happened',
    nl: 'Een gedetailleerde beschrijving van wat er gebeurd is'
  },
  photos: {
    fr: 'Des photos ou documents (répondez à cet e-mail avec les pièces jointes)',
    en: 'Photos or documents (reply to this email with the attachments)',
    nl: 'Foto’s of documenten (antwoord op deze e-mail met de bijlagen)'
  },
  counterparty: { fr: 'Le nom de la partie adverse', en: 'The name of the other party', nl: 'De naam van de andere partij' },
  'counterparty-insurer': {
    fr: 'La compagnie d’assurance de la partie adverse',
    en: 'The insurer of the other party',
    nl: 'De verzekeraar van de andere partij'
  },
  witness: { fr: 'Les coordonnées du témoin', en: 'The witness’s contact details', nl: 'De contactgegevens van de getuige' },
  phone: { fr: 'Un numéro de téléphone joignable', en: 'A phone number we can reach you on', nl: 'Een telefoonnummer waarop we u kunnen bereiken' },
  address: { fr: 'Votre adresse complète', en: 'Your full address', nl: 'Uw volledig adres' }
};

const isFillable = (value: string): value is FillableItem => (CUSTOMER_FILLABLE_ITEMS as readonly string[]).includes(value);

/** Keeps only the ids a customer can act on, in their canonical order. */
export function fillableItems(ids: string[]): FillableItem[] {
  return CUSTOMER_FILLABLE_ITEMS.filter((item) => ids.includes(item));
}

export function itemLabel(item: string, language: DeclarationLanguage): string {
  return isFillable(item) ? ITEM_LABELS[item][language] : item;
}

/** A fresh link token: the raw value goes to the customer, its hash to the database. */
export function newInfoRequestToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashInfoRequestToken(token) };
}

export function hashInfoRequestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function infoRequestPath(token: string): string {
  return `/claim/complement/${token}`;
}

const COPY: Record<
  DeclarationLanguage,
  {
    subject: (ref: string) => string;
    heading: string;
    intro: string;
    listLabel: string;
    action: string;
    expiry: (days: number) => string;
    reference: (ref: string) => string;
    contact: string;
    signoff: string;
    team: string;
    footer: string;
  }
> = {
  fr: {
    subject: (ref) => `Votre dossier sinistre ${ref} : informations complémentaires`,
    heading: 'Il nous manque quelques informations',
    intro: 'Pour avancer sur votre dossier auprès de votre compagnie, pourriez-vous nous transmettre les éléments suivants ?',
    listLabel: 'Ce qu’il nous faut :',
    action: 'Compléter mon dossier',
    expiry: (days) => `Ce lien reste valable ${days} jours.`,
    reference: (ref) => `Votre référence : ${ref}`,
    contact: 'Une question ? Appelez-nous au +32 2 463 19 25 ou écrivez à bdts@bdts.be.',
    signoff: 'Bien à vous,',
    team: 'L’équipe BDTS',
    footer: 'Vous recevez cet e-mail parce que vous avez déclaré un sinistre sur le site de BDTS.'
  },
  en: {
    subject: (ref) => `Your claim ${ref}: additional information needed`,
    heading: 'We need a few more details',
    intro: 'To move your claim forward with your insurance company, could you send us the following?',
    listLabel: 'What we need:',
    action: 'Complete my claim',
    expiry: (days) => `This link stays valid for ${days} days.`,
    reference: (ref) => `Your reference: ${ref}`,
    contact: 'Any questions? Call us on +32 2 463 19 25 or write to bdts@bdts.be.',
    signoff: 'Kind regards,',
    team: 'The BDTS team',
    footer: 'You are receiving this email because you declared a claim on the BDTS website.'
  },
  nl: {
    subject: (ref) => `Uw schadedossier ${ref}: aanvullende informatie nodig`,
    heading: 'We hebben nog enkele gegevens nodig',
    intro: 'Om uw dossier bij uw verzekeraar verder te brengen, kunt u ons het volgende bezorgen?',
    listLabel: 'Wat we nodig hebben:',
    action: 'Mijn dossier aanvullen',
    expiry: (days) => `Deze link blijft ${days} dagen geldig.`,
    reference: (ref) => `Uw referentie: ${ref}`,
    contact: 'Vragen? Bel ons op +32 2 463 19 25 of schrijf naar bdts@bdts.be.',
    signoff: 'Met vriendelijke groeten,',
    team: 'Het BDTS-team',
    footer: 'U ontvangt deze e-mail omdat u een schade hebt aangegeven op de website van BDTS.'
  }
};

export const infoRequestCopy = (language: DeclarationLanguage) => COPY[language];

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildInfoRequestEmail(input: {
  to: string;
  firstName: string;
  reference: string;
  language: DeclarationLanguage;
  items: string[];
  url: string;
  replyTo?: string;
}): EmailMessage {
  const c = COPY[input.language];
  const labels = input.items.map((item) => itemLabel(item, input.language));
  const greeting = input.language === 'fr' ? `Bonjour ${input.firstName},` : input.language === 'nl' ? `Beste ${input.firstName},` : `Hello ${input.firstName},`;

  const text = [
    greeting,
    '',
    c.intro,
    '',
    c.listLabel,
    ...labels.map((label) => `- ${label}`),
    '',
    `${c.action} : ${input.url}`,
    c.expiry(INFO_REQUEST_TTL_DAYS),
    '',
    c.reference(input.reference),
    c.contact,
    '',
    c.signoff,
    c.team
  ].join('\n');

  const html = `<!doctype html>
<html lang="${input.language}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(c.subject(input.reference))}</title></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Helvetica,Arial,sans-serif;color:#2f2b24;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#606c38;padding:22px 28px;">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#e7ead9;">BDTS · ${escapeHtml(input.reference)}</div>
          <div style="margin-top:6px;font-size:22px;font-weight:700;color:#ffffff;">${escapeHtml(c.heading)}</div>
        </td></tr>
        <tr><td style="padding:26px 28px;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 12px;">${escapeHtml(c.intro)}</p>
          <p style="margin:0 0 6px;font-weight:700;">${escapeHtml(c.listLabel)}</p>
          <ul style="margin:0 0 18px;padding-left:20px;">${labels.map((label) => `<li>${escapeHtml(label)}</li>`).join('')}</ul>
          <p style="margin:0 0 6px;"><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#606c38;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;">${escapeHtml(c.action)}</a></p>
          <p style="margin:0 0 18px;font-size:13px;color:#77705f;">${escapeHtml(c.expiry(INFO_REQUEST_TTL_DAYS))}</p>
          <p style="margin:0 0 6px;font-size:13px;color:#77705f;">${escapeHtml(c.reference(input.reference))}</p>
          <p style="margin:0 0 12px;font-size:13px;color:#77705f;">${escapeHtml(c.contact)}</p>
          <p style="margin:0;">${escapeHtml(c.signoff)}<br>${escapeHtml(c.team)}</p>
        </td></tr>
        <tr><td style="padding:14px 28px;background:#f4f1ea;font-size:12px;color:#77705f;">${escapeHtml(c.footer)}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    to: input.to,
    subject: c.subject(input.reference),
    text,
    html,
    ...(input.replyTo ? { replyTo: input.replyTo } : {})
  };
}
