import { load } from 'cheerio';
import type { SourceConfig, TrendItem } from '../trends/types.js';

const AIHOT_URL = 'https://aihot.virxact.com/';
const AIHOT_ITEMS_URL = 'https://aihot.virxact.com/api/public/items';
const AIHOT_DAILY_URL = 'https://aihot.virxact.com/api/public/daily';
const AIHOT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const AIHOT_API_CATEGORY_MAP: Record<string, string> = {
  models: 'ai-models',
  products: 'ai-products',
  papers: 'paper',
  industry: 'industry',
  tools: 'tip',
  tip: 'tip',
  'ai-models': 'ai-models',
  'ai-products': 'ai-products',
  paper: 'paper'
};
const AIHOT_INTERNAL_CATEGORY_MAP: Record<string, string> = {
  'ai-models': 'models',
  'ai-products': 'products',
  paper: 'papers',
  industry: 'industry',
  tip: 'tools'
};
const NAVIGATION_TITLES = new Set([
  'home',
  'about',
  'login',
  'signup',
  'sign up',
  'subscribe',
  'rss',
  'contact',
  'privacy',
  'terms',
  'github',
  'twitter',
  'x',
  'telegram',
  'discord',
  '更多',
  '首页',
  '登录',
  '注册',
  '关于',
  '联系我们',
  '隐私',
  '条款'
]);
const SOCIAL_HOSTS = new Set(['twitter.com', 'x.com', 't.me', 'discord.gg', 'discord.com']);

interface AIHotCollectorOptions extends SourceConfig {
  endpoint?: string;
  timeoutMs?: number;
  maxRetries?: number;
  daysBack?: number;
  fetchImpl?: typeof fetch;
}

interface AIHotCandidate {
  title: string;
  url: string;
  summary?: string;
  originalSource?: string;
  originalUrl?: string;
  publishedAt?: string;
  category?: string;
  raw?: Record<string, unknown>;
}

interface AIHotApiItem {
  id?: string;
  title?: string;
  title_en?: string | null;
  url?: string;
  source?: string;
  publishedAt?: string | null;
  summary?: string | null;
  category?: string | null;
}

interface AIHotApiResponse {
  items?: AIHotApiItem[];
}

interface AIHotDailyResponse {
  date?: string;
  windowEnd?: string;
  sections?: Array<{
    label?: string;
    items?: Array<{
      title?: string;
      sourceUrl?: string;
      summary?: string;
      sourceName?: string;
    }>;
  }>;
}

function timeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer)
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clampLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), 100);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function toAIHotApiCategory(value: string): string | undefined {
  return AIHOT_API_CATEGORY_MAP[value.trim().toLowerCase()];
}

function toInternalCategory(value: string | null | undefined): string {
  if (!value) return 'other';
  return AIHOT_INTERNAL_CATEGORY_MAP[value] ?? value;
}

function shouldRetryAIHot(errorOrResponse: unknown): boolean {
  if (errorOrResponse instanceof Response) {
    return (
      errorOrResponse.status === 408 ||
      errorOrResponse.status === 429 ||
      errorOrResponse.status >= 500
    );
  }

  const message = errorOrResponse instanceof Error
    ? errorOrResponse.message.toLowerCase()
    : String(errorOrResponse).toLowerCase();
  const name = errorOrResponse instanceof Error ? errorOrResponse.name : '';
  return (
    name === 'AbortError' ||
    message.includes('aborted') ||
    message.includes('abort') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('fetch failed')
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAIHotWithRetry(
  fetchImpl: typeof fetch,
  url: URL,
  initFactory: () => { init: RequestInit; cleanup: () => void },
  maxRetries: number
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const { init, cleanup } = initFactory();
    try {
      const response = await fetchImpl(url, init);
      if (response.ok) return response;
      if (!shouldRetryAIHot(response)) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (!shouldRetryAIHot(error)) throw error;
    } finally {
      cleanup();
    }

    if (attempt < maxRetries) {
      await sleep(500 * (attempt + 1));
    }
  }

  throw lastError;
}

function normalizeAIHotError(error: unknown, timeoutMs: number, url?: URL): Error {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  const lower = message.toLowerCase();
  if (name === 'AbortError' || lower.includes('aborted') || lower.includes('abort')) {
    return new Error(
      `AIHot request timed out or was aborted after ${timeoutMs}ms${url ? `: ${url.pathname}` : ''}`
    );
  }

  return new Error(`AIHot request failed${url ? `: ${url.pathname}` : ''} - ${message}`);
}

function mapDailySectionLabel(label: string): string {
  if (label.includes('模型')) return 'models';
  if (label.includes('产品')) return 'products';
  if (label.includes('行业')) return 'industry';
  if (label.includes('论文')) return 'papers';
  if (label.includes('技巧') || label.includes('观点')) return 'tools';
  return 'other';
}

function filterTrendItemsByCategories(items: TrendItem[], limit: number, categories: string[] = []): TrendItem[] {
  const allowedCategories = new Set(
    categories
      .map((category) => toAIHotApiCategory(category) ?? category.trim().toLowerCase())
      .map((category) => toInternalCategory(category).toLowerCase())
  );
  if (allowedCategories.size === 0) return items.slice(0, limit);

  const filtered = items.filter((item) => allowedCategories.has((item.category ?? 'other').toLowerCase()));
  if (filtered.length >= Math.min(3, limit)) return filtered.slice(0, limit);
  const fallback = items.filter((item) => !filtered.includes(item) && item.summary).slice(0, limit - filtered.length);
  return [...filtered, ...fallback].slice(0, limit);
}

function dailyResponseToTrendItems(data: AIHotDailyResponse): TrendItem[] {
  const collectedAt = new Date().toISOString();
  const items: TrendItem[] = [];
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  for (const section of sections) {
    const sectionItems = Array.isArray(section?.items) ? section.items : [];
    const category = mapDailySectionLabel(String(section?.label ?? ''));
    sectionItems.forEach((item, index) => {
      if (!item?.title || !item?.sourceUrl) return;
      items.push({
        id: `aihot:daily:${data?.date ?? 'unknown'}:${category}:${index}`,
        source: 'aihot',
        sourceType: 'curated_trend',
        title: String(item.title),
        url: String(item.sourceUrl),
        summary: item.summary ? String(item.summary) : undefined,
        description: item.summary ? String(item.summary) : undefined,
        category,
        originalSource: item.sourceName ? String(item.sourceName) : undefined,
        originalUrl: String(item.sourceUrl),
        recommendedReason: item.summary ? String(item.summary) : undefined,
        publishedAt: data?.windowEnd ? String(data.windowEnd) : undefined,
        collectedAt,
        raw: {
          source: 'aihot-daily-fallback',
          sectionLabel: section?.label
        }
      } satisfies TrendItem);
    });
  }
  return items;
}

async function fetchAIHotDailyFallback(fetchImpl: typeof fetch, timeoutMs: number): Promise<TrendItem[]> {
  const url = new URL(AIHOT_DAILY_URL);
  const timeout = timeoutSignal(timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: 'application/json',
        'user-agent': AIHOT_USER_AGENT
      },
      signal: timeout.signal
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AIHot daily fallback failed: HTTP ${response.status}${body ? ` - ${body.slice(0, 300)}` : ''}`);
    }

    const data = await response.json() as AIHotDailyResponse;
    return dailyResponseToTrendItems(data);
  } finally {
    timeout.cleanup();
  }
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function absoluteUrl(value: string, baseUrl: string): string {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

export function inferAIHotCategory(text: string): string {
  const normalized = text.toLowerCase();
  if (/agent|智能体|代理/.test(normalized)) return 'agents';
  if (/code|coding|developer|swe|编程|代码|开发者/.test(normalized)) return 'coding';
  if (/infra|infrastructure|inference|deploy|database|vector|框架|基础设施|推理|部署|数据库|向量/.test(normalized)) return 'infrastructure';
  if (/funding|raised|融资|投资/.test(normalized)) return 'funding';
  if (/policy|regulation|监管|政策|法案/.test(normalized)) return 'policy';
  if (/model|llm|模型|大模型/.test(normalized)) return 'models';
  if (/paper|research|论文|研究/.test(normalized)) return 'papers';
  if (/tool|工具|技巧|prompt/.test(normalized)) return 'tools';
  if (/product|launch|产品|应用/.test(normalized)) return 'products';
  if (/industry|公司|融资|监管|行业/.test(normalized)) return 'industry';
  return 'other';
}

export function isNavigationTitle(title: string): boolean {
  const normalized = compact(title).toLowerCase();
  if (!normalized) return true;
  if (NAVIGATION_TITLES.has(normalized)) return true;
  if (/^(更多|查看全部|read more|learn more|menu)$/i.test(normalized)) return true;
  return normalized.length < 4 || normalized.length > 180;
}

export function isLikelyContentUrl(value: string, baseUrl: string): boolean {
  try {
    const url = new URL(value, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (SOCIAL_HOSTS.has(url.hostname.replace(/^www\./, ''))) return false;
    if (url.hash && !url.pathname.replace(/\//g, '')) return false;
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (url.hostname === new URL(baseUrl).hostname && pathParts.length === 0) return false;
    return true;
  } catch {
    return false;
  }
}

function sourceFromUrl(value: string): string | undefined {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, '');
    return hostname && hostname !== new URL(AIHOT_URL).hostname ? hostname : 'AIHot';
  } catch {
    return 'AIHot';
  }
}

function summaryFromText(text: string, title: string): string | undefined {
  const summary = compact(text.replace(title, ' '));
  if (summary.length < 12 || summary === title) return undefined;
  return summary.slice(0, 280);
}

function candidateFromElement($: any, element: any, baseUrl: string): AIHotCandidate | undefined {
  const node = $(element);
  const link = node.is('a[href]') ? node : node.find('a[href]').first();
  const href = link.attr('href');
  const title = compact(link.text() || node.find('h1,h2,h3,h4,[class*=title]').first().text());
  if (!href || isNavigationTitle(title) || !isLikelyContentUrl(href, baseUrl)) return undefined;

  const url = absoluteUrl(href, baseUrl);
  const text = compact(node.text());
  const summary = summaryFromText(text, title);
  const time = node.find('time[datetime]').first().attr('datetime') || node.find('[datetime]').first().attr('datetime');
  const sourceText = compact(node.find('[class*=source],[class*=site],[class*=from]').first().text());
  const category = inferAIHotCategory(`${title} ${summary ?? ''}`);

  return {
    title,
    url,
    summary,
    category,
    originalSource: sourceText || sourceFromUrl(url),
    originalUrl: url,
    publishedAt: time ? absoluteDate(time) : undefined,
    raw: {
      sourceUrl: baseUrl,
      element: element.name
    }
  };
}

function absoluteDate(value: string): string | undefined {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function dedupeCandidates(candidates: AIHotCandidate[]): AIHotCandidate[] {
  const seen = new Set<string>();
  const result: AIHotCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.title.toLowerCase()}:${candidate.url.replace(/\/$/, '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

function filterAIHotCandidates(candidates: AIHotCandidate[], limit: number, categories: string[] = []): AIHotCandidate[] {
  const allowedCategories = new Set(categories.map((category) => category.toLowerCase()));
  const filtered = allowedCategories.size > 0
    ? candidates.filter((candidate) => allowedCategories.has((candidate.category ?? 'other').toLowerCase()))
    : candidates;
  return filtered.length >= Math.min(3, limit)
    ? filtered
    : [...filtered, ...candidates.filter((candidate) => !filtered.includes(candidate) && candidate.summary).slice(0, limit - filtered.length)];
}

function candidatesToTrendItems(candidates: AIHotCandidate[], limit: number, collectedAt: string): TrendItem[] {
  return candidates.slice(0, limit).map((candidate) => {
    const key = `${candidate.title}:${candidate.url}`;
    return {
      id: `aihot:${candidate.raw?.id ?? Buffer.from(key).toString('base64url').slice(0, 32)}`,
      source: 'aihot',
      sourceType: 'curated_trend',
      title: candidate.title,
      url: candidate.url,
      summary: candidate.summary,
      description: candidate.summary,
      category: candidate.category,
      originalSource: candidate.originalSource,
      originalUrl: candidate.originalUrl,
      recommendedReason: candidate.summary,
      publishedAt: candidate.publishedAt,
      collectedAt,
      raw: candidate.raw
    } satisfies TrendItem;
  });
}

export function extractAIHotItemsFromHtml(html: string, baseUrl: string, limit: number, categories: string[] = []): TrendItem[] {
  const collectedAt = new Date().toISOString();
  const $: any = load(html);
  const selectors = [
    'article',
    '[class*=card]',
    '[class*=item]',
    '[class*=post]',
    '[class*=news]',
    '[class*=feed]',
    'li'
  ];
  let candidates: AIHotCandidate[] = [];

  for (const selector of selectors) {
    $(selector).each((_: number, element: any) => {
      const candidate = candidateFromElement($, element, baseUrl);
      if (candidate) candidates.push(candidate);
    });
    candidates = dedupeCandidates(candidates);
    if (candidates.length >= Math.min(limit, 8)) break;
  }

  if (candidates.length < Math.min(limit, 5)) {
    $('a[href]').each((_: number, element: any) => {
      const candidate = candidateFromElement($, element, baseUrl);
      if (candidate) candidates.push(candidate);
    });
    candidates = dedupeCandidates(candidates);
  }

  return candidatesToTrendItems(filterAIHotCandidates(candidates, limit, categories), limit, collectedAt);
}

function normalizeApiCategory(category: string | null | undefined): string {
  return toInternalCategory(category);
}

export function extractAIHotItemsFromApiResponse(response: AIHotApiResponse, limit: number, categories: string[] = []): TrendItem[] {
  const collectedAt = new Date().toISOString();
  const candidates = dedupeCandidates((response.items ?? []).flatMap((item) => {
    if (!item.title || !item.url) return [];
    return [{
      title: compact(item.title),
      url: item.url,
      summary: item.summary ? compact(item.summary) : undefined,
      category: normalizeApiCategory(item.category),
      originalSource: item.source,
      originalUrl: item.url,
      publishedAt: item.publishedAt ? absoluteDate(item.publishedAt) : undefined,
      raw: {
        id: item.id,
        titleEn: item.title_en,
        apiCategory: item.category
      }
    }];
  }));
  return candidatesToTrendItems(filterAIHotCandidates(candidates, limit, categories), limit, collectedAt);
}

export class AIHotCollector {
  readonly name = 'aihot';
  private readonly endpoint: string;
  private readonly limit: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly daysBack: number;
  private readonly categories: string[];
  private readonly fetchImpl: typeof fetch;

  constructor(options: AIHotCollectorOptions = {}) {
    this.endpoint = options.endpoint ?? process.env.AIHOT_ENDPOINT ?? AIHOT_ITEMS_URL;
    this.limit = options.limit ?? 30;
    this.timeoutMs = options.timeoutMs ?? parsePositiveInteger(process.env.AIHOT_TIMEOUT_MS, 20_000);
    this.maxRetries = options.maxRetries ?? parsePositiveInteger(process.env.AIHOT_MAX_RETRIES, 2);
    this.daysBack = options.daysBack ?? parsePositiveInteger(process.env.AIHOT_DAYS_BACK, 3);
    this.categories = options.categories ?? [];
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetch(limit = this.limit): Promise<TrendItem[]> {
    const url = new URL(this.endpoint);
    const isApiEndpoint = url.pathname.startsWith('/api/public/items');
    if (isApiEndpoint) {
      url.searchParams.set('mode', url.searchParams.get('mode') ?? 'selected');
      url.searchParams.set('take', String(clampLimit(limit)));
      if (!url.searchParams.has('since')) {
        url.searchParams.set('since', isoDaysAgo(Math.min(this.daysBack, 7)));
      }
    }

    try {
      const response = await fetchAIHotWithRetry(
        this.fetchImpl,
        url,
        () => {
          const timeout = timeoutSignal(this.timeoutMs);
          return {
            init: {
              headers: {
                accept: isApiEndpoint ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'user-agent': AIHOT_USER_AGENT
              },
              signal: timeout.signal
            },
            cleanup: timeout.cleanup
          };
        },
        this.maxRetries
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `AIHot request failed: HTTP ${response.status}${body ? ` - ${body.slice(0, 300)}` : ''}`
        );
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (isApiEndpoint || contentType.includes('application/json')) {
        const data = await response.json() as AIHotApiResponse;
        return extractAIHotItemsFromApiResponse(data, limit, this.categories);
      }

      const html = await response.text();
      return extractAIHotItemsFromHtml(html, url.toString(), limit, this.categories);
    } catch (error) {
      if (!isApiEndpoint) {
        throw normalizeAIHotError(error, this.timeoutMs, url);
      }
      try {
        const fallbackItems = await fetchAIHotDailyFallback(this.fetchImpl, this.timeoutMs);
        return filterTrendItemsByCategories(fallbackItems, limit, this.categories);
      } catch {
        throw normalizeAIHotError(error, this.timeoutMs, url);
      }
    }
  }
}

export function createAIHotCollector(options?: AIHotCollectorOptions): AIHotCollector {
  return new AIHotCollector(options);
}
