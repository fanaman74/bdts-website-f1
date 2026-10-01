import { declarationTitleLabel, type DeclarationInput } from './declarations';

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
function streetLine(street: string | null, number: string | null, bus: string | null): string | null {
  const parts = [street, number].map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  const line = parts.join(' ');
  return bus?.trim() ? `${line} bte ${bus.trim()}` : line;
}

/** 2026-09-14 → 14/09/2026; anything else is shown as stored. */
export function formatDeclarationDate(value: string | null): string | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function declarationSections(d: DeclarationInput): DeclarationSection[] {
  const contactDetails: Array<[string, string | null]> = [
    ['Titre', declarationTitleLabel(d.personTitle)],
    ['Nom', d.lastName],
    ['Prénom', d.firstName],
    ['Date de naissance', formatDeclarationDate(d.dateOfBirth)],
    ['Adresse', streetLine(d.street, d.streetNumber, d.bus)],
    ['Code postal', d.postalCode],
    ['Commune', d.city],
    ['Pays', d.country],
    ['Société', d.company],
    ['Téléphone fixe', d.phoneFixed],
    ['GSM', d.phoneMobile],
    ['Adresse e-mail', d.email]
  ];

  const incidentDetails: Array<[string, string | null]> = [
    ['Personne ou bien assuré', d.insuredPersonOrItem],
    ['Numéro de police', d.insurancePolicyNumber],
    ['Date du sinistre', formatDeclarationDate(d.incidentDate)],
    ['Heure du sinistre', d.incidentTime?.slice(0, 5) ?? null],
    ['Lieu du sinistre', d.incidentPlace],
    ['Circonstances', d.incidentCircumstances]
  ];

  const witnessDetails: Array<[string, string | null]> = [
    ['Titre', declarationTitleLabel(d.witnessTitle)],
    ['Nom', d.witnessLastName],
    ['Prénom', d.witnessFirstName],
    ['Adresse', streetLine(d.witnessStreet, d.witnessStreetNumber, d.witnessBus)],
    ['Code postal', d.witnessPostalCode],
    ['Commune', d.witnessCity],
    ['Pays', d.witnessCountry],
    ['Téléphone', d.witnessPhone]
  ];

  const counterpartyDetails: Array<[string, string | null]> = [
    ['Titre', declarationTitleLabel(d.counterpartyTitle)],
    ['Nom', d.counterpartyLastName],
    ['Prénom', d.counterpartyFirstName],
    ['Adresse', streetLine(d.counterpartyStreet, d.counterpartyStreetNumber, d.counterpartyBus)],
    ['Code postal', d.counterpartyPostalCode],
    ['Commune', d.counterpartyCity],
    ['Pays', d.counterpartyCountry],
    ['Téléphone', d.counterpartyPhone],
    ["Compagnie d'assurance", d.counterpartyInsuranceCompany],
    ['Numéro de police', d.counterpartyInsurancePolicyNumber]
  ];

  return [
    { title: 'Mes informations de contact', rows: filled(contactDetails), note: null },
    { title: 'Identification du sinistre', rows: filled(incidentDetails), note: null },
    {
      title: 'Témoin',
      rows: d.witnessPresent ? filled(witnessDetails) : [],
      note: d.witnessPresent ? null : 'Aucun témoin signalé.'
    },
    {
      title: 'Partie adverse',
      rows: d.counterpartyPresent ? filled(counterpartyDetails) : [],
      note: d.counterpartyPresent ? null : 'Aucune partie adverse signalée.'
    },
    { title: 'Remarques', rows: filled([['Remarques éventuelles', d.remarks]]), note: null }
  ];
}
