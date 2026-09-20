# BDT Sironval — site courtier en assurances

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
| `npm run migrate` | Applique les migrations SQL sur la base Neon (`db/migrations/`) |
| `npm test` | validate + check + build |
| `npm run discover` | Découverte éthique des documents publics du site de référence → `data/discovered-documents.json` |
| `npm run import:documents -- fichier.csv` | Import CSV vers le catalogue de documents |

## Architecture

- **Contenu** : collections Astro (`src/content/`) — 29 services, actualités, catalogue de documents JSON (`src/content/documents/documents.json`).
- **Documents** : page `/documents` avec recherche Fuse.js, filtres (public, catégorie, partenaire, type, langue, source), tri, badges « portail uniquement » et fallback `<noscript>`. API : `GET /api/documents.json`.
- **Assistant documents** : renseigner `ROUTERA_API_KEY` dans l’environnement Railway (clé `rta_…`, API OpenAI-compatible de [Routera](https://www.routera.one)). `ROUTERA_MODEL` est facultatif : par défaut `openai/gpt-5.6-luna`, puis repli sur `qwen/qwen3.5-27b`. Routera facture à l’usage (pas d’offre gratuite) et l’accès aux modèles dépend de l’offre ; les tarifs courants sont exposés par `GET https://api.routera.one/v1/models`. Le tiroir de discussion affiche le modèle utilisé et l’état de la connexion (`GET /api/assistant-status`). L’assistant est proposé uniquement pour les liens PDF directs.
- **Formulaires** : contact `/contact`, devis `/devis`, sinistre `/declaration` → `POST /api/contact` (validation Zod côté serveur + honeypot), puis stockage dans la table Postgres `inquiries` hébergée sur Neon.
- **Portails clients** : configurables dans `src/data/portals.ts` (MyBroker, My AG, extensibles).
- **i18n** : dictionnaire `src/i18n/fr.ts`, prêt pour `nl`/`en`.
- **SEO** : sitemap, robots.txt, Open Graph, canoniques, pages légales (mentions, vie privée, cookies, durabilité, protection du client).

## Import CSV

Colonnes attendues :

```csv
title,partner,audience,category,productType,documentType,language,fileUrl,externalUrl,source,lastUpdated,description,tags
```

`tags` accepte plusieurs valeurs séparées par `;`. Les entrées existantes (même id généré) sont mises à jour.

## Neon (base de données)

1. Créez un projet sur [neon.com](https://neon.com), puis copiez la *connection string* (Console → **Connect** → **Connection string**, hôte `-pooler` conseillé).
2. Copiez `.env.example` vers `.env` et renseignez `DATABASE_URL`. Cette variable est strictement côté serveur : ne la préfixez jamais par `PUBLIC_` et ne la commitez jamais.
3. Appliquez les migrations : `npm run migrate`.

```bash
npm run migrate            # applique db/migrations/*.sql (idempotent, suivi dans public.schema_migrations)
```

Le client utilise `@neondatabase/serverless` en mode HTTP : aucune socket n'est maintenue ouverte, ce qui évite les connexions périmées quand Neon met la base en veille. Les requêtes sont paramétrées (`$1`, `$2`, …) et la migration `db/migrations/0001_create_inquiries.sql` crée la table `inquiries` (contraintes `check`, index `status`/`created_at`, trigger `updated_at`). Sur Neon il n'y a ni rôles `anon`/`authenticated`/`service_role` ni RLS : l'accès est restreint par le fait que seul le serveur Astro détient `DATABASE_URL`.

## Images

Les photos des cartes (`public/images/photos/`) proviennent d'Unsplash (licence Unsplash, usage commercial autorisé).
Le détail photo par photo — auteur, lien, requête — est consigné dans `src/data/photo-credits.json`.
Les illustrations abstraites (`public/images/cards/`) servent de repli par catégorie.
La vidéo du hero (`public/videos/hero-office.mp4`) provient de Mixkit (licence Mixkit gratuite, usage commercial autorisé).

## Notes de conformité

- Les PDF de `public/documents/` sont des **exemples** à remplacer par les documents officiels des partenaires (avec leur autorisation).
- Les documents personnels des clients ne sont jamais exposés : ils sont représentés par des entrées `source: "portal"` qui renvoient vers les portails sécurisés.
- Le script de découverte respecte robots.txt, limite son débit et ne franchit aucune authentification.
# bdts-website-f1
