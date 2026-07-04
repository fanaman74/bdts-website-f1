/**
 * Ethical discovery of publicly linked documents on the BDTS reference site.
 *
 * - Fetches only public pages (respects robots.txt disallow rules)
 * - Rate-limited: 1 request / 1.5s
 * - Never touches authenticated portals (MyBroker, My AG…)
 * - Results go to data/discovered-documents.json
 *
 * Run: npm run discover
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://www.bdts.be';
const START_PAGES = [`${BASE}/fr-be/documents`, `${BASE}/fr-be`];
const FILE_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip'];
const PORTAL_HOSTS = ['mybroker.be', 'aginsurance.be']; // never crawled, only recorded as external links
const RATE_LIMIT_MS = 1500;
const MAX_PAGES = 25;
const USER_AGENT = 'MeridianCourtage-DocDiscovery/1.0 (contact: info@meridian-courtage.be)';

interface DiscoveredDocument {
  sourcePage: string;
  title: string;
  url: string;
  fileType: string;
  isExternal: boolean;
  discoveredAt: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
    if (!res.ok) {
      console.warn(`  ! ${res.status} ${res.statusText} — ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`  ! fetch failed — ${url}: ${(err as Error).message}`);
    return null;
  }
}

async function loadRobotsDisallows(): Promise<string[]> {
  const txt = await fetchText(`${BASE}/robots.txt`);
  if (!txt) return [];
  const disallows: string[] = [];
  let applies = false;
  for (const raw of txt.split('\n')) {
    const line = raw.trim();
    if (/^user-agent:/i.test(line)) applies = /:\s*\*\s*$/.test(line);
    else if (applies && /^disallow:/i.test(line)) {
      const path = line.split(':')[1]?.trim();
      if (path) disallows.push(path);
    }
  }
  return disallows;
}

function isAllowed(url: string, disallows: string[]): boolean {
  try {
    const { pathname, hostname } = new URL(url);
    if (PORTAL_HOSTS.some((h) => hostname.endsWith(h))) return false; // portals are off-limits
    return !disallows.some((d) => pathname.startsWith(d));
  } catch {
    return false;
  }
}

function extractAnchors(html: string, pageUrl: string): { href: string; text: string }[] {
  const anchors: { href: string; text: string }[] = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const href = new URL(m[1]!, pageUrl).href;
      const text = m[2]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      anchors.push({ href, text });
    } catch {
      /* malformed URL — skip */
    }
  }
  return anchors;
}

async function main() {
  console.log('Discovering public documents on', BASE);
  const disallows = await loadRobotsDisallows();
  console.log(`robots.txt disallow rules: ${disallows.length ? disallows.join(', ') : '(none)'}`);

  const queue = [...START_PAGES];
  const visited = new Set<string>();
  const documents: DiscoveredDocument[] = [];
  const externalLinks = new Set<string>();

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const page = queue.shift()!;
    if (visited.has(page)) continue;
    visited.add(page);

    if (!isAllowed(page, disallows)) {
      console.log(`  skipped (robots/portal): ${page}`);
      continue;
    }

    console.log(`→ ${page}`);
    const html = await fetchText(page);
    await sleep(RATE_LIMIT_MS);
    if (!html) continue;

    for (const { href, text } of extractAnchors(html, page)) {
      const url = new URL(href);
      const ext = FILE_EXTENSIONS.find((e) => url.pathname.toLowerCase().endsWith(e));
      const isExternal = url.hostname !== new URL(BASE).hostname;

      if (ext) {
        documents.push({
          sourcePage: page,
          title: text || url.pathname.split('/').pop() || href,
          url: href,
          fileType: ext.slice(1),
          isExternal,
          discoveredAt: new Date().toISOString()
        });
      } else if (isExternal) {
        externalLinks.add(href);
      } else if (
        // follow same-site service/navigation pages only
        /\/fr-be\//.test(url.pathname) &&
        !visited.has(href) &&
        queue.length + visited.size < MAX_PAGES
      ) {
        queue.push(href.split('?')[0]!);
      }
    }
  }

  const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'discovered-documents.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        crawledAt: new Date().toISOString(),
        pagesVisited: [...visited],
        documents,
        externalPartnerLinks: [...externalLinks].sort()
      },
      null,
      2
    )
  );

  console.log(`\nDone. ${documents.length} file link(s), ${externalLinks.size} external link(s).`);
  console.log(`Results: ${outPath}`);
  if (documents.length === 0) {
    console.log(
      'No public files found — the site catalogue keeps using the manual document collection (source: "manual"/"portal").'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
