import { useMemo, useState } from 'preact/hooks';
import Fuse from 'fuse.js';
import { getDocumentAccessMeta } from '../lib/documentAccess';

export interface DocumentItem {
  id: string;
  title: string;
  partner: string;
  audience: 'particulier' | 'professionnel' | 'both';
  category: string;
  productType: string;
  documentType: string;
  language: string;
  fileUrl: string;
  externalUrl?: string;
  source: 'local' | 'external' | 'portal' | 'manual';
  lastUpdated?: string;
  description?: string;
  tags: string[];
}

interface Props {
  documents: DocumentItem[];
  syncedAt?: string;
}

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<string, string> = {
  'conditions-generales': 'Conditions générales',
  'fiche-info': 'Fiche info',
  commercial: 'Brochure',
  legal: 'Légal',
  'claim-form': 'Formulaire sinistre',
  other: 'Autre'
};

const AUDIENCE_LABELS: Record<string, string> = {
  particulier: 'Particulier',
  professionnel: 'Professionnel',
  both: 'Les deux'
};

const SOURCE_LABELS: Record<string, string> = {
  local: 'PDF local',
  external: 'Lien partenaire',
  portal: 'Portail uniquement',
  manual: 'Catalogue manuel'
};

const ACCESS_FILTERS = ['all', 'pdf', 'page', 'portal', 'internal'] as const;
type AccessFilter = (typeof ACCESS_FILTERS)[number];

const ACCESS_LABELS: Record<AccessFilter, string> = {
  all: 'Tous les acces',
  pdf: 'PDF directs',
  page: 'Pages partenaires',
  portal: 'Portails',
  internal: 'Pages BDTS'
};

type SortKey = 'recent' | 'az' | 'partner' | 'category';

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'fr'));
}

export default function DocumentsFilter({ documents, syncedAt }: Props) {
  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState('');
  const [category, setCategory] = useState('');
  const [partner, setPartner] = useState('');
  const [docType, setDocType] = useState('');
  const [language, setLanguage] = useState('');
  const [source, setSource] = useState('');
  const [accessType, setAccessType] = useState<AccessFilter>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [page, setPage] = useState(1);

  const fuse = useMemo(
    () =>
      new Fuse(documents, {
        keys: ['title', 'partner', 'category', 'documentType', 'productType', 'tags', 'description'],
        threshold: 0.35,
        ignoreLocation: true
      }),
    [documents]
  );

  const categories = useMemo(() => uniqueSorted(documents.map((d) => d.category)), [documents]);
  const partners = useMemo(() => uniqueSorted(documents.map((d) => d.partner)), [documents]);
  const languages = useMemo(() => uniqueSorted(documents.map((d) => d.language)), [documents]);
  const types = useMemo(() => uniqueSorted(documents.map((d) => d.documentType)), [documents]);
  const sources = useMemo(() => uniqueSorted(documents.map((d) => d.source)), [documents]);

  const hasFilters = query || audience || category || partner || docType || language || source || accessType !== 'all';

  const results = useMemo(() => {
    let list = query.trim() ? fuse.search(query.trim()).map((r) => r.item) : [...documents];

    if (audience) list = list.filter((d) => d.audience === audience || d.audience === 'both');
    if (category) list = list.filter((d) => d.category === category);
    if (partner) list = list.filter((d) => d.partner === partner);
    if (docType) list = list.filter((d) => d.documentType === docType);
    if (language) list = list.filter((d) => d.language === language);
    if (source) list = list.filter((d) => d.source === source);
    if (accessType !== 'all') {
      list = list.filter((d) => {
        const access = getDocumentAccessMeta(d.source, d.fileUrl, d.externalUrl);
        if (accessType === 'pdf') return access.accessLabel === 'PDF direct';
        if (accessType === 'page') return access.accessLabel === 'Page partenaire';
        if (accessType === 'portal') return access.accessLabel === 'Portail sécurisé';
        if (accessType === 'internal') return access.accessLabel === 'Page BDTS';
        return true;
      });
    }

    const sorters: Record<SortKey, (a: DocumentItem, b: DocumentItem) => number> = {
      recent: (a, b) => (b.lastUpdated ?? '').localeCompare(a.lastUpdated ?? ''),
      az: (a, b) => a.title.localeCompare(b.title, 'fr'),
      partner: (a, b) => a.partner.localeCompare(b.partner, 'fr') || a.title.localeCompare(b.title, 'fr'),
      category: (a, b) => a.category.localeCompare(b.category, 'fr') || a.title.localeCompare(b.title, 'fr')
    };
    // Keep Fuse relevance order when searching without explicit sort change
    if (!(query.trim() && sort === 'recent')) list.sort(sorters[sort]);
    return list;
  }, [documents, fuse, query, audience, category, partner, docType, language, source, accessType, sort]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageDocuments = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const updateFilter = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };

  const reset = () => {
    setQuery('');
    setAudience('');
    setCategory('');
    setPartner('');
    setDocType('');
    setLanguage('');
    setSource('');
    setAccessType('all');
    setSort('recent');
    setPage(1);
  };

  const selectClass =
    'w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm text-ink-800 ring-1 ring-ink-200 focus:ring-2 focus:ring-pulse-500';

  return (
    <div>
      {/* Search + sort */}
      <div class="flex flex-col gap-3 sm:flex-row">
        <div class="relative flex-1">
          <svg
            class="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-ink-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clip-rule="evenodd"
            />
          </svg>
          <input
            type="search"
            value={query}
            onInput={(e) => updateFilter(setQuery, (e.target as HTMLInputElement).value)}
            placeholder="Rechercher un document, un partenaire, un produit…"
            aria-label="Rechercher un document"
            class="w-full rounded-full border-0 bg-white py-3 pr-4 pl-12 text-sm text-ink-900 shadow-sm ring-1 ring-ink-200 placeholder:text-ink-400 focus:ring-2 focus:ring-pulse-500"
          />
        </div>
        <label class="flex items-center gap-2 text-sm font-medium text-ink-600">
          <span class="shrink-0">Trier par</span>
          <select
            value={sort}
            onChange={(e) => updateFilter(setSort, (e.target as HTMLSelectElement).value as SortKey)}
            class="rounded-full border-0 bg-white px-4 py-3 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-pulse-500"
          >
            <option value="recent">Plus récents</option>
            <option value="az">A – Z</option>
            <option value="partner">Partenaire</option>
            <option value="category">Catégorie</option>
          </select>
        </label>
      </div>

      {/* Filters */}
      <fieldset class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <legend class="sr-only">Filtres</legend>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-500">Public</span>
          <select value={audience} onChange={(e) => updateFilter(setAudience, (e.target as HTMLSelectElement).value)} class={selectClass}>
            <option value="">Tous</option>
            {['particulier', 'professionnel', 'both'].map((a) => (
              <option value={a}>{AUDIENCE_LABELS[a]}</option>
            ))}
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-500">Catégorie</span>
          <select value={category} onChange={(e) => updateFilter(setCategory, (e.target as HTMLSelectElement).value)} class={selectClass}>
            <option value="">Toutes</option>
            {categories.map((c) => (
              <option value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-500">Partenaire</span>
          <select value={partner} onChange={(e) => updateFilter(setPartner, (e.target as HTMLSelectElement).value)} class={selectClass}>
            <option value="">Tous</option>
            {partners.map((p) => (
              <option value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-500">Type</span>
          <select value={docType} onChange={(e) => updateFilter(setDocType, (e.target as HTMLSelectElement).value)} class={selectClass}>
            <option value="">Tous</option>
            {types.map((t) => (
              <option value={t}>{TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-500">Langue</span>
          <select value={language} onChange={(e) => updateFilter(setLanguage, (e.target as HTMLSelectElement).value)} class={selectClass}>
            <option value="">Toutes</option>
            {languages.map((l) => (
              <option value={l}>{l.toUpperCase()}</option>
            ))}
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-500">Source</span>
          <select value={source} onChange={(e) => updateFilter(setSource, (e.target as HTMLSelectElement).value)} class={selectClass}>
            <option value="">Toutes</option>
            {sources.map((s) => (
              <option value={s}>{SOURCE_LABELS[s] ?? s}</option>
            ))}
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-500">Acces</span>
          <select
            value={accessType}
            onChange={(e) => updateFilter(setAccessType, (e.target as HTMLSelectElement).value as AccessFilter)}
            class={selectClass}
          >
            {ACCESS_FILTERS.map((value) => (
              <option value={value}>{ACCESS_LABELS[value]}</option>
            ))}
          </select>
        </label>
      </fieldset>

      {/* Result count + reset */}
      <div class="mt-5 flex items-center justify-between gap-4" role="status" aria-live="polite">
        <p class="text-sm font-medium text-ink-600">
          {results.length === 1 ? '1 document trouvé' : `${results.length} documents trouvés`}
          {syncedAt && <span class="ml-2 text-ink-400">Catalogue synchronisé le {new Date(syncedAt).toLocaleDateString('fr-BE')}</span>}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            class="text-sm font-semibold text-pulse-600 underline decoration-pulse-300 underline-offset-2 hover:text-pulse-700"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div class="mt-8 rounded-2xl bg-ink-50 p-10 text-center">
          <p class="mt-3 font-display font-semibold text-ink-800">
            Aucun document trouvé. Essayez de modifier vos filtres ou contactez-nous.
          </p>
          <a href="/contact" class="mt-4 inline-block rounded-full bg-pulse-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-pulse-700">
            Nous contacter
          </a>
        </div>
      ) : (
        <ul class="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {pageDocuments.map((doc) => {
            const isPortal = doc.source === 'portal';
            const access = getDocumentAccessMeta(doc.source, doc.fileUrl, doc.externalUrl);
            return (
              <li key={doc.id} class="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-100 transition hover:shadow-lg hover:ring-pulse-200">
                <div class="mb-3 flex flex-wrap gap-2">
                  <span class="rounded-full bg-pulse-50 px-2.5 py-0.5 text-xs font-semibold text-pulse-700">
                    {TYPE_LABELS[doc.documentType] ?? doc.documentType}
                  </span>
                  <span class="rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-semibold text-ink-600 uppercase">
                    {doc.language}
                  </span>
                  <span class="rounded-full bg-mint-100 px-2.5 py-0.5 text-xs font-semibold text-mint-700">
                    {access.accessLabel}
                  </span>
                  {isPortal && (
                    <span class="rounded-full bg-coral-50 px-2.5 py-0.5 text-xs font-semibold text-coral-700">
                      Portail uniquement
                    </span>
                  )}
                </div>
                <h3 class="font-display text-base font-bold text-ink-900">{doc.title}</h3>
                <p class="mt-1 text-xs font-medium text-ink-500">
                  {doc.partner} · {doc.category}
                </p>
                {access.hostLabel && <p class="mt-2 text-xs font-medium text-ink-400">Source : {access.hostLabel}</p>}
                {doc.description && <p class="mt-2 flex-1 text-sm leading-relaxed text-ink-600">{doc.description}</p>}
                <div class="mt-4 flex items-center justify-between gap-3">
                  {doc.lastUpdated ? (
                    <time dateTime={doc.lastUpdated} class="text-xs text-ink-400">
                      Mis à jour le {new Date(doc.lastUpdated).toLocaleDateString('fr-BE')}
                    </time>
                  ) : (
                    <span />
                  )}
                  <a
                    href={access.href}
                    target={access.opensExternally ? '_blank' : undefined}
                    rel={access.opensExternally ? 'noopener noreferrer' : undefined}
                    class={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                      isPortal ? 'bg-ink-100 text-ink-800 hover:bg-ink-200' : 'bg-pulse-600 text-white hover:bg-pulse-700'
                    }`}
                  >
                    {isPortal ? 'Accéder au portail' : access.actionLabel}
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {results.length > PAGE_SIZE && (
        <nav class="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination des documents">
          <button type="button" disabled={safePage === 1} onClick={() => setPage(Math.max(1, safePage - 1))} class="organic-button organic-button--sand disabled:cursor-not-allowed disabled:opacity-40">
            Précédent
          </button>
          <span class="px-4 text-sm font-semibold text-ink-600">Page {safePage} sur {pageCount}</span>
          <button type="button" disabled={safePage === pageCount} onClick={() => setPage(Math.min(pageCount, safePage + 1))} class="organic-button organic-button--moss disabled:cursor-not-allowed disabled:opacity-40">
            Suivant
          </button>
        </nav>
      )}
    </div>
  );
}
