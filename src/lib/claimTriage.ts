import {
  insurersFromHistory,
  setDeclarationInsurer,
  type Declaration,
  type DeclarationInput,
  type InsurerSource
} from './declarations';
import { insurersMentionedIn } from './insurers';

/**
 * Sorting a new claim: which insurer it goes to, and what is missing before it
 * can be sent there.
 *
 * Nothing here is final. A match is a suggestion staff can change on the claim
 * page, and every manual choice becomes history the next claim is matched on.
 */

export interface InsurerMatch {
  insurer: string;
  source: Exclude<InsurerSource, 'manual'>;
}

/**
 * The best insurer guess for a claim, or null when there is no single clear
 * answer. An earlier claim on the same policy number wins; then the insurer of
 * the customer's earlier claims, if they all agree; then an insurer the
 * customer named next to their own policy (never the third party's).
 */
export async function matchInsurer(
  declaration: Pick<Declaration, 'id' | 'email' | 'insurancePolicyNumber'> &
    Pick<DeclarationInput, 'insuredPersonOrItem' | 'remarks'>
): Promise<InsurerMatch | null> {
  const history = await insurersFromHistory(declaration);
  if (history.byPolicy.length === 1) return { insurer: history.byPolicy[0]!, source: 'policy' };
  if (history.byPolicy.length === 0 && history.byCustomer.length === 1) {
    return { insurer: history.byCustomer[0]!, source: 'customer' };
  }

  const ownText = [declaration.insurancePolicyNumber, declaration.insuredPersonOrItem, declaration.remarks]
    .filter(Boolean)
    .join('\n');
  const mentioned = insurersMentionedIn(ownText);
  if (mentioned.length === 1) return { insurer: mentioned[0]!, source: 'text' };

  return null;
}

/**
 * Runs the match for a claim that was just saved and stores it. Never throws:
 * the claim is already saved and must not fail on its triage.
 */
export async function autoAssignInsurer(
  id: string,
  declaration: Pick<DeclarationInput, 'email' | 'insurancePolicyNumber' | 'insuredPersonOrItem' | 'remarks'>
): Promise<InsurerMatch | null> {
  try {
    const match = await matchInsurer({ id, ...declaration });
    if (match) await setDeclarationInsurer(id, match.insurer, match.source);
    return match;
  } catch (error) {
    console.error('[triage] Insurer match failed:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

export interface MissingItem {
  id: string;
  label: string;
  /** Blocking items are what an insurer will ask for before opening a file. */
  blocking: boolean;
}

/** What the claim lacks, most important first. */
export function missingInfo(
  d: DeclarationInput & Pick<Declaration, 'attachmentCount' | 'imageCount' | 'insurer'>
): MissingItem[] {
  const items: MissingItem[] = [];
  const blank = (value: string | null) => !value || value.trim().length === 0;

  if (blank(d.insurancePolicyNumber)) items.push({ id: 'policy', label: 'N° de police manquant', blocking: true });
  if (!d.insurer) items.push({ id: 'insurer', label: 'Assureur non identifié', blocking: true });
  if (blank(d.incidentDate)) items.push({ id: 'date', label: 'Date du sinistre manquante', blocking: true });
  if (blank(d.incidentCircumstances)) {
    items.push({ id: 'circumstances', label: 'Circonstances non décrites', blocking: true });
  } else if (d.incidentCircumstances!.trim().length < 40) {
    items.push({ id: 'circumstances', label: 'Circonstances très brèves', blocking: false });
  }
  if (d.attachmentCount === 0) {
    items.push({ id: 'photos', label: 'Aucune photo ni document', blocking: false });
  } else if (d.imageCount === 0) {
    items.push({ id: 'photos', label: 'Aucune photo', blocking: false });
  }
  if (blank(d.incidentPlace)) items.push({ id: 'place', label: 'Lieu du sinistre manquant', blocking: false });
  if (d.counterpartyPresent) {
    if (blank(d.counterpartyLastName)) {
      items.push({ id: 'counterparty', label: 'Nom de la partie adverse manquant', blocking: false });
    }
    if (blank(d.counterpartyInsuranceCompany)) {
      items.push({ id: 'counterparty-insurer', label: 'Assureur de la partie adverse manquant', blocking: false });
    }
  }
  if (d.witnessPresent && blank(d.witnessLastName) && blank(d.witnessPhone)) {
    items.push({ id: 'witness', label: 'Coordonnées du témoin manquantes', blocking: false });
  }
  if (blank(d.phoneMobile) && blank(d.phoneFixed)) {
    items.push({ id: 'phone', label: 'Aucun numéro de téléphone', blocking: false });
  }
  if (blank(d.street) || blank(d.postalCode) || blank(d.city)) {
    items.push({ id: 'address', label: 'Adresse incomplète', blocking: false });
  }

  return items.sort((a, b) => Number(b.blocking) - Number(a.blocking));
}
