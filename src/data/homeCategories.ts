/**
 * The six entry points shown on the homepage, mirroring the categories of the
 * live bdts.be site. Each links to the closest existing service page.
 */
export interface HomeCategory {
  title: string;
  summary: string;
  href: string;
  image: string;
}

export const homeCategories: HomeCategory[] = [
  { title: 'Mobilité', summary: 'Voiture, moto, vélo…', href: '/particulier/mobilite/auto', image: '/images/photos/particulier-mobilite-auto.jpg' },
  { title: 'Epargne', summary: 'Pension, investissement…', href: '/particulier/epargne-investir', image: '/images/photos/particulier-epargne-investir.jpg' },
  { title: 'Protection', summary: 'Santé, famille…', href: '/particulier/famille-protection/assurance-familiale', image: '/images/photos/particulier-famille-protection-assurance-familiale.jpg' },
  { title: 'Bâtiment', summary: 'Incendie, vol, accidents…', href: '/particulier/habitation/incendie', image: '/images/photos/particulier-habitation-incendie.jpg' },
  { title: 'Voyage', summary: 'Assistance voyage', href: '/particulier/famille-protection/assurance-voyage', image: '/images/photos/particulier-famille-protection-assurance-voyage.jpg' },
  { title: 'Entreprise', summary: 'Employés, bâtiment…', href: '/professionnel/entreprise/responsabilite', image: '/images/photos/professionnel-entreprise-responsabilite.jpg' }
];
