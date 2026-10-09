import type { SiteLanguage } from '../i18n/navigation';

export type LocalizedText = Record<SiteLanguage, string>;

export interface ServiceJourney {
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  intro: LocalizedText;
  image: string;
  prepare: LocalizedText[];
  approach: LocalizedText[];
  related: Array<{ label: LocalizedText; href: string }>;
  next: LocalizedText;
}

export const serviceJourneys: ServiceJourney[] = [
  {
    slug: 'bilan-assurances',
    title: { fr: 'Faire le bilan de ses assurances', nl: 'Uw verzekeringen herbekijken', en: 'Review your insurance cover' },
    summary: {
      fr: 'Un regard annuel sur vos garanties, vos franchises et les changements de votre ménage.',
      nl: 'Een jaarlijkse blik op uw waarborgen, vrijstellingen en veranderingen in uw gezin.',
      en: 'An annual review of your cover, excesses and the changes in your household.'
    },
    intro: {
      fr: 'Un déménagement, un nouvel emploi, une naissance ou un véhicule peuvent modifier vos besoins. Un bilan met les contrats à jour et rend les choix plus lisibles.',
      nl: 'Een verhuis, een nieuwe job, een geboorte of een voertuig kunnen uw behoeften veranderen. Een check-up houdt uw polissen actueel en maakt keuzes duidelijker.',
      en: 'A move, a new job, a birth or a vehicle can change what you need. A review keeps your policies current and makes the choices easier to understand.'
    },
    image: '/images/photos/particulier-famille-protection-assurance-familiale.jpg',
    prepare: [
      { fr: 'Vos contrats et attestations actuels', nl: 'Uw huidige polissen en attesten', en: 'Your current policies and certificates' },
      { fr: 'Les changements récents dans votre vie ou votre logement', nl: 'Recente veranderingen in uw leven of woning', en: 'Recent changes in your life or home' },
      { fr: 'Vos priorités : budget, garanties ou simplicité', nl: 'Uw prioriteiten: budget, waarborgen of eenvoud', en: 'Your priorities: budget, cover or simplicity' }
    ],
    approach: [
      { fr: 'Nous reprenons les garanties et exclusions avec vous.', nl: 'We overlopen samen de waarborgen en uitsluitingen.', en: 'We go through the cover and exclusions with you.' },
      { fr: 'Nous signalons les doublons et les zones qui méritent une décision.', nl: 'We wijzen op overlappingen en punten die een beslissing vragen.', en: 'We flag overlaps and areas that need a decision.' },
      { fr: 'Vous décidez ensuite, avec une vue claire de vos options.', nl: 'U beslist daarna met een duidelijk zicht op uw opties.', en: 'You decide with a clear view of your options.' }
    ],
    related: [
      { label: { fr: 'Épargne et investissement', nl: 'Sparen en beleggen', en: 'Savings and investing' }, href: '/particulier/epargne-investir' },
      { label: { fr: 'Assurance habitation', nl: 'Woningverzekering', en: 'Home insurance' }, href: '/particulier/habitation/incendie' }
    ],
    next: { fr: 'Demander un bilan', nl: 'Een check-up vragen', en: 'Request a review' }
  },
  {
    slug: 'accompagnement-sinistre',
    title: { fr: 'Être accompagné après un sinistre', nl: 'Begeleiding na schade', en: 'Support after a claim' },
    summary: {
      fr: 'Les premières étapes pour rassembler les faits et transmettre une déclaration complète.',
      nl: 'De eerste stappen om de feiten te verzamelen en een volledige aangifte door te sturen.',
      en: 'The first steps to gather the facts and send a complete claim.'
    },
    intro: {
      fr: 'Après un sinistre, les informations utiles ne sont pas toujours évidentes à rassembler. Nous vous aidons à préparer votre dossier et à transmettre les éléments à la compagnie.',
      nl: 'Na schade is het niet altijd duidelijk welke informatie nodig is. We helpen u uw dossier voor te bereiden en de elementen aan de verzekeraar te bezorgen.',
      en: 'After a claim, it is not always obvious which information to gather. We help you prepare your file and pass the details to the insurer.'
    },
    image: '/images/photos/particulier-habitation-incendie.jpg',
    prepare: [
      { fr: 'La date, le lieu et une description factuelle des faits', nl: 'Datum, plaats en een feitelijke beschrijving van de feiten', en: 'The date, place and a factual description of what happened' },
      { fr: 'Les coordonnées des personnes ou parties concernées', nl: 'De gegevens van de betrokken personen of partijen', en: 'Contact details for the people or parties involved' },
      { fr: 'Des photos, factures ou procès-verbaux disponibles', nl: 'Beschikbare foto’s, facturen of processen-verbaal', en: 'Any available photos, invoices or reports' }
    ],
    approach: [
      { fr: 'Utilisez le formulaire de déclaration pour transmettre les premières informations.', nl: 'Gebruik het schadeformulier om de eerste informatie door te sturen.', en: 'Use the claim form to send the first details.' },
      { fr: 'Gardez les originaux et ajoutez les pièces utiles au dossier.', nl: 'Bewaar de originelen en voeg nuttige stukken aan het dossier toe.', en: 'Keep the originals and add useful documents to the file.' },
      { fr: 'Nous reprenons ensuite les échanges avec la compagnie selon votre contrat.', nl: 'We nemen daarna de contacten met de verzekeraar op volgens uw polis.', en: 'We then take up the exchanges with the insurer according to your policy.' }
    ],
    related: [
      { label: { fr: 'Ouvrir la déclaration', nl: 'Aangifte openen', en: 'Open the claim form' }, href: '/declaration' },
      { label: { fr: 'Documents utiles', nl: 'Nuttige documenten', en: 'Useful documents' }, href: '/documents' }
    ],
    next: { fr: 'Déclarer un sinistre', nl: 'Schade melden', en: 'Report a claim' }
  },
  {
    slug: 'projet-immobilier',
    title: { fr: 'Préparer un projet immobilier', nl: 'Uw vastgoedproject voorbereiden', en: 'Prepare a property project' },
    summary: {
      fr: 'Anticiper les assurances et le financement autour d’un achat, d’une construction ou d’un déménagement.',
      nl: 'Verzekeringen en financiering voorbereiden voor een aankoop, bouwproject of verhuis.',
      en: 'Plan the insurance and financing around a purchase, build or move.'
    },
    intro: {
      fr: 'Un projet immobilier rassemble plusieurs décisions : protéger le bâtiment, organiser le crédit et anticiper les conséquences d’un imprévu. Nous clarifions les étapes qui relèvent de notre accompagnement.',
      nl: 'Een vastgoedproject brengt verschillende beslissingen samen: het gebouw beschermen, het krediet organiseren en onverwachte gevolgen voorzien. We verduidelijken welke stappen we kunnen begeleiden.',
      en: 'A property project brings several decisions together: protect the building, arrange the loan and plan for the unexpected. We clarify the steps we can support.'
    },
    image: '/images/photos/particulier-habitation-bailleur-locataire.jpg',
    prepare: [
      { fr: 'Le type de projet, son calendrier et sa localisation', nl: 'Het type project, de timing en de locatie', en: 'The type of project, timing and location' },
      { fr: 'Les informations connues sur le bien et votre situation', nl: 'De beschikbare informatie over het pand en uw situatie', en: 'What you know about the property and your situation' },
      { fr: 'Vos questions sur le crédit hypothécaire ou le financement', nl: 'Uw vragen over hypothecair krediet of financiering', en: 'Your questions about a mortgage or financing' }
    ],
    approach: [
      { fr: 'Nous comparons les protections pertinentes pour le bâtiment et ses occupants.', nl: 'We vergelijken relevante bescherming voor het gebouw en de bewoners.', en: 'We compare relevant protection for the building and its occupants.' },
      { fr: 'Notre service de courtage en crédits peut aussi examiner le financement.', nl: 'Onze kredietmakelaardij kan ook de financiering bekijken.', en: 'Our credit brokerage service can also examine the financing.' },
      { fr: 'Les conditions dépendent toujours du dossier et de l’analyse des partenaires.', nl: 'De voorwaarden hangen altijd af van het dossier en de analyse van partners.', en: 'Terms always depend on your file and the partners’ assessment.' }
    ],
    related: [
      { label: { fr: 'Assurance habitation', nl: 'Woningverzekering', en: 'Home insurance' }, href: '/particulier/habitation/incendie' },
      { label: { fr: 'Partenaires en crédits', nl: 'Kredietpartners', en: 'Credit partners' }, href: '/autres/partenaires-credits' }
    ],
    next: { fr: 'Parler de mon projet', nl: 'Mijn project bespreken', en: 'Discuss my project' }
  },
  {
    slug: 'je-lance-mon-activite',
    title: { fr: 'Je lance mon activité', nl: 'Ik start mijn activiteit', en: 'I am starting a business' },
    summary: {
      fr: 'Poser les bonnes bases pour protéger votre responsabilité, vos revenus et votre matériel.',
      nl: 'De juiste basis leggen voor uw aansprakelijkheid, inkomen en materiaal.',
      en: 'Lay the right foundations to protect your liability, income and equipment.'
    },
    intro: {
      fr: 'Au démarrage, les assurances doivent suivre votre activité réelle : ce que vous vendez, où vous travaillez et les personnes qui vous entourent. Nous vous aidons à distinguer l’essentiel du reste.',
      nl: 'Bij de start moeten verzekeringen aansluiten bij uw echte activiteit: wat u verkoopt, waar u werkt en wie erbij betrokken is. We helpen u het essentiële van de rest te onderscheiden.',
      en: 'At launch, insurance should reflect your actual activity: what you sell, where you work and who is involved. We help you separate essentials from the rest.'
    },
    image: '/images/photos/professionnel-entreprise-responsabilite.jpg',
    prepare: [
      { fr: 'Une description de l’activité, des clients et des lieux de travail', nl: 'Een beschrijving van de activiteit, klanten en werkplaatsen', en: 'A description of the activity, clients and work locations' },
      { fr: 'Le matériel, les véhicules et les collaborateurs concernés', nl: 'Materiaal, voertuigen en betrokken medewerkers', en: 'The equipment, vehicles and people involved' },
      { fr: 'Les contrats ou exigences d’assurance déjà connus', nl: 'Bekende contractuele of wettelijke verzekeringsvereisten', en: 'Any known contractual or legal insurance requirements' }
    ],
    approach: [
      { fr: 'Nous identifions les responsabilités qui naissent de votre activité.', nl: 'We brengen de aansprakelijkheden van uw activiteit in kaart.', en: 'We identify the liabilities created by your activity.' },
      { fr: 'Nous examinons les solutions pour l’entreprise, le personnel et le revenu.', nl: 'We bekijken oplossingen voor onderneming, personeel en inkomen.', en: 'We examine solutions for the business, staff and income.' },
      { fr: 'Vous recevez une explication claire des garanties et de leurs limites.', nl: 'U krijgt duidelijke uitleg over waarborgen en beperkingen.', en: 'You receive a clear explanation of cover and its limits.' }
    ],
    related: [
      { label: { fr: 'Responsabilité de l’entreprise', nl: 'Aansprakelijkheid van de onderneming', en: 'Business liability' }, href: '/professionnel/entreprise/responsabilite' },
      { label: { fr: 'Revenu garanti', nl: 'Gewaarborgd inkomen', en: 'Guaranteed income' }, href: '/professionnel/revenu/revenu-garanti' }
    ],
    next: { fr: 'Échanger sur mon activité', nl: 'Mijn activiteit bespreken', en: 'Discuss my business' }
  },
  {
    slug: 'preparer-ma-pension',
    title: { fr: 'Préparer ma pension', nl: 'Mijn pensioen voorbereiden', en: 'Prepare for retirement' },
    summary: {
      fr: 'Faire le point sur l’épargne et les protections qui peuvent compléter vos revenus futurs.',
      nl: 'Uw sparen en bescherming bekijken als aanvulling op uw toekomstige inkomen.',
      en: 'Review savings and protection that may complement your future income.'
    },
    intro: {
      fr: 'Préparer sa pension commence par comprendre l’horizon, les revenus attendus et l’effort d’épargne possible. Nous mettons en regard les solutions et leurs conditions.',
      nl: 'Uw pensioen voorbereiden begint met inzicht in de termijn, verwachte inkomsten en mogelijke spaarinspanning. We leggen oplossingen en voorwaarden naast elkaar.',
      en: 'Preparing for retirement starts with understanding your horizon, expected income and possible savings effort. We set the solutions and their conditions side by side.'
    },
    image: '/images/photos/particulier-pension-epargne-pension.jpg',
    prepare: [
      { fr: 'Votre âge, votre statut et l’horizon souhaité', nl: 'Uw leeftijd, statuut en gewenste horizon', en: 'Your age, status and preferred horizon' },
      { fr: 'Les contrats d’épargne ou de groupe déjà en place', nl: 'Bestaande spaar- of groepsverzekeringen', en: 'Existing savings or group policies' },
      { fr: 'Le montant et la fréquence d’épargne envisageables', nl: 'Het bedrag en de frequentie die u kunt sparen', en: 'The amount and frequency you could save' }
    ],
    approach: [
      { fr: 'Nous clarifions la place de l’épargne-pension, de l’épargne à long terme et de l’assurance de groupe.', nl: 'We verduidelijken de plaats van pensioensparen, langetermijnsparen en groepsverzekering.', en: 'We clarify the role of pension savings, long-term savings and group insurance.' },
      { fr: 'Nous expliquons horizon, risques, frais et bénéficiaires.', nl: 'We leggen horizon, risico’s, kosten en begunstigden uit.', en: 'We explain horizon, risks, costs and beneficiaries.' },
      { fr: 'La recommandation tient compte de votre situation et de vos objectifs.', nl: 'Het advies houdt rekening met uw situatie en doelstellingen.', en: 'The recommendation takes your situation and goals into account.' }
    ],
    related: [
      { label: { fr: 'Épargne-pension', nl: 'Pensioensparen', en: 'Pension savings' }, href: '/particulier/pension/epargne-pension' },
      { label: { fr: 'Épargne à long terme', nl: 'Langetermijnsparen', en: 'Long-term savings' }, href: '/particulier/pension/epargne-long-terme' }
    ],
    next: { fr: 'Parler de ma pension', nl: 'Mijn pensioen bespreken', en: 'Discuss my retirement' }
  },
  {
    slug: 's-installer-en-belgique',
    title: { fr: 'S’installer en Belgique', nl: 'Zich in België vestigen', en: 'Settle in Belgium' },
    summary: {
      fr: 'Repérer les assurances à prévoir lors de votre arrivée, de votre location ou de votre installation.',
      nl: 'De verzekeringen bekijken die u nodig hebt bij aankomst, huur of vestiging.',
      en: 'Find the cover to consider when arriving, renting or settling in Belgium.'
    },
    intro: {
      fr: 'Une nouvelle adresse implique des démarches concrètes : logement, mobilité, responsabilité et parfois activité professionnelle. Nous vous aidons à faire le tri selon votre situation en Belgique.',
      nl: 'Een nieuw adres brengt concrete stappen mee: woning, mobiliteit, aansprakelijkheid en soms beroepsactiviteit. We helpen u kiezen volgens uw situatie in België.',
      en: 'A new address brings practical steps: home, mobility, liability and sometimes work. We help you sort through them for your situation in Belgium.'
    },
    image: '/images/photos/particulier-habitation-bailleur-locataire.jpg',
    prepare: [
      { fr: 'Votre adresse, votre statut de locataire ou de propriétaire', nl: 'Uw adres en uw statuut als huurder of eigenaar', en: 'Your address and whether you rent or own' },
      { fr: 'Les véhicules et moyens de mobilité à assurer', nl: 'De voertuigen en vervoermiddelen die u wilt verzekeren', en: 'The vehicles and mobility you need to insure' },
      { fr: 'Votre situation familiale et professionnelle', nl: 'Uw familiale en professionele situatie', en: 'Your family and work situation' }
    ],
    approach: [
      { fr: 'Nous listons les couvertures utiles à votre logement et à votre vie privée.', nl: 'We maken een lijst van nuttige dekkingen voor uw woning en privéleven.', en: 'We list useful cover for your home and private life.' },
      { fr: 'Nous regardons aussi la mobilité et les responsabilités liées à votre activité.', nl: 'We bekijken ook mobiliteit en aansprakelijkheden van uw activiteit.', en: 'We also look at mobility and liabilities linked to your work.' },
      { fr: 'Vous avancez avec des priorités adaptées à votre installation.', nl: 'U gaat vooruit met prioriteiten die bij uw vestiging passen.', en: 'You move forward with priorities suited to your new home.' }
    ],
    related: [
      { label: { fr: 'Bailleur et locataire', nl: 'Verhuurder en huurder', en: 'Landlord and tenant' }, href: '/particulier/habitation/bailleur-locataire' },
      { label: { fr: 'Assurance auto', nl: 'Autoverzekering', en: 'Car insurance' }, href: '/particulier/mobilite/auto' }
    ],
    next: { fr: 'Décrire mon installation', nl: 'Mijn vestiging beschrijven', en: 'Describe my move' }
  }
];

export const prioritizedJourneys = serviceJourneys.slice(0, 3);

export function journeyBySlug(slug: string): ServiceJourney | undefined {
  return serviceJourneys.find((journey) => journey.slug === slug);
}
