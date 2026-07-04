export interface NavLeaf {
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  slug: string;
  items: NavLeaf[];
}

export interface NavSection {
  label: string;
  slug: 'particulier' | 'professionnel' | 'autres';
  groups: NavGroup[];
}

/** Main category navigation — mirrors the content collection structure. */
export const mainNav: NavSection[] = [
  {
    label: 'Particulier',
    slug: 'particulier',
    groups: [
      {
        label: 'Mobilité',
        slug: 'mobilite',
        items: [
          { label: 'Auto', href: '/particulier/mobilite/auto' },
          { label: 'Moto', href: '/particulier/mobilite/moto' },
          { label: 'Vélo', href: '/particulier/mobilite/velo' },
          { label: 'Motorhome', href: '/particulier/mobilite/motorhome' }
        ]
      },
      {
        label: 'Habitation',
        slug: 'habitation',
        items: [
          { label: 'Incendie', href: '/particulier/habitation/incendie' },
          { label: 'Vol', href: '/particulier/habitation/vol' },
          { label: 'Bailleur & locataire', href: '/particulier/habitation/bailleur-locataire' }
        ]
      },
      {
        label: 'Famille & protection juridique',
        slug: 'famille-protection',
        items: [
          { label: 'Assurance familiale', href: '/particulier/famille-protection/assurance-familiale' },
          { label: 'Accidents', href: '/particulier/famille-protection/accidents' },
          { label: 'Décès & invalidité', href: '/particulier/famille-protection/deces-invalidite' },
          { label: 'Assurance voyage', href: '/particulier/famille-protection/assurance-voyage' },
          { label: 'Protection juridique', href: '/particulier/famille-protection/protection-juridique' }
        ]
      },
      {
        label: 'Hospitalisation',
        slug: 'hospitalisation',
        items: [
          { label: 'Assurance hospitalisation', href: '/particulier/hospitalisation/assurance-hospitalisation' },
          { label: 'Assurance de groupe', href: '/particulier/hospitalisation/assurance-de-groupe' }
        ]
      },
      {
        label: 'Épargner ou investir',
        slug: 'epargne-investir',
        items: [{ label: 'Épargner ou investir', href: '/particulier/epargne-investir' }]
      },
      {
        label: 'Pension',
        slug: 'pension',
        items: [
          { label: 'Épargne-pension', href: '/particulier/pension/epargne-pension' },
          { label: 'Épargne à long terme', href: '/particulier/pension/epargne-long-terme' },
          { label: 'Assurance de groupe', href: '/particulier/pension/assurance-de-groupe' }
        ]
      }
    ]
  },
  {
    label: 'Professionnel',
    slug: 'professionnel',
    groups: [
      {
        label: 'Entreprise',
        slug: 'entreprise',
        items: [
          { label: 'Véhicules de société', href: '/professionnel/entreprise/vehicules-de-societe' },
          { label: 'Bâtiments', href: '/professionnel/entreprise/batiments' },
          { label: 'Matériel', href: '/professionnel/entreprise/materiel' },
          { label: 'Responsabilité', href: '/professionnel/entreprise/responsabilite' }
        ]
      },
      {
        label: 'Personnel',
        slug: 'personnel',
        items: [
          { label: 'Accidents du travail', href: '/professionnel/personnel/accidents-du-travail' },
          { label: 'Assurance de groupe', href: '/professionnel/personnel/assurance-de-groupe' },
          { label: 'Hospitalisation', href: '/professionnel/personnel/hospitalisation' }
        ]
      },
      {
        label: 'Revenu',
        slug: 'revenu',
        items: [
          { label: 'Revenu garanti', href: '/professionnel/revenu/revenu-garanti' },
          { label: 'Constitution de pension', href: '/professionnel/revenu/constitution-de-pension' },
          { label: 'Assurance décès', href: '/professionnel/revenu/assurance-deces' },
          { label: 'Placements', href: '/professionnel/revenu/placements' }
        ]
      }
    ]
  },
  {
    label: 'Autres',
    slug: 'autres',
    groups: [
      {
        label: 'Autres services',
        slug: 'autres-services',
        items: [
          { label: 'Nos partenaires en crédits', href: '/autres/partenaires-credits' },
          { label: 'Numéros utiles', href: '/autres/numeros-utiles' },
          { label: 'Une solution à vos projets', href: '/contact' }
        ]
      }
    ]
  }
];

export const topNav: NavLeaf[] = [
  { label: 'Documents', href: '/documents' },
  { label: 'Actualités', href: '/actualites' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Zone Client', href: '/documents#portails' }
];
