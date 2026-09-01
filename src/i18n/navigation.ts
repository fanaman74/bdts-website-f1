export type SiteLanguage = 'fr' | 'nl' | 'en';

interface NavigationLanguage {
  brandSubtitle: string;
  menu: string;
  practical: string;
  contact: string;
  sections: Record<string, string>;
  groups: Record<string, string>;
  leaves: Record<string, string>;
  top: Record<string, string>;
}

export const navigationLanguages: Record<SiteLanguage, NavigationLanguage> = {
  fr: {
    brandSubtitle: 'Courtiers en assurances',
    menu: 'Menu',
    practical: 'Pratique',
    contact: 'Nous contacter',
    sections: { particulier: 'Particulier', professionnel: 'Professionnel', autres: 'Autres' },
    groups: {},
    leaves: {},
    top: {}
  },
  en: {
    brandSubtitle: 'Insurance brokers',
    menu: 'Menu',
    practical: 'Useful links',
    contact: 'Contact us',
    sections: { particulier: 'Individuals', professionnel: 'Professionals', autres: 'Other services' },
    groups: {
      mobilite: 'Mobility', habitation: 'Home insurance', 'famille-protection': 'Family & legal protection',
      hospitalisation: 'Hospitalisation', 'epargne-investir': 'Savings & investing', pension: 'Pension',
      entreprise: 'Business', personnel: 'Staff', revenu: 'Income', 'autres-services': 'Other services'
    },
    leaves: {
      '/particulier/mobilite/moto': 'Motorcycle', '/particulier/mobilite/velo': 'Bicycle', '/particulier/mobilite/motorhome': 'Motorhome',
      '/particulier/habitation/incendie': 'Fire insurance', '/particulier/habitation/vol': 'Theft', '/particulier/habitation/bailleur-locataire': 'Landlord & tenant',
      '/particulier/famille-protection/assurance-familiale': 'Family insurance', '/particulier/famille-protection/deces-invalidite': 'Death & disability',
      '/particulier/famille-protection/assurance-voyage': 'Travel insurance', '/particulier/famille-protection/protection-juridique': 'Legal protection',
      '/particulier/hospitalisation/assurance-hospitalisation': 'Hospital insurance', '/particulier/hospitalisation/assurance-de-groupe': 'Group insurance',
      '/particulier/epargne-investir': 'Savings & investing', '/particulier/pension/epargne-pension': 'Pension savings',
      '/particulier/pension/epargne-long-terme': 'Long-term savings', '/particulier/pension/assurance-de-groupe': 'Group insurance',
      '/professionnel/entreprise/vehicules-de-societe': 'Company vehicles', '/professionnel/entreprise/batiments': 'Buildings',
      '/professionnel/entreprise/materiel': 'Equipment', '/professionnel/entreprise/responsabilite': 'Liability',
      '/professionnel/personnel/accidents-du-travail': 'Workplace accidents', '/professionnel/personnel/assurance-de-groupe': 'Group insurance',
      '/professionnel/personnel/hospitalisation': 'Hospital insurance', '/professionnel/revenu/revenu-garanti': 'Guaranteed income',
      '/professionnel/revenu/constitution-de-pension': 'Pension planning', '/professionnel/revenu/assurance-deces': 'Death insurance',
      '/professionnel/revenu/placements': 'Investments', '/autres/partenaires-credits': 'Credit partners',
      '/autres/numeros-utiles': 'Useful numbers', '/contact': 'A solution for your projects'
    },
    top: { '/documents': 'Documents', '/actualites': 'News', '/jobs': 'Jobs', '/documents#portails': 'Client portal' }
  },
  nl: {
    brandSubtitle: 'Verzekeringsmakelaars',
    menu: 'Menu',
    practical: 'Praktisch',
    contact: 'Contacteer ons',
    sections: { particulier: 'Particulieren', professionnel: 'Professionelen', autres: 'Andere diensten' },
    groups: {
      mobilite: 'Mobiliteit', habitation: 'Woningverzekering', 'famille-protection': 'Familie & rechtsbijstand',
      hospitalisation: 'Hospitalisatie', 'epargne-investir': 'Sparen & beleggen', pension: 'Pensioen',
      entreprise: 'Onderneming', personnel: 'Personeel', revenu: 'Inkomen', 'autres-services': 'Andere diensten'
    },
    leaves: {
      '/particulier/mobilite/moto': 'Motorfiets', '/particulier/mobilite/velo': 'Fiets', '/particulier/mobilite/motorhome': 'Camper',
      '/particulier/habitation/incendie': 'Brandverzekering', '/particulier/habitation/vol': 'Diefstal', '/particulier/habitation/bailleur-locataire': 'Verhuurder & huurder',
      '/particulier/famille-protection/assurance-familiale': 'Familiale verzekering', '/particulier/famille-protection/accidents': 'Ongevallen',
      '/particulier/famille-protection/deces-invalidite': 'Overlijden & invaliditeit', '/particulier/famille-protection/assurance-voyage': 'Reisverzekering',
      '/particulier/famille-protection/protection-juridique': 'Rechtsbijstand', '/particulier/hospitalisation/assurance-hospitalisation': 'Hospitalisatieverzekering',
      '/particulier/hospitalisation/assurance-de-groupe': 'Groepsverzekering', '/particulier/epargne-investir': 'Sparen & beleggen',
      '/particulier/pension/epargne-pension': 'Pensioensparen', '/particulier/pension/epargne-long-terme': 'Langetermijnsparen',
      '/particulier/pension/assurance-de-groupe': 'Groepsverzekering', '/professionnel/entreprise/vehicules-de-societe': 'Bedrijfsvoertuigen',
      '/professionnel/entreprise/batiments': 'Gebouwen', '/professionnel/entreprise/materiel': 'Materieel', '/professionnel/entreprise/responsabilite': 'Aansprakelijkheid',
      '/professionnel/personnel/accidents-du-travail': 'Arbeidsongevallen', '/professionnel/personnel/assurance-de-groupe': 'Groepsverzekering',
      '/professionnel/personnel/hospitalisation': 'Hospitalisatieverzekering', '/professionnel/revenu/revenu-garanti': 'Gewaarborgd inkomen',
      '/professionnel/revenu/constitution-de-pension': 'Pensioenopbouw', '/professionnel/revenu/assurance-deces': 'Overlijdensverzekering',
      '/professionnel/revenu/placements': 'Beleggingen', '/autres/partenaires-credits': 'Kredietpartners',
      '/autres/numeros-utiles': 'Nuttige nummers', '/contact': 'Een oplossing voor uw projecten'
    },
    top: { '/documents': 'Documenten', '/actualites': 'Nieuws', '/jobs': 'Vacatures', '/documents#portails': 'Klantenzone' }
  }
};

export function resolveLanguage(value: string | null): SiteLanguage {
  return value === 'nl' || value === 'en' ? value : 'fr';
}
