import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { LOCALIZED_LANGUAGES, isLocalizedLanguage, localizedPath, sourcePath } from '../i18n/dictionaries';
import { isLocalizable, localizeHtml } from '../i18n/localizeHtml';

/**
 * Publishes /en/… and /nl/… copies of every French page.
 * Build: translates each prerendered page into dist. Dev: translates on request.
 * Must be listed after @astrojs/sitemap so the localized URLs can be appended.
 */
export default function localizedPages(): AstroIntegration {
  return {
    name: 'bdts-localized-pages',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (request, response, next) => {
          const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
          const language = url.pathname.split('/')[1];
          if (!isLocalizedLanguage(language) || request.method !== 'GET') return next();

          const frenchPath = sourcePath(url.pathname);
          try {
            const source = await fetch(new URL(`${frenchPath}${url.search}`, url), { headers: { accept: 'text/html' } });
            const html = await source.text();
            if (!source.ok || !(source.headers.get('content-type') ?? '').includes('text/html') || !isLocalizable(html)) return next();
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            response.end(localizeHtml(html, language, frenchPath));
          } catch (error) {
            next(error);
          }
        });
      },
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const pages = (await listHtml(root)).filter((file) => !LOCALIZED_LANGUAGES.some((language) => file.startsWith(`${language}/`)));
        const localizedUrls: string[] = [];

        for (const file of pages) {
          const html = await readFile(path.join(root, file), 'utf8');
          if (!isLocalizable(html)) continue;
          const frenchPath = file === 'index.html' ? '/' : `/${file.replace(/(?:\/index)?\.html$/, '')}/`;
          for (const language of LOCALIZED_LANGUAGES) {
            const target = path.join(root, language, file);
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, localizeHtml(html, language, frenchPath));
            localizedUrls.push(localizedPath(frenchPath, language));
          }
        }

        await appendToSitemap(root, localizedUrls);
        logger.info(`Generated ${localizedUrls.length} localized pages (${LOCALIZED_LANGUAGES.join(', ')}).`);
      }
    }
  };
}

async function listHtml(root: string, relative = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listHtml(root, child)));
    else if (entry.name.endsWith('.html')) files.push(child);
  }
  return files;
}

async function appendToSitemap(root: string, paths: string[]) {
  const sitemap = path.join(root, 'sitemap-0.xml');
  if (!existsSync(sitemap) || paths.length === 0) return;
  const xml = await readFile(sitemap, 'utf8');
  const origin = xml.match(/<loc>(https?:\/\/[^/<]+)/)?.[1];
  if (!origin) return;
  const existing = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  const entries = paths
    .map((pathname) => `${origin}${pathname}`)
    .filter((loc) => !existing.has(loc))
    .map((loc) => `<url><loc>${loc}</loc></url>`)
    .join('');
  await writeFile(sitemap, xml.replace('</urlset>', `${entries}</urlset>`));
}
