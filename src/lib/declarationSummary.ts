import { declarationTitleLabel, type DeclarationInput } from './declarations';
import { declarationText, type DeclarationLanguage } from './declarationI18n';

/**
 * The human-readable shape of a claim declaration, shared by the admin detail
 * page, the PDF summary and the confirmation email so all three list the same
 * fields under the same labels.
 */

export interface DeclarationSection {
  title: string;
  rows: Array<[label: string, value: string]>;
  /** Shown instead of rows when the section was answered "no". */
  note: string | null;
}

/**
 * The reference given to the customer: short enough to read over the phone,
 * derived from the declaration id so the office can find the file from it.
 */
export function declarationReference(id: string): string {
  return `SIN-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/** Drops the empty lines so only what was filled in is shown. */
function filled(entries: Array<[string, string | null]>): Array<[string, string]> {
  return entries
    .map(([label, value]) => [label, (value ?? '').trim()] as [string, string])
    .filter(([, value]) => value.length > 0);
}

/** Street, number and box on one line, the way it is read on an envelope. */
function streetLine(street: string | null, number: string | null, bus: string | null, busWord = 'bte'): string | null {
  const parts = [street, number].map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  const line = parts.join(' ');
  return bus?.trim() ? `${line} ${busWord} ${bus.trim()}` : line;
}

/** 2026-09-14 → 14/09/2026; anything else is shown as stored. */
export function formatDeclarationDate(value: string | null): string | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** The sections in `language`; the admin area uses the French default. */
export function declarationSections(d: DeclarationInput, language: DeclarationLanguage = 'fr'): DeclarationSection[] {
  const t = (french: string) => declarationText(language, french);
  const title = (code: string | null) => {
    const label = declarationTitleLabel(code);
    return label ? t(label) : null;
  };
  // Country names come from the French list on the form; the common ones are translated.
  const country = (value: string | null) => (value ? t(value) : null);
  const street = (name: string | null, number: string | null, bus: string | null) => streetLine(name, number, bus, t('bte'));

  const contactDetails: Array<[string, string | null]> = [
    [t('Titre'), title(d.personTitle)],
    [t('Nom'), d.lastName],
    [t('Prénom'), d.firstName],
    [t('Date de naissance'), formatDeclarationDate(d.dateOfBirth)],
    [t('Adresse'), street(d.street, d.streetNumber, d.bus)],
    [t('Code postal'), d.postalCode],
    [t('Commune'), d.city],
    [t('Pays'), country(d.country)],
    [t('Société'), d.company],
    [t('Téléphone fixe'), d.phoneFixed],
    [t('GSM'), d.phoneMobile],
    [t('Adresse e-mail'), d.email]
  ];

  const incidentDetails: Array<[string, string | null]> = [
    [t('Personne ou bien assuré'), d.insuredPersonOrItem],
    [t('Numéro de police'), d.insurancePolicyNumber],
    [t('Date du sinistre'), formatDeclarationDate(d.incidentDate)],
    [t('Heure du sinistre'), d.incidentTime?.slice(0, 5) ?? null],
    [t('Lieu du sinistre'), d.incidentPlace],
    [t('Circonstances'), d.incidentCircumstances]
  ];

  const witnessDetails: Array<[string, string | null]> = [
    [t('Titre'), title(d.witnessTitle)],
    [t('Nom'), d.witnessLastName],
    [t('Prénom'), d.witnessFirstName],
    [t('Adresse'), street(d.witnessStreet, d.witnessStreetNumber, d.witnessBus)],
    [t('Code postal'), d.witnessPostalCode],
    [t('Commune'), d.witnessCity],
    [t('Pays'), country(d.witnessCountry)],
    [t('Téléphone'), d.witnessPhone]
  ];

  const counterpartyDetails: Array<[string, string | null]> = [
    [t('Titre'), title(d.counterpartyTitle)],
    [t('Nom'), d.counterpartyLastName],
    [t('Prénom'), d.counterpartyFirstName],
    [t('Adresse'), street(d.counterpartyStreet, d.counterpartyStreetNumber, d.counterpartyBus)],
    [t('Code postal'), d.counterpartyPostalCode],
    [t('Commune'), d.counterpartyCity],
    [t('Pays'), country(d.counterpartyCountry)],
    [t('Téléphone'), d.counterpartyPhone],
    [t("Compagnie d'assurance"), d.counterpartyInsuranceCompany],
    [t('Numéro de police'), d.counterpartyInsurancePolicyNumber]
  ];

  return [
    { title: t('Mes informations de contact'), rows: filled(contactDetails), note: null },
    { title: t('Identification du sinistre'), rows: filled(incidentDetails), note: null },
    {
      title: t('Témoin'),
      rows: d.witnessPresent ? filled(witnessDetails) : [],
      note: d.witnessPresent ? null : t('Aucun témoin signalé.')
    },
    {
      title: t('Partie adverse'),
      rows: d.counterpartyPresent ? filled(counterpartyDetails) : [],
      note: d.counterpartyPresent ? null : t('Aucune partie adverse signalée.')
    },
    { title: t('Remarques'), rows: filled([[t('Remarques éventuelles'), d.remarks]]), note: null }
  ];
}
