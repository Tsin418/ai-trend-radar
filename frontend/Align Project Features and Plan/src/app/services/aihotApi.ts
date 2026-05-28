import type { TrendItem } from '../types/radar';

const AIHOT_ITEMS_URL = '/api/aihot/items';
const AIHOT_SNAPSHOT_URL = '/data/aihot-selected-items.json';
const HONG_KONG_UTC_OFFSET_HOURS = 8;
const AIHOT_CATEGORIES = ['ai-models', 'ai-products', 'industry', 'paper', 'tip'] as const;

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

function hongKongDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  };
}

function hongKongTodayWindow(now = new Date()): { startIso: string; endMs: number } {
  const { year, month, day } = hongKongDateParts(now);
  const startMs = Date.UTC(year, month - 1, day) - HONG_KONG_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  return {
    startIso: new Date(startMs).toISOString(),
    endMs: startMs + 24 * 60 * 60 * 1000,
  };
}

function publishedAtMs(item: AihotApiItem | TrendItem): number {
  const timestamp = Date.parse(item.publishedAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isInHongKongToday(item: AihotApiItem, now = new Date()): boolean {
  const timestamp = publishedAtMs(item);
  if (!timestamp) return false;
  const { startIso, endMs } = hongKongTodayWindow(now);
  return timestamp >= Date.parse(startIso) && timestamp < endMs;
}

function hongKongDateKey(iso: string | null | undefined): string {
  const timestamp = Date.parse(iso || '');
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp + HONG_KONG_UTC_OFFSET_HOURS * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function latestHongKongDayItems(items: AihotApiItem[]): AihotApiItem[] {
  const sortedItems = sortByPublishedAtDesc(items);
  const latestDay = hongKongDateKey(sortedItems[0]?.publishedAt);
  if (!latestDay) return [];
  return sortedItems.filter((item) => hongKongDateKey(item.publishedAt) === latestDay);
}

function sortByPublishedAtDesc<T extends AihotApiItem | TrendItem>(items: T[]): T[] {
  return [...items].sort((a, b) => publishedAtMs(b) - publishedAtMs(a));
}

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
  const categoryItems = params.category
    ? (data.items || []).filter((item) => item.category === params.category)
    : data.items || [];
  const todayItems = categoryItems.filter((item) => isInHongKongToday(item));
  const displayItems = todayItems.length > 0 ? todayItems : latestHongKongDayItems(categoryItems);

  return sortByPublishedAtDesc(displayItems)
    .filter((item) => matchesQuery(item, params.q))
    .slice(0, params.take ?? 100)
    .map(normalizeAihotItem);
}

async function fetchLiveAihotApiItems(params: {
  category?: string;
  q?: string;
  since?: string;
  take?: number;
}): Promise<AihotApiItem[]> {
  const search = new URLSearchParams();
  search.set('mode', 'selected');
  if (params.since) search.set('since', params.since);
  if (params.category) search.set('category', params.category);
  if (params.q) search.set('q', params.q);
  search.set('take', String(params.take ?? 100));

  const response = await fetch(`${AIHOT_ITEMS_URL}?${search.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AIHOT items: ${response.status}`);
  }

  const data = await response.json() as AihotApiResponse;
  return data.items || [];
}

async function fetchLiveAihotCategoryItems(params: {
  category: string;
  q?: string;
  take?: number;
}): Promise<AihotApiItem[]> {
  const todayItems = (await fetchLiveAihotApiItems({
    category: params.category,
    q: params.q,
    since: hongKongTodayWindow().startIso,
    take: params.take,
  })).filter((item) => isInHongKongToday(item));
  if (todayItems.length > 0) return todayItems;

  const recentItems = await fetchLiveAihotApiItems({
    category: params.category,
    q: params.q,
    take: params.take,
  });
  return latestHongKongDayItems(recentItems);
}

export async function fetchAihotItems(params: {
  category?: string;
  q?: string;
  take?: number;
}): Promise<TrendItem[]> {
  try {
    const liveItems = params.category
      ? await fetchLiveAihotCategoryItems({
        category: params.category,
        q: params.q,
        take: params.take,
      })
      : (await Promise.all(AIHOT_CATEGORIES.map((category) => fetchLiveAihotCategoryItems({
        category,
        q: params.q,
        take: params.take,
      })))).flat();

    return sortByPublishedAtDesc(liveItems)
      .slice(0, params.take ?? 100)
      .map(normalizeAihotItem);
  } catch {}

  return fetchSnapshotItems(params);
}
