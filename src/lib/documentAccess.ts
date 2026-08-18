export type DocumentSource = 'local' | 'external' | 'portal' | 'manual';

export interface DocumentAccessMeta {
  href: string;
  opensExternally: boolean;
  accessLabel: string;
  actionLabel: string;
  hostLabel: string | null;
}

function parseUrl(value: string): URL | null {
  try {
    return value.startsWith('http://') || value.startsWith('https://') ? new URL(value) : new URL(value, 'https://www.bdts.be');
  } catch {
    return null;
  }
}

function isPdfLike(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  return parsed.pathname.toLowerCase().endsWith('.pdf');
}

function formatHostLabel(url: string, source: DocumentSource): string | null {
  if (source === 'local' || source === 'manual') return null;
  const parsed = parseUrl(url);
  if (!parsed) return null;
  return parsed.hostname.replace(/^www\./, '');
}

export function getDocumentAccessMeta(
  source: DocumentSource,
  fileUrl: string,
  externalUrl?: string
): DocumentAccessMeta {
  const href = source !== 'local' && externalUrl ? externalUrl : fileUrl;
  const opensExternally = source === 'external' || source === 'portal';

  if (source === 'portal') {
    return {
      href,
      opensExternally,
      accessLabel: 'Portail sécurisé',
      actionLabel: 'Accéder au portail',
      hostLabel: formatHostLabel(href, source)
    };
  }

  if (source === 'manual') {
    return {
      href,
      opensExternally: false,
      accessLabel: 'Page BDTS',
      actionLabel: 'Voir la page',
      hostLabel: null
    };
  }

  if (source === 'local' || isPdfLike(href)) {
    return {
      href,
      opensExternally,
      accessLabel: 'PDF direct',
      actionLabel: source === 'local' ? 'Telecharger' : 'Ouvrir le PDF',
      hostLabel: formatHostLabel(href, source)
    };
  }

  return {
    href,
    opensExternally,
    accessLabel: 'Page partenaire',
    actionLabel: 'Voir le document',
    hostLabel: formatHostLabel(href, source)
  };
}
