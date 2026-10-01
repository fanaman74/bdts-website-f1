/**
 * Translations for what a customer receives after declaring a claim (the PDF
 * summary and the confirmation email), so both follow the language they used
 * on the site. French is the source: every key is the French text, and a
 * missing translation falls back to it.
 */

export const DECLARATION_LANGUAGES = ['fr', 'en', 'nl'] as const;
export type DeclarationLanguage = (typeof DECLARATION_LANGUAGES)[number];

export function toDeclarationLanguage(value: unknown): DeclarationLanguage {
  const code = typeof value === 'string' ? value.trim().toLowerCase().slice(0, 2) : '';
  return (DECLARATION_LANGUAGES as readonly string[]).includes(code) ? (code as DeclarationLanguage) : 'fr';
}

/** Locale for dates in the PDF and email. */
export const DECLARATION_LOCALES: Record<DeclarationLanguage, string> = {
  fr: 'fr-BE',
  en: 'en-GB',
  nl: 'nl-BE'
};

type Translations = Record<string, string>;

const en: Translations = {
  // Sections and fields
  'Mes informations de contact': 'My contact details',
  'Identification du sinistre': 'Claim details',
  'Témoin': 'Witness',
  'Partie adverse': 'Other party',
  'Remarques': 'Remarks',
  'Pièces jointes': 'Attachments',
  'Aucun témoin signalé.': 'No witness reported.',
  'Aucune partie adverse signalée.': 'No other party reported.',
  'Aucun fichier joint.': 'No files attached.',
  'Titre': 'Title',
  'Monsieur': 'Mr',
  'Madame': 'Mrs',
  'Nom': 'Last name',
  'Prénom': 'First name',
  'Date de naissance': 'Date of birth',
  'Adresse': 'Address',
  'bte': 'box',
  'Code postal': 'Postcode',
  'Commune': 'Town',
  'Pays': 'Country',
  'Société': 'Company',
  'Téléphone fixe': 'Landline',
  'GSM': 'Mobile',
  'Téléphone': 'Phone',
  'Adresse e-mail': 'Email address',
  'Personne ou bien assuré': 'Insured person or property',
  'Numéro de police': 'Policy number',
  'Date du sinistre': 'Date of the incident',
  'Heure du sinistre': 'Time of the incident',
  'Lieu du sinistre': 'Place of the incident',
  'Circonstances': 'Circumstances',
  "Compagnie d'assurance": 'Insurance company',
  'Remarques éventuelles': 'Additional remarks',
  'Fichier {n}': 'File {n}',
  'Belgique': 'Belgium',
  'France': 'France',
  'Pays-Bas': 'Netherlands',
  'Luxembourg': 'Luxembourg',
  'Allemagne': 'Germany',
  'Royaume-Uni': 'United Kingdom',
  'Espagne': 'Spain',
  'Italie': 'Italy',

  // PDF
  'Déclaration de sinistre': 'Claim declaration',
  'Récapitulatif de votre déclaration en ligne': 'Summary of your online claim',
  'Récapitulatif de déclaration de sinistre': 'Claim declaration summary',
  'Référence': 'Reference',
  'Reçue le': 'Received on',
  'Ce document reprend les informations que vous nous avez transmises via notre site. Il ne constitue pas une acceptation du sinistre par la compagnie d’assurance. Conservez la référence ci-dessus pour tout échange avec notre bureau.':
    'This document lists the information you sent us through our website. It does not mean the insurer has accepted the claim. Please quote the reference above whenever you contact our office.',
  'declaration-sinistre': 'claim-declaration',

  // Email
  'Votre déclaration de sinistre est bien reçue (réf. {ref})': 'We have received your claim (ref. {ref})',
  'Votre déclaration est bien reçue': 'We have received your claim',
  'BDTS · Déclaration de sinistre': 'BDTS · Claim declaration',
  'Bonjour {name},': 'Hello {name},',
  'Nous avons bien reçu votre déclaration de sinistre. Merci d’avoir pris le temps de la compléter.':
    'We have received your claim. Thank you for taking the time to fill it in.',
  'Vous trouverez en pièce jointe le récapitulatif complet de votre déclaration au format PDF.':
    'Attached is a full summary of your claim as a PDF.',
  'Lieu': 'Place',
  '{date} à {time}': '{date} at {time}',
  '{n} fichier(s)': '{n} file(s)',
  'La suite': 'What happens next',
  'La suite :': 'What happens next:',
  'Un gestionnaire sinistres vérifie votre déclaration et vous contacte si une information ou un document manque.':
    'A claims handler checks your claim and contacts you if any information or document is missing.',
  'Nous ouvrons le dossier auprès de votre compagnie d’assurance.': 'We open the claim with your insurance company.',
  'Nous suivons l’indemnisation avec vous jusqu’à la clôture du dossier.':
    'We follow up on the settlement with you until the claim is closed.',
  'Mentionnez la référence {ref} dans tous vos échanges avec nous.': 'Please quote reference {ref} whenever you contact us.',
  'Une question ou une urgence ? Appelez-nous au {phone} ou écrivez à {email}.':
    'A question or an emergency? Call us on {phone} or email {email}.',
  'Bien à vous,': 'Kind regards,',
  'L’équipe BDTS': 'The BDTS team',
  'Vous recevez cet e-mail parce qu’une déclaration de sinistre a été envoyée avec cette adresse sur notre site.':
    'You are receiving this email because a claim was submitted with this address on our website.'
};

const nl: Translations = {
  // Sections and fields
  'Mes informations de contact': 'Mijn contactgegevens',
  'Identification du sinistre': 'Gegevens van het schadegeval',
  'Témoin': 'Getuige',
  'Partie adverse': 'Tegenpartij',
  'Remarques': 'Opmerkingen',
  'Pièces jointes': 'Bijlagen',
  'Aucun témoin signalé.': 'Geen getuige gemeld.',
  'Aucune partie adverse signalée.': 'Geen tegenpartij gemeld.',
  'Aucun fichier joint.': 'Geen bestanden bijgevoegd.',
  'Titre': 'Aanspreking',
  'Monsieur': 'De heer',
  'Madame': 'Mevrouw',
  'Nom': 'Naam',
  'Prénom': 'Voornaam',
  'Date de naissance': 'Geboortedatum',
  'Adresse': 'Adres',
  'bte': 'bus',
  'Code postal': 'Postcode',
  'Commune': 'Gemeente',
  'Pays': 'Land',
  'Société': 'Bedrijf',
  'Téléphone fixe': 'Vaste telefoon',
  'GSM': 'Gsm',
  'Téléphone': 'Telefoon',
  'Adresse e-mail': 'E-mailadres',
  'Personne ou bien assuré': 'Verzekerde persoon of verzekerd goed',
  'Numéro de police': 'Polisnummer',
  'Date du sinistre': 'Datum van het schadegeval',
  'Heure du sinistre': 'Uur van het schadegeval',
  'Lieu du sinistre': 'Plaats van het schadegeval',
  'Circonstances': 'Omstandigheden',
  "Compagnie d'assurance": 'Verzekeringsmaatschappij',
  'Remarques éventuelles': 'Eventuele opmerkingen',
  'Fichier {n}': 'Bestand {n}',
  'Belgique': 'België',
  'France': 'Frankrijk',
  'Pays-Bas': 'Nederland',
  'Luxembourg': 'Luxemburg',
  'Allemagne': 'Duitsland',
  'Royaume-Uni': 'Verenigd Koninkrijk',
  'Espagne': 'Spanje',
  'Italie': 'Italië',

  // PDF
  'Déclaration de sinistre': 'Schadeaangifte',
  'Récapitulatif de votre déclaration en ligne': 'Overzicht van uw online aangifte',
  'Récapitulatif de déclaration de sinistre': 'Overzicht van de schadeaangifte',
  'Référence': 'Referentie',
  'Reçue le': 'Ontvangen op',
  'Ce document reprend les informations que vous nous avez transmises via notre site. Il ne constitue pas une acceptation du sinistre par la compagnie d’assurance. Conservez la référence ci-dessus pour tout échange avec notre bureau.':
    'Dit document bevat de gegevens die u ons via onze website hebt bezorgd. Het betekent niet dat de verzekeraar het schadegeval aanvaardt. Vermeld de referentie hierboven bij elk contact met ons kantoor.',
  'declaration-sinistre': 'schadeaangifte',

  // Email
  'Votre déclaration de sinistre est bien reçue (réf. {ref})': 'Uw schadeaangifte is goed ontvangen (ref. {ref})',
  'Votre déclaration est bien reçue': 'Uw aangifte is goed ontvangen',
  'BDTS · Déclaration de sinistre': 'BDTS · Schadeaangifte',
  'Bonjour {name},': 'Beste {name},',
  'Nous avons bien reçu votre déclaration de sinistre. Merci d’avoir pris le temps de la compléter.':
    'We hebben uw schadeaangifte goed ontvangen. Bedankt om de tijd te nemen ze in te vullen.',
  'Vous trouverez en pièce jointe le récapitulatif complet de votre déclaration au format PDF.':
    'In bijlage vindt u een volledig overzicht van uw aangifte in pdf.',
  'Lieu': 'Plaats',
  '{date} à {time}': '{date} om {time}',
  '{n} fichier(s)': '{n} bestand(en)',
  'La suite': 'Hoe gaat het verder?',
  'La suite :': 'Hoe gaat het verder?',
  'Un gestionnaire sinistres vérifie votre déclaration et vous contacte si une information ou un document manque.':
    'Een schadebeheerder controleert uw aangifte en neemt contact met u op als er informatie of een document ontbreekt.',
  'Nous ouvrons le dossier auprès de votre compagnie d’assurance.': 'We openen het dossier bij uw verzekeringsmaatschappij.',
  'Nous suivons l’indemnisation avec vous jusqu’à la clôture du dossier.':
    'We volgen de schadevergoeding samen met u op tot het dossier is afgesloten.',
  'Mentionnez la référence {ref} dans tous vos échanges avec nous.': 'Vermeld referentie {ref} bij elk contact met ons.',
  'Une question ou une urgence ? Appelez-nous au {phone} ou écrivez à {email}.':
    'Een vraag of een dringend geval? Bel ons op {phone} of mail naar {email}.',
  'Bien à vous,': 'Met vriendelijke groeten,',
  'L’équipe BDTS': 'Het BDTS-team',
  'Vous recevez cet e-mail parce qu’une déclaration de sinistre a été envoyée avec cette adresse sur notre site.':
    'U ontvangt deze e-mail omdat er met dit adres een schadeaangifte werd verstuurd via onze website.'
};

const TRANSLATIONS: Record<DeclarationLanguage, Translations> = { fr: {}, en, nl };

/** Translates a French source string, filling {placeholders} from `values`. */
export function declarationText(
  language: DeclarationLanguage,
  french: string,
  values: Record<string, string | number> = {}
): string {
  const template = TRANSLATIONS[language][french] ?? french;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
