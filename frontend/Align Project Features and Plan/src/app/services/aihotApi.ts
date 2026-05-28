import type { TrendItem } from '../types/radar';

const AIHOT_ITEMS_URL = '/api/aihot/items';

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

  const response = await fetch(`${AIHOT_ITEMS_URL}?${search.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AIHOT items: ${response.status}`);
  }

  const data = await response.json();
  // Normalize data to TrendItem
  return (data.items || []).map((item: any) => ({
    id: `aihot-${item.id}`,
    source: item.source ?? 'aihot',
    sourceType: 'curated_trend',
    title: item.title ?? item.title_en ?? 'Untitled',
    url: item.url,
    summary: item.summary,
    description: item.summary,
    category: item.category,
    tags: item.tags || [],
    language: item.language || 'en',
    region: 'global',
    originalSource: item.source,
    originalUrl: item.url,
    publishedAt: item.publishedAt,
    collectedAt: new Date().toISOString(),
    recommendedReason: item.recommendedReason || item.reason || item.why,
  }));
}
