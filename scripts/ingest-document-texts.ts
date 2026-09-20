/**
 * Warm the extracted-text cache for catalogue PDFs.
 *
 * Run this from a normal network. Some insurers (AXA) refuse requests from
 * datacenter IPs, so a fetch that succeeds here can return 403 on Railway —
 * ingesting locally is what makes those documents answerable in production.
 *
 * Each document is downloaded, parsed once, and stored in public.document_texts
 * so the assistant reuses it instead of downloading the PDF again.
 *
 * Run:
 *   npm run ingest:documents                        # whole catalogue
 *   npm run ingest:documents -- --limit 10          # smoke test
 *   npm run ingest:documents -- --partner "AG Insurance"
 *   npm run ingest:documents -- --id sector-5c2780d0-83ca-e811-80d9-005056a43bd4
 *   npm run ingest:documents -- --force             # refresh cached copies
 *   npm run ingest:documents -- --dry-run           # list what would run
 *   npm run ingest:documents -- --delay 1500        # slower, gentler on hosts
 *
 * Documents already cached are skipped, so re-running is cheap and incremental.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sectorCatalogDocuments } from '../src/data/sectorCatalog';
import { getCachedDocumentText, saveDocumentText } from '../src/lib/documentText';
import { getDbClient } from '../src/lib/db';
import { fetchDocumentText } from '../src/lib/pdfText';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// tsx does not load .env automatically; Node >= 22.12 exposes loadEnvFile().
try {
  process.loadEnvFile(join(ROOT, '.env'));
} catch {
  // No .env file: rely on the ambient environment.
}

const argv = process.argv.slice(2);
const hasFlag = (name: string) => argv.includes(`--${name}`);
const option = (name: string) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
};

const idFilter = option('id');
const partnerFilter = option('partner')?.toLowerCase();
const limit = option('limit') ? Number(option('limit')) : undefined;
const delayMs = option('delay') ? Number(option('delay')) : 750;
const force = hasFlag('force');
const dryRun = hasFlag('dry-run');

if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
  console.error('✗ --limit must be a positive number.');
  process.exit(1);
}
if (!Number.isFinite(delayMs) || delayMs < 0) {
  console.error('✗ --delay must be zero or a positive number of milliseconds.');
  process.exit(1);
}

let targets = sectorCatalogDocuments;
if (idFilter) targets = targets.filter((document) => document.id === idFilter);
if (partnerFilter) targets = targets.filter((document) => document.partner.toLowerCase().includes(partnerFilter));
if (limit !== undefined) targets = targets.slice(0, limit);

if (targets.length === 0) {
  console.error('✗ No catalogue documents matched those filters.');
  process.exit(1);
}

const db = getDbClient();
if (!db) {
  console.error('✗ DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.');
  process.exit(1);
}

console.log(`Targets: ${targets.length} document(s) from a catalogue of ${sectorCatalogDocuments.length}`);
console.log(`Mode: ${dryRun ? 'dry run' : force ? 'force refresh' : 'fill gaps'} · delay ${delayMs}ms${limit ? ` · limit ${limit}` : ''}`);
console.log('');

let ingested = 0;
let skipped = 0;
let failed = 0;
const failures: string[] = [];

for (let index = 0; index < targets.length; index += 1) {
  const document = targets[index]!;
  const url = document.externalUrl || document.fileUrl;
  const position = `${index + 1}/${targets.length}`;

  if (!force) {
    const cached = await getCachedDocumentText(document.id).catch(() => null);
    if (cached) {
      skipped += 1;
      continue;
    }
  }

  if (dryRun) {
    console.log(`  → ${position} ${document.partner} — would fetch ${document.id}`);
    continue;
  }

  try {
    const extracted = await fetchDocumentText(url);
    await saveDocumentText(document.id, url, extracted.text, extracted.truncated);
    ingested += 1;
    const suffix = extracted.truncated ? ' (truncated)' : '';
    console.log(`  ✓ ${position} ${String(extracted.text.length).padStart(6)} chars${suffix}  ${document.partner} — ${document.id}`);
  } catch (error) {
    failed += 1;
    const reason = error instanceof Error ? error.message : 'erreur inconnue';
    failures.push(reason);
    console.warn(`  ✗ ${position} ${reason}  ${document.partner} — ${document.id}`);
  }

  if (delayMs > 0 && index < targets.length - 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

console.log('');
console.log(`✓ ingested ${ingested} · skipped ${skipped} already cached · failed ${failed} · of ${targets.length}`);

if (failures.length > 0) {
  const grouped = new Map<string, number>();
  for (const reason of failures) grouped.set(reason, (grouped.get(reason) ?? 0) + 1);

  console.log('');
  console.log('Failure reasons (these documents are still fetched live at question time,');
  console.log('and will fail from a host that the insurer blocks):');
  for (const [reason, count] of [...grouped].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}×  ${reason}`);
  }
}
