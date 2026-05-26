import type { MergedTrendEntity, TrendItem } from './types.js';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'ref_src'
]);

export function normalizeTrendUrl(value: string): string {
  try {
    const url = new URL(value);
    url.protocol = 'https:';
    url.hostname = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
    }

    url.hash = '';
    url.pathname = normalizeKnownPath(url.hostname, url.pathname);
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.trim().toLowerCase().replace(/\/$/, '');
  }
}

function normalizeKnownPath(hostname: string, pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (hostname === 'github.com' && parts.length >= 2) {
    return `/${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
  }
  if (hostname === 'huggingface.co' && parts.length >= 2) {
    if (parts[0] === 'spaces' && parts.length >= 3) {
      return `/spaces/${parts[1].toLowerCase()}/${parts[2].toLowerCase()}`;
    }
    return `/${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
  }
  if (hostname === 'producthunt.com' && parts[0] === 'posts' && parts[1]) {
    return `/posts/${parts[1].toLowerCase()}`;
  }
  return `/${parts.join('/')}`.replace(/\/$/, '');
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function entityKey(item: TrendItem): string {
  const canonicalUrl = normalizeTrendUrl(item.originalUrl ?? item.url);
  if (canonicalUrl) return canonicalUrl;
  return normalizeTitle(item.title);
}

export function mergeTrendItems(items: TrendItem[]): MergedTrendEntity[] {
  const grouped = new Map<string, TrendItem[]>();

  for (const item of items) {
    const keys = new Set([entityKey(item), normalizeTrendUrl(item.url), normalizeTitle(item.title)]);
    let existingKey: string | undefined;
    for (const key of keys) {
      if (grouped.has(key)) {
        existingKey = key;
        break;
      }
    }

    const key = existingKey ?? entityKey(item);
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }

  return [...grouped.entries()]
    .map(([key, sourceItems]) => {
      const sources = Array.from(new Set(sourceItems.map((item) => item.source)));
      const preferred = sourceItems.find((item) => item.source === 'github') ?? sourceItems[0];
      return {
        canonicalId: key,
        title: preferred.title,
        canonicalUrl: normalizeTrendUrl(preferred.originalUrl ?? preferred.url),
        sources,
        sourceItems,
        sourceCount: sources.length,
        crossSourceBonus: Math.min(25, Math.max(0, sources.length - 1) * 10)
      };
    })
    .filter((entity) => entity.sourceCount > 1)
    .sort((left, right) => right.sourceCount - left.sourceCount || right.crossSourceBonus - left.crossSourceBonus);
}
