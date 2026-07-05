/**
 * Card imagery. Every service has a real photo depicting its subject in
 * public/images/photos/ (sourced via Unsplash, credits in photo-credits.json);
 * the abstract SVGs in public/images/cards/ remain as category-level fallbacks.
 */
const byCategory: Record<string, string> = {
  Mobilité: '/images/cards/mobilite.svg',
  Habitation: '/images/cards/habitation.svg',
  Famille: '/images/cards/famille.svg',
  Hospitalisation: '/images/cards/hospitalisation.svg',
  Pension: '/images/cards/pension.svg',
  Épargne: '/images/cards/epargne.svg',
  Entreprise: '/images/cards/entreprise.svg',
  Personnel: '/images/cards/personnel.svg',
  Revenu: '/images/cards/revenu.svg'
};

export function categoryImage(category: string): string {
  return byCategory[category] ?? '/images/cards/digital.svg';
}

/** Photo for a service entry, keyed by its collection id (e.g. "particulier/mobilite/auto"). */
export function serviceImage(id: string): string {
  return `/images/photos/${id.replaceAll('/', '-')}.jpg`;
}
