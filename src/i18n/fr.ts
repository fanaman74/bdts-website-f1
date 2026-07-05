/**
 * UI dictionary — French (fr-BE).
 * Future locales: duplicate this file as nl.ts / en.ts and switch via a locale param.
 */
export const t = {
  site: {
    name: 'BDT Sironval',
    tagline: 'Courtier en assurances indépendant à Bruxelles',
    description:
      "BDT Sironval, courtier indépendant à Bruxelles : assurances particuliers et professionnels, épargne, pension et conseils personnalisés à chaque étape de votre vie."
  },
  nav: {
    particulier: 'Particulier',
    professionnel: 'Professionnel',
    autres: 'Autres',
    documents: 'Documents',
    news: 'Actualités',
    jobs: 'Jobs',
    clientZone: 'Zone Client',
    contact: 'Contact',
    menu: 'Menu',
    close: 'Fermer'
  },
  hero: {
    headline: 'Assurance, protection et conseils financiers pour chaque étape de votre vie',
    subheadline:
      "Courtier indépendant basé à Bruxelles, nous accompagnons particuliers et entreprises avec des solutions sur mesure — en toute transparence.",
    ctaQuote: 'Demander un devis',
    ctaClaim: 'Déclarer un sinistre',
    ctaDocuments: 'Voir les documents'
  },
  documents: {
    title: 'Documents',
    intro:
      "Retrouvez les conditions générales, fiches produits et documents commerciaux relatifs aux produits de nos partenaires. Recherchez, filtrez et téléchargez en quelques clics.",
    searchPlaceholder: 'Rechercher un document, un partenaire, un produit…',
    filters: {
      audience: 'Public',
      category: 'Catégorie',
      partner: 'Partenaire',
      documentType: 'Type de document',
      language: 'Langue',
      source: 'Source',
      reset: 'Réinitialiser les filtres',
      all: 'Tous'
    },
    sort: {
      label: 'Trier par',
      recent: 'Plus récents',
      az: 'A – Z',
      partner: 'Partenaire',
      category: 'Catégorie'
    },
    portalOnly: 'Portail uniquement',
    download: 'Télécharger',
    open: 'Ouvrir',
    goToPortal: 'Accéder au portail',
    lastUpdated: 'Mis à jour le',
    results: (n: number) => (n === 1 ? '1 document trouvé' : `${n} documents trouvés`),
    empty: 'Aucun document trouvé. Essayez de modifier vos filtres ou contactez-nous.',
    portalPanelTitle: 'Vos documents personnels',
    portalPanelBody:
      "Les documents liés à vos contrats — certificats, attestations fiscales, informations de paiement — sont disponibles via un accès sécurisé : MyBroker ou le portail client de votre compagnie d'assurance."
  },
  forms: {
    name: 'Nom complet',
    email: 'Adresse e-mail',
    phone: 'Téléphone',
    message: 'Message',
    consent:
      "J'accepte que mes données soient utilisées pour traiter ma demande, conformément à la politique de confidentialité.",
    submit: 'Envoyer',
    sending: 'Envoi en cours…',
    success: 'Merci ! Votre demande a bien été envoyée. Nous vous recontactons rapidement.',
    error: "Une erreur s'est produite. Vérifiez les champs et réessayez, ou appelez-nous directement."
  },
  footer: {
    disclaimer:
      "Les informations présentées sur ce site ont un caractère purement informatif et ne constituent pas un conseil personnalisé. Un conseil définitif nécessite un entretien avec votre courtier. Les documents des compagnies peuvent être mis à jour à tout moment par leurs émetteurs.",
    fsma: 'Inscrit auprès de la FSMA en qualité de courtier en assurances.'
  }
} as const;
