import english from './generated/en.json';
import dutch from './generated/nl.json';
import { translationOverrides } from './overrides';
import type { SiteLanguage } from './navigation';

/** Languages served from a URL prefix (/en/…, /nl/…). French is the source and has no prefix. */
export const LOCALIZED_LANGUAGES = ['en', 'nl'] as const;
export type LocalizedLanguage = (typeof LOCALIZED_LANGUAGES)[number];

export const dictionaries: Record<LocalizedLanguage, Record<string, string>> = {
  en: { ...english, ...translationOverrides.en },
  nl: { ...dutch, ...translationOverrides.nl }
};

export function isLocalizedLanguage(value: string | null | undefined): value is LocalizedLanguage {
  return value === 'en' || value === 'nl';
}

export function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** True for same-site page paths; false for API routes, built assets and files such as PDFs. */
export function isPagePath(pathname: string): boolean {
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return false;
  if (/^\/(?:api|_astro|i18n|images|videos)(?:\/|$)/.test(pathname)) return false;
  if (/^\/epso/.test(pathname)) return false;
  const lastSegment = pathname.split('/').pop() ?? '';
  return !lastSegment.includes('.');
}

/** Strips an /en or /nl prefix and returns the French source path. */
export function sourcePath(pathname: string): string {
  const match = pathname.match(/^\/(?:en|nl)(\/.*)?$/);
  return match ? match[1] || '/' : pathname;
}

export function localizedPath(pathname: string, language: SiteLanguage): string {
  const source = sourcePath(pathname);
  if (language === 'fr') return source;
  return source === '/' ? `/${language}/` : `/${language}${source}`;
}
