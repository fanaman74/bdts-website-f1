export interface Portal {
  id: string;
  name: string;
  label: string;
  description: string;
  url: string;
  features: string[];
}

/**
 * Client portals shown on the Documents page and in the client area section.
 * Add future insurer portals here — no component changes needed.
 */
export const portals: Portal[] = [
  {
    id: 'mybroker',
    name: 'MyBroker',
    label: 'Mon dossier chez mon courtier',
    description:
      'Consultez vos contrats, attestations et documents personnels gérés par notre bureau, à tout moment et en toute sécurité.',
    url: 'https://www.mybroker.be',
    features: ['Contrats en cours', 'Attestations', 'Suivi des sinistres', 'Documents fiscaux']
  },
  {
    id: 'myag',
    name: 'AG Insurance — My AG',
    label: 'Mes contrats par compagnie',
    description:
      "Accédez directement à vos documents AG Insurance : certificats, attestations fiscales et suivi de paiement de vos contrats.",
    url: 'https://www.aginsurance.be/myag',
    features: ['Certificats', 'Attestations fiscales', 'Suivi de paiement']
  }
];
