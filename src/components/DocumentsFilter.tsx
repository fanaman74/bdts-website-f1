import { useMemo, useState } from 'preact/hooks';
import { getDocumentAccessMeta } from '../lib/documentAccess';
import DocumentChat from './DocumentChat';

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

const DOMAIN_LABEL: Record<string, string> = {
  Auto: 'Mobilité',
  'Incendie risques simples': 'Habitation',
  'Incendie risques spéciaux': 'Habitation',
  'RC du particulier': 'Famille',
  'Protection juridique': 'Protection juridique',
  'Hospitalisation et soins de santé': 'Santé',
  'Vie et placements': 'Épargne',
  'Accidents du travail et assurances collectives': 'Personnel',
  'RC autre que particuliers': 'Entreprise',
  'Responsabilité Objective et immeuble': 'Entreprise',
  Voyage: 'Voyage',
  Assistance: 'Assistance',
  Individuelle: 'Individuelle',
  Divers: 'Divers',
  'Multi-domaine (packages)': 'Multi-domaine',
  'Transport & marine': 'Transport',
  Prêt: 'Crédit',
  'Pas de domaine': 'Autres',
  'Sans catégorie': 'Autres'
};

const TYPE_LABEL: Record<string, string> = {
  'conditions-generales': 'Conditions générales',
  'fiche-info': 'Fiche info / IPID',
  commercial: 'Commercial',
  legal: 'Légal / fiscal',
  'claim-form': 'Formulaire sinistre',
  other: 'Autre'
};

const DOMAIN_DOT: Record<string, string> = {
  Habitation: 'bg-orange-400',
  Mobilité: 'bg-blue-500',
  Famille: 'bg-yellow-400',
  Santé: 'bg-emerald-500',
  Épargne: 'bg-amber-500',
  Entreprise: 'bg-slate-700',
  Personnel: 'bg-violet-400',
  'Protection juridique': 'bg-purple-400',
  Voyage: 'bg-sky-400',
  Assistance: 'bg-rose-400',
  Divers: 'bg-teal-400',
  'Multi-domaine': 'bg-fuchsia-400',
  Individuelle: 'bg-lime-500',
  Transport: 'bg-cyan-500',
  Crédit: 'bg-pink-400',
  Autres: 'bg-stone-400'
};

const COMPANY_COLOR: Record<string, string> = {
  'AG Insurance': 'bg-orange-600 text-white',
  ARAG: 'bg-indigo-600 text-white',
  'AXA Assistance': 'bg-cyan-700 text-white',
  'AXA Belgium': 'bg-blue-600 text-white',
  Aedes: 'bg-emerald-700 text-white',
  Allianz: 'bg-teal-600 text-white',
  Arces: 'bg-purple-600 text-white',
  BDM: 'bg-rose-600 text-white',
  'Baloise Insurance': 'bg-red-600 text-white',
  DAS: 'bg-amber-600 text-white',
  'DKV Belgium': 'bg-green-700 text-white',
  'Euromex N.V.': 'bg-sky-600 text-white',
  'Europ Assistance Belgium': 'bg-lime-700 text-white',
  'JEAN VERHEYEN': 'bg-pink-600 text-white',
  Mensura: 'bg-violet-600 text-white',
  'NN Insurance Belgium': 'bg-orange-700 text-white',
  'Protect nv': 'bg-slate-600 text-white',
  VIVIUM: 'bg-fuchsia-600 text-white'
};

const TYPE_COLOR: Record<string, string> = {
  'conditions-generales': 'bg-indigo-100 text-indigo-700',
  'fiche-info': 'bg-emerald-100 text-emerald-700',
  commercial: 'bg-amber-100 text-amber-700',
  legal: 'bg-cyan-100 text-cyan-700',
  'claim-form': 'bg-rose-100 text-rose-700',
  other: 'bg-stone-100 text-stone-600'
};

function domainLabel(value: string): string {
  return DOMAIN_LABEL[value] ?? (value.trim() || 'Autres');
}

function PdfIcon() {
  return (
    <svg class="h-8 w-8 shrink-0 text-[#c08e3a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6M9 9h2" />
    </svg>
  );
}

function DocumentRow({ document, onChat }: { document: DocumentItem; onChat: (document: DocumentItem) => void }) {
  const access = getDocumentAccessMeta(document.source, document.fileUrl, document.externalUrl);
  const unavailable = access.accessLabel === 'Document sur demande';
  const contactHref = `/contact?document=${encodeURIComponent(document.title)}`;

  return (
    <article class="group flex items-center gap-3 rounded-2xl border border-[#d8cbb6] bg-[#f2e9d9] px-4 py-4 transition-all duration-200 hover:translate-x-0.5 hover:border-[#c08e3a] hover:shadow-sm sm:gap-4">
      <PdfIcon />

      <div class="min-w-0 flex-1">
        <h3 class="line-clamp-2 text-sm font-semibold leading-snug text-[#2f2b24]">{document.title}</h3>
        <p class="mt-1 truncate text-xs text-[#766952]">{document.productType || document.category}</p>
      </div>

      <span class={`hidden min-w-[110px] shrink-0 items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap sm:inline-flex ${COMPANY_COLOR[document.partner] ?? 'bg-[#606c38] text-[#f2e9d9]'}`}>
        {document.partner}
      </span>

      <span class={`hidden shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap md:inline-flex ${TYPE_COLOR[document.documentType] ?? TYPE_COLOR.other}`}>
        {TYPE_LABEL[document.documentType] ?? document.documentType}
      </span>

      <button type="button" onClick={() => onChat(document)} class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-600 transition-colors hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500" aria-label={`Ouvrir l’assistant pour ${document.title}`} aria-haspopup="dialog">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      </button>

      <a href={unavailable ? contactHref : access.href} target={access.opensExternally && !unavailable ? '_blank' : undefined} rel={access.opensExternally && !unavailable ? 'noopener noreferrer' : undefined} class={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${unavailable ? 'border-[#cbb990] bg-[#e8dcc7] text-[#766952] hover:bg-[#d4b895]' : 'border-orange-200 bg-orange-50 text-orange-600 hover:border-orange-300 hover:bg-orange-100'}`} aria-label={`${access.actionLabel} : ${document.title}`} title={access.actionLabel}>
        {unavailable ? <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v14H4zM4 7l8 6 8-6" /></svg> : <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" /></svg>}
      </a>
    </article>
  );
}

export default function DocumentsFilter({ documents, syncedAt }: Props) {
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('Tous');
  const [selectedPartner, setSelectedPartner] = useState('Tous');
  const [selectedType, setSelectedType] = useState('Tous');
  const [selectedYear, setSelectedYear] = useState('Toutes');
  const [page, setPage] = useState(1);
  const [activeDocument, setActiveDocument] = useState<DocumentItem | null>(null);

  const domainCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const document of documents) {
      const label = domainLabel(document.category);
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return counts;
  }, [documents]);

  const domains = useMemo(() => ['Tous', ...Object.keys(domainCounts).sort((left, right) => domainCounts[right] - domainCounts[left])], [domainCounts]);
  const partners = useMemo(() => ['Tous', ...new Set(documents.map((document) => document.partner))].sort((left, right) => left === 'Tous' ? -1 : right === 'Tous' ? 1 : left.localeCompare(right, 'fr')), [documents]);
  const types = useMemo(() => ['Tous', ...new Set(documents.map((document) => document.documentType))].sort((left, right) => left === 'Tous' ? -1 : right === 'Tous' ? 1 : (TYPE_LABEL[left] ?? left).localeCompare(TYPE_LABEL[right] ?? right, 'fr')), [documents]);
  const years = useMemo(() => ['Toutes', ...new Set(documents.flatMap((document) => document.lastUpdated ? [document.lastUpdated.slice(0, 4)] : []))].sort((left, right) => left === 'Toutes' ? -1 : right === 'Toutes' ? 1 : Number(right) - Number(left)), [documents]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr-BE');
    return documents.filter((document) => {
      if (selectedDomain !== 'Tous' && domainLabel(document.category) !== selectedDomain) return false;
      if (selectedPartner !== 'Tous' && document.partner !== selectedPartner) return false;
      if (selectedType !== 'Tous' && document.documentType !== selectedType) return false;
      if (selectedYear !== 'Toutes' && (!document.lastUpdated || document.lastUpdated.slice(0, 4) !== selectedYear)) return false;
      if (!query) return true;
      return [document.title, document.partner, document.productType, document.category, ...document.tags].some((value) => value.toLocaleLowerCase('fr-BE').includes(query));
    });
  }, [documents, search, selectedDomain, selectedPartner, selectedType, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const pageDocuments = filtered.slice(pageStart, pageEnd);

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function pageNumbers(): Array<number | '…'> {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const pages: Array<number | '…'> = [1];
    if (safePage > 3) pages.push('…');
    for (let current = Math.max(2, safePage - 1); current <= Math.min(totalPages - 1, safePage + 1); current++) pages.push(current);
    if (safePage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  }

  const selectClass = 'rounded-xl border border-[#d8cbb6] bg-[#f2e9d9] px-3 py-2 text-sm text-[#2f2b24] focus:border-[#c08e3a] focus:outline-none';

  return (
    <div class="space-y-6">
      <div class="relative">
        <svg class="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-[#766952]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input type="search" value={search} onInput={(event) => updateFilter(setSearch, (event.target as HTMLInputElement).value)} placeholder="Rechercher un document, une compagnie ou un produit…" aria-label="Rechercher un document" class="w-full rounded-2xl border border-[#d8cbb6] bg-[#f2e9d9] py-3 pr-4 pl-12 text-sm text-[#2f2b24] placeholder:text-[#766952] focus:border-[#c08e3a] focus:outline-none" />
      </div>

      <div class="flex flex-wrap gap-2" aria-label="Filtrer par domaine">
        {domains.map((domain) => {
          const active = selectedDomain === domain;
          const count = domain === 'Tous' ? documents.length : domainCounts[domain];
          return <button type="button" key={domain} onClick={() => updateFilter(setSelectedDomain, domain)} class={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'border-[#606c38] bg-[#606c38] text-[#f2e9d9]' : 'border-[#d8cbb6] bg-[#f2e9d9] text-[#554c3c] hover:border-[#606c38]'}`}>
            {domain === 'Tous' ? <span class="inline-flex gap-0.5"><span class="h-1.5 w-1.5 rounded-full bg-orange-400" /><span class="h-1.5 w-1.5 rounded-full bg-blue-500" /><span class="h-1.5 w-1.5 rounded-full bg-emerald-500" /></span> : <span class={`h-2 w-2 rounded-full ${DOMAIN_DOT[domain] ?? 'bg-stone-400'}`} />}
            {domain}<span class={`text-[10px] font-normal ${active ? 'text-[#e8dcc7]' : 'text-[#766952]'}`}>{count.toLocaleString('fr-BE')}</span>
          </button>;
        })}
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <label class="sr-only" for="documents-partner">Compagnie</label>
        <select id="documents-partner" value={selectedPartner} onChange={(event) => updateFilter(setSelectedPartner, (event.target as HTMLSelectElement).value)} class={selectClass}>
          {partners.map((partner) => <option key={partner} value={partner}>{partner === 'Tous' ? 'Toutes les compagnies' : partner}</option>)}
        </select>

        <label class="sr-only" for="documents-type">Type de document</label>
        <select id="documents-type" value={selectedType} onChange={(event) => updateFilter(setSelectedType, (event.target as HTMLSelectElement).value)} class={selectClass}>
          {types.map((type) => <option key={type} value={type}>{type === 'Tous' ? 'Tous les types' : TYPE_LABEL[type] ?? type}</option>)}
        </select>

        <label class="sr-only" for="documents-year">Année</label>
        <select id="documents-year" value={selectedYear} onChange={(event) => updateFilter(setSelectedYear, (event.target as HTMLSelectElement).value)} class={selectClass}>
          {years.map((year) => <option key={year} value={year}>{year === 'Toutes' ? 'Toutes les années' : year}</option>)}
        </select>

        {syncedAt && <p class="ml-auto text-xs text-[#766952]">Catalogue synchronisé le {new Date(syncedAt).toLocaleDateString('fr-BE')}</p>}
      </div>

      <p class="text-sm text-[#766952]" role="status" aria-live="polite">
        {filtered.length === 0 ? 'Aucun document trouvé' : `${(pageStart + 1).toLocaleString('fr-BE')}–${pageEnd.toLocaleString('fr-BE')} sur ${filtered.length.toLocaleString('fr-BE')} documents`}
      </p>

      {filtered.length === 0 ? <div class="rounded-2xl bg-[#e8dcc7] p-10 text-center"><p class="font-semibold text-[#2f2b24]">Aucun document ne correspond à votre recherche.</p><button type="button" class="mt-4 text-sm font-semibold text-[#606c38] underline" onClick={() => { setSearch(''); setSelectedDomain('Tous'); setSelectedPartner('Tous'); setSelectedType('Tous'); setSelectedYear('Toutes'); setPage(1); }}>Réinitialiser les filtres</button></div> : <div class="space-y-2">{pageDocuments.map((document) => <DocumentRow key={document.id} document={document} onChat={setActiveDocument} />)}</div>}

      {totalPages > 1 && <nav class="flex items-center justify-center gap-1.5" aria-label="Pagination des documents">
        <button type="button" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1} class="rounded-xl border border-[#d8cbb6] bg-[#f2e9d9] px-3 py-2 text-sm font-medium text-[#2f2b24] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Page précédente">←</button>
        {pageNumbers().map((number, index) => number === '…' ? <span key={`ellipsis-${index}`} class="px-2 text-sm text-[#766952]">…</span> : <button type="button" key={number} onClick={() => setPage(number)} class={`min-w-9 rounded-xl border px-3 py-2 text-sm font-medium ${number === safePage ? 'border-[#606c38] bg-[#606c38] text-[#f2e9d9]' : 'border-[#d8cbb6] bg-[#f2e9d9] text-[#2f2b24]'}`} aria-current={number === safePage ? 'page' : undefined}>{number}</button>)}
        <button type="button" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages} class="rounded-xl border border-[#d8cbb6] bg-[#f2e9d9] px-3 py-2 text-sm font-medium text-[#2f2b24] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Page suivante">→</button>
      </nav>}

      {activeDocument && <DocumentChat documentId={activeDocument.id} docTitle={activeDocument.title} company={activeDocument.partner} onClose={() => setActiveDocument(null)} />}
    </div>
  );
}
