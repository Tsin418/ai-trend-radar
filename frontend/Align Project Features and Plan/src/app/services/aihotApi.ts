import type { TrendItem } from '../types/radar';

const AIHOT_ITEMS_URL = '/api/aihot/items';
const AIHOT_SNAPSHOT_URL = '/data/aihot-selected-items.json';

type AihotApiItem = {
  id?: string;
  source?: string;
  title?: string;
  title_en?: string | null;
  url?: string;
  summary?: string | null;
  category?: string | null;
  tags?: string[];
  language?: 'en' | 'zh' | 'other';
  publishedAt?: string | null;
  recommendedReason?: string;
  reason?: string;
  why?: string;
};

type AihotApiResponse = {
  items?: AihotApiItem[];
};

function normalizeAihotItem(item: AihotApiItem): TrendItem {
  return {
    id: `aihot-${item.id}`,
    source: item.source ?? 'aihot',
    sourceType: 'curated_trend',
    title: item.title ?? item.title_en ?? 'Untitled',
    url: item.url ?? 'https://aihot.virxact.com/',
    summary: item.summary ?? undefined,
    description: item.summary ?? undefined,
    category: item.category ?? undefined,
    tags: item.tags || [],
    language: item.language || 'zh',
    region: 'global',
    originalSource: item.source,
    originalUrl: item.url,
    publishedAt: item.publishedAt ?? undefined,
    collectedAt: new Date().toISOString(),
    recommendedReason: item.recommendedReason || item.reason || item.why,
  };
}

function matchesQuery(item: AihotApiItem, q: string | undefined): boolean {
  const normalizedQuery = q?.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return `${item.title ?? ''} ${item.title_en ?? ''} ${item.summary ?? ''}`
    .toLowerCase()
    .includes(normalizedQuery);
}

async function fetchSnapshotItems(params: {
  category?: string;
  q?: string;
  take?: number;
}): Promise<TrendItem[]> {
  const response = await fetch(AIHOT_SNAPSHOT_URL, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AIHOT snapshot: ${response.status}`);
  }

  const data = await response.json() as AihotApiResponse;
  return (data.items || [])
    .filter((item) => !params.category || item.category === params.category)
    .filter((item) => matchesQuery(item, params.q))
    .slice(0, params.take ?? 50)
    .map(normalizeAihotItem);
}

export async function fetchAihotItems(params: {
  category?: string;
  q?: string;
  take?: number;
}): Promise<TrendItem[]> {
  const search = new URLSearchParams();
  search.set('mode', 'selected');
  if (params.category) search.set('category', params.category);
  if (params.q) search.set('q', params.q);
  search.set('take', String(params.take ?? 50));

  try {
    const response = await fetch(`${AIHOT_ITEMS_URL}?${search.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch AIHOT items: ${response.status}`);
    }

    const data = await response.json() as AihotApiResponse;
    const liveItems = (data.items || []).map(normalizeAihotItem);
    if (liveItems.length > 0) return liveItems;
  } catch {}

  return fetchSnapshotItems(params);
}
