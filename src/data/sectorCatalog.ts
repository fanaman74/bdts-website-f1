import rawDocuments from './sectorcatalog-documents.json';
import rawMeta from './sectorcatalog-documents-meta.json';
import type { DocumentItem } from '../components/DocumentsFilter';

interface SectorCatalogRecord {
  id: string;
  title: string;
  company: string;
  domain: string;
  category: string;
  product: string;
  target: 'PERSONAL' | 'PROFESSIONAL' | 'ENTERPRISE' | 'PUBLIC';
  url: string;
  lang: string;
  date: string;
}

const TYPE_BY_CATEGORY: Record<string, DocumentItem['documentType']> = {
  'Information contractuelle produit (cond. gén.)': 'conditions-generales',
  'IPID - Insurance Product Information Document': 'fiche-info',
  'KID - Key Information Document': 'fiche-info',
  'Information commerciale produit': 'commercial',
  'Information commerciale produit et campagne marketing': 'commercial',
  'Information légale / fiscale': 'legal'
};

function audienceFor(target: SectorCatalogRecord['target']): DocumentItem['audience'] {
  if (target === 'PERSONAL') return 'particulier';
  if (target === 'PUBLIC') return 'both';
  return 'professionnel';
}

/**
 * Snapshot of the French public Sector Catalog export used by the former BDTS
 * website. The original insurer URL stays intact so every result opens the
 * source document rather than a copied or proxied file.
 */
export const sectorCatalogDocuments: DocumentItem[] = (rawDocuments as SectorCatalogRecord[]).map((document) => ({
  id: `sector-${document.id.toLowerCase()}`,
  title: document.title,
  partner: document.company,
  audience: audienceFor(document.target),
  category: document.domain || 'Sans catégorie',
  productType: document.product,
  documentType: TYPE_BY_CATEGORY[document.category] ?? 'other',
  language: document.lang.toLowerCase(),
  fileUrl: document.url,
  externalUrl: document.url,
  source: 'external',
  lastUpdated: document.date && !document.date.startsWith('1970') ? document.date : undefined,
  tags: [document.domain, document.category, document.product, document.target].filter(Boolean)
}));

export const sectorCatalogMeta = rawMeta as { syncedAt: string; count: number };
