import type { MergedTrendEntity, TrendEntity, TrendItem } from './types.js';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'ref_src',
  'source',
  'fbclid',
  'gclid'
]);

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'Coding Agent / SWE Agent': ['coding agent', 'swe agent', 'code agent', 'devin', 'cursor', 'claude code'],
  'MCP / Tool Calling': ['mcp', 'model context protocol', 'tool calling', 'function calling'],
  'RAG / Knowledge Base': ['rag', 'retrieval', 'knowledge base', 'vector database', 'embedding'],
  'Local LLM / Inference': ['local llm', 'inference', 'llama.cpp', 'vllm', 'ollama', 'gguf'],
  'AI Browser / Computer Use': ['browser agent', 'computer use', 'operator', 'web agent'],
  'Voice / Realtime AI': ['voice agent', 'realtime', 'speech', 'audio'],
  'AI Workflow / Automation': ['workflow', 'automation', 'agent workflow', 'zapier'],
  'AI Model Release': ['model release', 'llm', 'multimodal', 'vision language model']
};

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

export function normalizeTrendTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/-\s*github\b/g, ' ')
    .replace(/\|\s*product hunt\b/g, ' ')
    .replace(/\bon hacker news\b/g, ' ')
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractGithubKey(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'github.com') return undefined;
    const [owner, repo] = parsed.pathname.split('/').filter(Boolean);
    return owner && repo ? `github:${owner.toLowerCase()}/${repo.toLowerCase()}` : undefined;
  } catch {
    return undefined;
  }
}

function extractHuggingFaceKey(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'huggingface.co') return undefined;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] === 'spaces' && parts[1] && parts[2]) return `hf-space:${parts[1].toLowerCase()}/${parts[2].toLowerCase()}`;
    if (parts[0] && parts[1]) return `hf-model:${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
    return undefined;
  } catch {
    return undefined;
  }
}

function inferEntityType(item: TrendItem, canonicalUrl: string): TrendEntity['entityType'] {
  if (extractGithubKey(canonicalUrl) || item.sourceType === 'opensource') return 'repo';
  if (canonicalUrl.includes('huggingface.co/spaces/') || item.source === 'huggingface_spaces') return 'space';
  if (canonicalUrl.includes('huggingface.co/') || item.source === 'huggingface_models') return 'model';
  if (item.sourceType === 'product_launch') return 'product';
  if (item.sourceType === 'paper') return 'paper';
  if (item.sourceType === 'developer_discussion') return 'news';
  if (item.sourceType === 'curated_trend' || item.sourceType === 'media') return 'news';
  return 'unknown';
}

function topicKeys(item: TrendItem): string[] {
  const text = normalizeTrendTitle(`${item.title} ${item.summary ?? ''} ${item.description ?? ''} ${(item.tags ?? []).join(' ')}`);
  return Object.entries(TOPIC_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([topic]) => `topic:${topic.toLowerCase()}`);
}

export function trendEntityKeys(item: TrendItem): string[] {
  const canonicalUrl = normalizeTrendUrl(item.originalUrl ?? item.url);
  const title = normalizeTrendTitle(item.title);
  return Array.from(new Set([
    canonicalUrl ? `url:${canonicalUrl}` : '',
    extractGithubKey(canonicalUrl) ?? '',
    extractHuggingFaceKey(canonicalUrl) ?? '',
    item.sourceType === 'product_launch' && title ? `product:${title}` : '',
    title ? `title:${title}` : '',
    ...topicKeys(item)
  ].filter(Boolean)));
}

function primaryEntityKey(item: TrendItem): string {
  return trendEntityKeys(item).find((key) => !key.startsWith('topic:')) ?? `title:${normalizeTrendTitle(item.title)}`;
}

function clamp(value: number, cap: number): number {
  return Math.min(cap, Math.max(0, value));
}

function heatScore(items: TrendItem[], sourceCount: number): number {
  const totals = items.reduce((acc, item) => {
    const metrics = item.metrics ?? {};
    return {
      stars: Math.max(acc.stars, metrics.stars ?? 0),
      starDelta24h: Math.max(acc.starDelta24h, metrics.starDelta24h ?? 0),
      starDelta7d: Math.max(acc.starDelta7d, metrics.starDelta7d ?? 0),
      votes: Math.max(acc.votes, metrics.upvotes ?? 0),
      likes: Math.max(acc.likes, metrics.likes ?? 0),
      downloads: Math.max(acc.downloads, metrics.downloads ?? 0),
      commentsCount: Math.max(acc.commentsCount, metrics.commentsCount ?? 0)
    };
  }, {
    stars: 0,
    starDelta24h: 0,
    starDelta7d: 0,
    votes: 0,
    likes: 0,
    downloads: 0,
    commentsCount: 0
  });

  return Math.round(
    clamp(totals.starDelta24h * 2, 200) +
    clamp(totals.starDelta7d * 0.5, 200) +
    clamp(totals.votes, 150) +
    clamp(totals.commentsCount * 3, 150) +
    clamp(totals.likes * 0.5, 100) +
    clamp(Math.log10(totals.downloads + 1) * 15, 120) +
    Math.min(60, sourceCount * 20)
  );
}

function buildEntity(key: string, sourceItems: TrendItem[], forcedType?: TrendEntity['entityType']): TrendEntity {
  const sources = Array.from(new Set(sourceItems.map((item) => item.source)));
  const preferred = sourceItems.find((item) => item.source === 'github') ?? sourceItems[0];
  const canonicalUrl = normalizeTrendUrl(preferred.originalUrl ?? preferred.url);
  const crossSourceBonus = Math.min(25, Math.max(0, sources.length - 1) * 10);
  const firstSeenAt = sourceItems
    .map((item) => item.publishedAt ?? item.collectedAt)
    .sort()[0] ?? preferred.collectedAt;
  const lastSeenAt = sourceItems
    .map((item) => item.updatedAt ?? item.collectedAt)
    .sort()
    .at(-1) ?? preferred.collectedAt;
  const normalizedKeys = Array.from(new Set(sourceItems.flatMap(trendEntityKeys)));
  const metrics = sourceItems.reduce((acc, item) => {
    const itemMetrics = item.metrics ?? {};
    return {
      stars: Math.max(acc.stars ?? 0, itemMetrics.stars ?? 0) || undefined,
      starDelta24h: Math.max(acc.starDelta24h ?? 0, itemMetrics.starDelta24h ?? 0) || undefined,
      starDelta7d: Math.max(acc.starDelta7d ?? 0, itemMetrics.starDelta7d ?? 0) || undefined,
      votes: Math.max(acc.votes ?? 0, itemMetrics.upvotes ?? 0) || undefined,
      likes: Math.max(acc.likes ?? 0, itemMetrics.likes ?? 0) || undefined,
      downloads: Math.max(acc.downloads ?? 0, itemMetrics.downloads ?? 0) || undefined,
      commentsCount: Math.max(acc.commentsCount ?? 0, itemMetrics.commentsCount ?? 0) || undefined,
      hnScore: Math.max(acc.hnScore ?? 0, item.source === 'hackernews' ? itemMetrics.upvotes ?? 0 : 0) || undefined,
      crossSourceBonus,
      heatScore: 0
    };
  }, {
    crossSourceBonus,
    heatScore: 0
  } as TrendEntity['metrics']);
  metrics.heatScore = heatScore(sourceItems, sources.length);

  return {
    id: key,
    canonicalId: key,
    title: forcedType === 'topic' && key.startsWith('topic:') ? key.slice('topic:'.length).replace(/\b\w/g, (char) => char.toUpperCase()) : preferred.title,
    canonicalUrl,
    entityType: forcedType ?? inferEntityType(preferred, canonicalUrl),
    normalizedKeys,
    sources,
    sourceCount: sources.length,
    items: sourceItems,
    sourceItems,
    metrics,
    crossSourceBonus,
    category: preferred.category,
    summary: preferred.summary ?? preferred.description,
    whyItMatters: sourceItems.length > 1
      ? `同一趋势被 ${sources.length} 个来源、${sourceItems.length} 条信号捕捉。`
      : preferred.recommendedReason,
    firstSeenAt,
    lastSeenAt
  };
}

export function mergeTrendItems(items: TrendItem[]): MergedTrendEntity[] {
  const grouped = new Map<string, TrendItem[]>();
  const keyAliases = new Map<string, string>();

  for (const item of items) {
    const keys = trendEntityKeys(item).filter((key) => !key.startsWith('topic:'));
    let existingKey = keyAliases.get(primaryEntityKey(item));
    for (const key of keys) {
      const alias = keyAliases.get(key);
      if (alias) {
        existingKey = alias;
        break;
      }
    }

    const key = existingKey ?? primaryEntityKey(item);
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
    for (const alias of keys) keyAliases.set(alias, key);
  }

  return [...grouped.entries()]
    .map(([key, sourceItems]) => buildEntity(key, sourceItems) as MergedTrendEntity)
    .filter((entity) => entity.sourceCount > 1)
    .sort((left, right) => right.metrics.heatScore - left.metrics.heatScore || right.sourceCount - left.sourceCount || right.crossSourceBonus - left.crossSourceBonus);
}

export function buildTrendEntities(items: TrendItem[]): TrendEntity[] {
  const crossSource = mergeTrendItems(items);
  const singleSource = items.map((item) => buildEntity(primaryEntityKey(item), [item]));
  const seen = new Set(crossSource.map((entity) => entity.id));
  return [...crossSource, ...singleSource.filter((entity) => {
    if (seen.has(entity.id)) return false;
    seen.add(entity.id);
    return true;
  })].sort((left, right) => right.metrics.heatScore - left.metrics.heatScore);
}

export function buildTopicClusters(items: TrendItem[]): TrendEntity[] {
  const grouped = new Map<string, TrendItem[]>();
  for (const item of items) {
    for (const key of topicKeys(item)) {
      const group = grouped.get(key) ?? [];
      group.push(item);
      grouped.set(key, group);
    }
  }

  return [...grouped.entries()]
    .map(([key, sourceItems]) => buildEntity(key, sourceItems, 'topic'))
    .filter((entity) => entity.items.length > 1)
    .sort((left, right) => right.metrics.heatScore - left.metrics.heatScore);
}
