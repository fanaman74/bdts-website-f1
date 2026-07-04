/**
 * Import a CSV catalogue into src/content/documents/documents.json.
 *
 * Expected columns:
 * title,partner,audience,category,productType,documentType,language,fileUrl,externalUrl,source,lastUpdated,description,tags
 * ("tags" uses ; as separator inside the cell)
 *
 * Run: npm run import:documents -- path/to/file.csv
 * Existing entries with the same generated id are updated, new ones appended.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGET = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'documents', 'documents.json');

const REQUIRED = ['title', 'partner', 'audience', 'category', 'productType', 'documentType', 'language', 'fileUrl', 'source'];
const AUDIENCES = ['particulier', 'professionnel', 'both'];
const DOC_TYPES = ['conditions-generales', 'fiche-info', 'commercial', 'legal', 'claim-form', 'other'];
const LANGUAGES = ['fr', 'nl', 'en'];
const SOURCES = ['local', 'external', 'portal', 'manual'];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: npm run import:documents -- path/to/file.csv');
  process.exit(1);
}

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const header = rows.shift()?.map((h) => h.trim());
if (!header) throw new Error('Empty CSV');

const missing = REQUIRED.filter((c) => !header.includes(c));
if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}`);

const existing: Record<string, unknown>[] = JSON.parse(readFileSync(TARGET, 'utf8'));
const byId = new Map(existing.map((e) => [e.id as string, e]));

let added = 0;
let updated = 0;
const errors: string[] = [];

rows.forEach((cells, idx) => {
  const rec: Record<string, string> = {};
  header.forEach((col, i) => (rec[col] = (cells[i] ?? '').trim()));

  const line = idx + 2;
  for (const col of REQUIRED) {
    if (!rec[col]) errors.push(`line ${line}: missing "${col}"`);
  }
  if (rec.audience && !AUDIENCES.includes(rec.audience)) errors.push(`line ${line}: bad audience "${rec.audience}"`);
  if (rec.documentType && !DOC_TYPES.includes(rec.documentType))
    errors.push(`line ${line}: bad documentType "${rec.documentType}"`);
  if (rec.language && !LANGUAGES.includes(rec.language)) errors.push(`line ${line}: bad language "${rec.language}"`);
  if (rec.source && !SOURCES.includes(rec.source)) errors.push(`line ${line}: bad source "${rec.source}"`);
  if (errors.length) return;

  const id = slugify(`${rec.partner}-${rec.title}-${rec.language}`);
  const entry = {
    id,
    title: rec.title,
    partner: rec.partner,
    audience: rec.audience,
    category: rec.category,
    productType: rec.productType,
    documentType: rec.documentType,
    language: rec.language,
    fileUrl: rec.fileUrl,
    ...(rec.externalUrl ? { externalUrl: rec.externalUrl } : {}),
    source: rec.source,
    ...(rec.lastUpdated ? { lastUpdated: rec.lastUpdated } : {}),
    ...(rec.description ? { description: rec.description } : {}),
    tags: rec.tags ? rec.tags.split(';').map((t) => t.trim()).filter(Boolean) : []
  };

  if (byId.has(id)) {
    Object.assign(byId.get(id)!, entry);
    updated++;
  } else {
    existing.push(entry);
    byId.set(id, entry);
    added++;
  }
});

if (errors.length) {
  console.error('Import aborted:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

writeFileSync(TARGET, JSON.stringify(existing, null, 2) + '\n');
console.log(`Imported: ${added} added, ${updated} updated → ${TARGET}`);
