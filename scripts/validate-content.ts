/**
 * Content sanity checks beyond what the collection schemas enforce at build:
 * - every local document fileUrl resolves to a file in public/
 * - navigation links point to existing pages/content
 * - document ids are unique
 *
 * Run: npm run validate
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors: string[] = [];

// --- documents.json ---
const docs: { id: string; fileUrl: string; source: string }[] = JSON.parse(
  readFileSync(join(ROOT, 'src/content/documents/documents.json'), 'utf8')
);

const ids = new Set<string>();
for (const doc of docs) {
  if (ids.has(doc.id)) errors.push(`documents.json: duplicate id "${doc.id}"`);
  ids.add(doc.id);
  if (doc.source === 'local') {
    const local = join(ROOT, 'public', doc.fileUrl);
    if (!existsSync(local)) errors.push(`documents.json: "${doc.id}" points to missing file public${doc.fileUrl}`);
  }
  if (doc.source === 'portal' && doc.fileUrl.startsWith('/')) {
    errors.push(`documents.json: portal entry "${doc.id}" should use an absolute portal URL`);
  }
}

// --- every service has a card photo ---
import { readdirSync, statSync } from 'node:fs';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const full = join(dir, f);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const serviceIds = walk(join(ROOT, 'src/content/services'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.slice(join(ROOT, 'src/content/services').length + 1, -3));

for (const id of serviceIds) {
  const photo = join(ROOT, 'public/images/photos', `${id.replaceAll('/', '-')}.jpg`);
  if (!existsSync(photo)) errors.push(`services: "${id}" has no card photo at public/images/photos/`);
}

// --- navigation → content/pages ---
const nav = readFileSync(join(ROOT, 'src/data/navigation.ts'), 'utf8');
const hrefs = [...nav.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]!);
for (const href of hrefs) {
  if (href.startsWith('http') || href.includes('#')) continue;
  const clean = href.replace(/^\//, '');
  const candidates = [
    join(ROOT, 'src/pages', `${clean}.astro`),
    join(ROOT, 'src/content/services', `${clean}.md`),
    join(ROOT, 'src/pages', clean, 'index.astro')
  ];
  if (!candidates.some(existsSync)) errors.push(`navigation.ts: "${href}" has no matching page or service content`);
}

if (errors.length) {
  console.error(`✗ ${errors.length} validation error(s):\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✓ Content validation passed (${docs.length} documents, ${hrefs.length} nav links).`);
