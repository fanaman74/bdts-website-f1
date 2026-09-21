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
| `npm run ingest:documents -- [options]` | Met en cache le texte des PDF du catalogue (voir « Cache des documents ») |
| `npm run admin:hash -- "…"` | Génère `ADMIN_PASSWORD_HASH` et `ADMIN_SESSION_SECRET` pour l’espace d’administration |
| `npm test` | validate + check + build |
| `npm run discover` | Découverte éthique des documents publics du site de référence → `data/discovered-documents.json` |
| `npm run import:documents -- fichier.csv` | Import CSV vers le catalogue de documents |

## Architecture

- **Contenu** : collections Astro (`src/content/`) — 29 services, actualités, catalogue de documents JSON (`src/content/documents/documents.json`).
- **Documents** : page `/documents` avec recherche Fuse.js, filtres (public, catégorie, partenaire, type, langue, source), tri, badges « portail uniquement » et fallback `<noscript>`. API : `GET /api/documents.json`.
- **Assistant documents** : le fournisseur (`deepseek` ou `routera`) et le modèle se choisissent dans l’espace d’administration (`/admin`) ; seules les clés d’API restent dans les variables d’environnement (`DEEPSEEK_API_KEY`, `ROUTERA_API_KEY`). Par défaut : DeepSeek `deepseek-flash`, puis repli sur `deepseek-v4-pro`. Routera n’a pas d’offre gratuite, facture à l’usage, et son accès aux modèles dépend de l’offre. Le tiroir de discussion affiche le modèle utilisé et l’état de la connexion (`GET /api/assistant-status`). L’assistant est proposé uniquement pour les liens PDF directs.
- **Cache des documents** : le texte extrait des PDF est stocké en base (`document_texts`, migration `0002`). L’assistant lit cette copie quand elle existe et ne télécharge le PDF qu’en dernier recours — voir « Cache des documents » pour l’ingestion depuis un réseau non bloqué.
- **Formulaires** : contact `/contact`, devis `/devis`, sinistre `/declaration` → `POST /api/contact` (validation Zod côté serveur + honeypot), puis stockage dans la table Postgres `inquiries` hébergée sur Neon.
- **Portails clients** : configurables dans `src/data/portals.ts` (MyBroker, My AG, extensibles).
- **i18n** : dictionnaire `src/i18n/fr.ts`, prêt pour `nl`/`en`.
- **SEO** : sitemap, robots.txt, Open Graph, canoniques, pages légales (mentions, vie privée, cookies, durabilité, protection du client).

## Administration

L’espace d’administration vit sous `/admin` : comptes nominatifs, rôles, et suivi de toutes les soumissions des formulaires.

### Comptes et rôles

| Rôle | Accès |
| --- | --- |
| `pending` | Peut se connecter, mais ne voit **aucune** donnée tant qu’un administrateur ne l’a pas approuvé |
| `member` | Consulte et traite les demandes reçues |
| `admin` | Idem, plus la gestion des comptes et le choix du fournisseur/modèle de l’assistant |

Créer le premier administrateur :

```bash
npm run admin:user -- --email vous@example.be --name "Prénom Nom" --role admin --password "une longue phrase secrète"
```

Relancer la même commande pour une adresse existante **réinitialise** son mot de passe et son rôle — c’est le seul chemin de réinitialisation aujourd’hui.

Les autres personnes créent leur compte sur `/admin/register`. Elles arrivent en `pending`, puis un administrateur approuve depuis `/admin/users`. L’approbation est délibérément nécessaire : la boîte contient des données personnelles de clients.

### Vérification de l’adresse e-mail

Quand un fournisseur d’e-mail est configuré (`BREVO_API_KEY` + `EMAIL_FROM`), les nouveaux comptes doivent confirmer leur adresse avant de pouvoir se connecter : lien à usage unique, valable 24 h, dont seule l’empreinte SHA-256 est stockée. En l’absence de fournisseur, cette exigence est **désactivée** — sinon une inscription sans e-mail reçu resterait bloquée.

La vérification et l’approbation sont deux filtres distincts : la première prouve que la personne contrôle la boîte, la seconde décide de l’accès aux données.

```bash
# Local : les e-mails (et les liens) sont écrits dans les logs du serveur
EMAIL_PROVIDER=console
EMAIL_FROM="BDT Sironval <no-reply@example.invalid>"
```

**Sécurité.** Les mots de passe ne sont jamais stockés : seule une empreinte scrypt salée l’est, comparée à temps constant. La session est un cookie signé (HMAC) `HttpOnly`, `SameSite=Lax`, valable 8 heures, et ne contient que l’identifiant du compte — le rôle est relu en base à chaque requête, donc une rétrogradation prend effet immédiatement. `ADMIN_SESSION_SECRET` signe ces cookies et permet d’invalider toutes les sessions en le changeant. Connexions limitées à 8 par quart d’heure et par IP, inscriptions à 5, renvois d’e-mail à 60 secondes par compte ; les identifiants saisis ne sont jamais journalisés. Les pages `/admin` sont en `noindex` et un middleware refuse tout par défaut. Astro protège les formulaires par vérification d’origine (CSRF), réimplémentée dans le middleware car l’adaptateur Node ignore `x-forwarded-proto` derrière le proxy Railway.

Les clés d’API des fournisseurs ne sont **jamais** stockées en base : seuls le fournisseur et le modèle le sont, dans la table `settings`.

## Cache des documents

L’assistant lit le texte des PDF depuis la table `document_texts` (migration `0002`). Un document absent du cache est téléchargé une seule fois, analysé, puis stocké : les questions suivantes n’exigent plus ni téléchargement ni analyse.

Le cache est **paresseux** : inutile d’ingérer le catalogue à l’avance. Dès qu’un visiteur ouvre l’assistant sur un document, `POST /api/document-text` lance le téléchargement en arrière-plan pendant qu’il lit la fiche, et sa première question est ensuite servie depuis le cache. Si le téléchargement n’est pas terminé — ou a échoué — la route de chat télécharge à la volée. Seuls les vrais téléchargements sont limités (20 par IP et par quart d’heure) ; les lectures en cache ne sont pas comptées.

Certaines compagnies (AXA) **refusent les requêtes venant d’adresses IP de datacenter** : le même PDF répond `200` depuis un poste de travail et `403` depuis Railway. Pour ces documents, le cache doit être rempli depuis un réseau non bloqué :

```bash
npm run migrate                                 # crée document_texts
npm run ingest:documents -- --limit 10          # test rapide
npm run ingest:documents -- --partner "AG Insurance"
npm run ingest:documents -- --id sector-…
npm run ingest:documents -- --force             # rafraîchit le cache
npm run ingest:documents -- --dry-run           # liste sans télécharger
```

L’ingestion est incrémentale (les documents déjà en cache sont ignorés) et les échecs sont regroupés par motif en fin d’exécution. Un PDF non mis en cache reste lu en direct, avec un message explicite si l’hôte refuse la requête.

**Attention à la taille** : le texte est conservé intégralement (jusqu’à 80 000 caractères par document). Ingérer l’ensemble des ~2 957 documents du catalogue peut représenter plusieurs dizaines de Mo et consommer une part notable du quota de stockage Neon (512 Mo sur l’offre gratuite). Ciblez un sous-ensemble avec `--partner` ou `--limit`, ou ingérez au fil des besoins.

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
