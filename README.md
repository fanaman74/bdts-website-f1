# Meridian Courtage — site courtier en assurances

Site full-stack construit avec **Astro 7**, TypeScript, Tailwind CSS v4 et un îlot Preact.
Structure inspirée d'un site de courtage belge de référence, avec une identité et un contenu entièrement originaux.

## Démarrage

```bash
npm install
npm run dev        # http://localhost:4321
```

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (statique + endpoints Node) |
| `npm run preview` | Prévisualisation du build |
| `npm run check` | Vérification TypeScript/Astro |
| `npm run validate` | Sanity-checks du contenu (fichiers locaux, liens de navigation, ids uniques) |
| `npm test` | validate + check + build |
| `npm run discover` | Découverte éthique des documents publics du site de référence → `data/discovered-documents.json` |
| `npm run import:documents -- fichier.csv` | Import CSV vers le catalogue de documents |

## Architecture

- **Contenu** : collections Astro (`src/content/`) — 29 services, actualités, catalogue de documents JSON (`src/content/documents/documents.json`).
- **Documents** : page `/documents` avec recherche Fuse.js, filtres (public, catégorie, partenaire, type, langue, source), tri, badges « portail uniquement » et fallback `<noscript>`. API : `GET /api/documents.json`.
- **Formulaires** : contact `/contact`, devis `/devis`, sinistre `/declaration` → `POST /api/contact` (validation Zod côté serveur + honeypot). L'envoi d'e-mail est un point d'extension : voir le commentaire dans `src/pages/api/contact.ts`.
- **Portails clients** : configurables dans `src/data/portals.ts` (MyBroker, My AG, extensibles).
- **i18n** : dictionnaire `src/i18n/fr.ts`, prêt pour `nl`/`en`.
- **SEO** : sitemap, robots.txt, Open Graph, canoniques, pages légales (mentions, vie privée, cookies, durabilité, protection du client).

## Import CSV

Colonnes attendues :

```csv
title,partner,audience,category,productType,documentType,language,fileUrl,externalUrl,source,lastUpdated,description,tags
```

`tags` accepte plusieurs valeurs séparées par `;`. Les entrées existantes (même id généré) sont mises à jour.

## Notes de conformité

- Les PDF de `public/documents/` sont des **exemples** à remplacer par les documents officiels des partenaires (avec leur autorisation).
- Les documents personnels des clients ne sont jamais exposés : ils sont représentés par des entrées `source: "portal"` qui renvoient vers les portails sécurisés.
- Le script de découverte respecte robots.txt, limite son débit et ne franchit aucune authentification.
