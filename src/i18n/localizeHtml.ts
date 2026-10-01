import { parse, type HTMLElement, type Node } from 'node-html-parser';
import { dictionaries, isPagePath, localizedPath, normalizeKey, type LocalizedLanguage } from './dictionaries';

const TRANSLATED_ATTRIBUTES = ['aria-label', 'content', 'placeholder', 'title', 'alt'];
const OG_LOCALES: Record<LocalizedLanguage, string> = { en: 'en_BE', nl: 'nl_BE' };
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** Marker BaseLayout puts on <html> so only pages built for translation get a localized copy. */
export function isLocalizable(html: string): boolean {
  return /<html[^>]*\sdata-localizable/.test(html.slice(0, 2_000));
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Turns a rendered French page into its English or Dutch version using the
 * checked-in dictionaries, so translated pages are complete HTML that search
 * engines and visitors see without waiting for JavaScript.
 */
export function localizeHtml(html: string, language: LocalizedLanguage, frenchPath: string): string {
  const dictionary = dictionaries[language];
  const root = parse(html, { comment: true, blockTextElements: { script: true, style: true } });
  const translate = (value: string): string | null => {
    const key = normalizeKey(value);
    if (!key) return null;
    const translated = dictionary[key];
    return translated && translated !== key ? translated : null;
  };

  function visit(node: Node) {
    if (node.nodeType === TEXT_NODE) {
      const text = node.text;
      const translated = translate(text);
      if (translated) {
        const leading = text.match(/^\s*/)?.[0] ?? '';
        const trailing = text.match(/\s*$/)?.[0] ?? '';
        (node as Node & { rawText: string }).rawText = escapeText(`${leading}${translated}${trailing}`);
      }
      return;
    }
    if (node.nodeType !== ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const tag = element.rawTagName?.toLowerCase();
    if (tag === 'script' || tag === 'style') return;

    if (tag === 'a' && element.hasAttribute('href')) localizeLink(element);

    const navigationLabel = element.getAttribute(`data-label-${language}`);
    if (navigationLabel) {
      element.set_content(escapeText(navigationLabel));
      return;
    }

    for (const attribute of TRANSLATED_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const translated = translate(value);
      if (translated) element.setAttribute(attribute, escapeText(translated));
    }

    for (const child of element.childNodes) visit(child);
  }

  function localizeLink(anchor: HTMLElement) {
    const code = anchor.getAttribute('data-language-code');
    if (code === 'fr' || code === 'en' || code === 'nl') {
      anchor.setAttribute('href', localizedPath(frenchPath, code));
      if (code === language) anchor.setAttribute('aria-current', 'true');
      else anchor.removeAttribute('aria-current');
      return;
    }
    const href = anchor.getAttribute('href')!;
    if (!href.startsWith('/') || href.startsWith('//')) return;
    const url = new URL(href, 'https://localhost');
    if (!isPagePath(url.pathname)) return;
    url.searchParams.delete('lang');
    anchor.setAttribute('href', escapeText(`${localizedPath(url.pathname, language)}${url.search}${url.hash}`));
  }

  visit(root);

  const htmlElement = root.querySelector('html');
  htmlElement?.setAttribute('lang', language);
  const canonical = root.querySelector('link[rel="canonical"]');
  const canonicalHref = canonical?.getAttribute('href');
  if (canonical && canonicalHref) {
    const url = new URL(canonicalHref);
    url.pathname = localizedPath(url.pathname, language);
    canonical.setAttribute('href', url.href);
    root.querySelector('meta[property="og:url"]')?.setAttribute('content', url.href);
  }
  root.querySelector('meta[property="og:locale"]')?.setAttribute('content', OG_LOCALES[language]);

  return root.toString();
}
