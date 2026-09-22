import type { APIRoute } from 'astro';
import { DECLARATION_STATUS_LABELS, listDeclarations, type DeclarationStatus } from '../../lib/declarations';

export const prerender = false;

/** Quotes a CSV field, doubling embedded quotes. */
function field(value: string | number | null): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

const yesNo = (value: boolean) => (value ? 'oui' : 'non');

/**
 * CSV export of the declarations currently filtered in the admin list.
 * Protected by the same middleware as the rest of /admin.
 */
export const GET: APIRoute = async ({ url }) => {
  const rows = await listDeclarations({
    status: url.searchParams.get('status') ?? '',
    search: url.searchParams.get('q')?.trim() ?? '',
    order: 'newest',
    limit: 500
  });

  const header = [
    'reference',
    'recu_le',
    'statut',
    'titre',
    'nom',
    'prenom',
    'date_naissance',
    'rue',
    'numero',
    'boite',
    'code_postal',
    'commune',
    'pays',
    'societe',
    'telephone_fixe',
    'gsm',
    'email',
    'bien_assure',
    'numero_police',
    'date_sinistre',
    'heure_sinistre',
    'lieu_sinistre',
    'circonstances',
    'temoin',
    'temoin_nom',
    'temoin_prenom',
    'temoin_telephone',
    'partie_adverse',
    'adversaire_nom',
    'adversaire_prenom',
    'adversaire_assurance',
    'adversaire_police',
    'remarques',
    'pieces_jointes'
  ];

  const lines = [
    header.join(','),
    ...rows.map((declaration) =>
      [
        declaration.id,
        declaration.createdAt,
        DECLARATION_STATUS_LABELS[declaration.status as DeclarationStatus] ?? declaration.status,
        declaration.personTitle,
        declaration.lastName,
        declaration.firstName,
        declaration.dateOfBirth,
        declaration.street,
        declaration.streetNumber,
        declaration.bus,
        declaration.postalCode,
        declaration.city,
        declaration.country,
        declaration.company,
        declaration.phoneFixed,
        declaration.phoneMobile,
        declaration.email,
        declaration.insuredPersonOrItem,
        declaration.insurancePolicyNumber,
        declaration.incidentDate,
        declaration.incidentTime,
        declaration.incidentPlace,
        declaration.incidentCircumstances,
        yesNo(declaration.witnessPresent),
        declaration.witnessLastName,
        declaration.witnessFirstName,
        declaration.witnessPhone,
        yesNo(declaration.counterpartyPresent),
        declaration.counterpartyLastName,
        declaration.counterpartyFirstName,
        declaration.counterpartyInsuranceCompany,
        declaration.counterpartyInsurancePolicyNumber,
        declaration.remarks,
        declaration.attachmentCount
      ]
        .map(field)
        .join(',')
    )
  ];

  // A BOM keeps Excel from mangling the French accents.
  return new Response(`\uFEFF${lines.join('\r\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="declarations-bdts.csv"',
      'Cache-Control': 'no-store'
    }
  });
};
