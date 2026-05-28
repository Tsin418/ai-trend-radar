import { load } from 'cheerio';
import type { SourceConfig, TrendItem } from '../trends/types.js';

const AIHOT_URL = 'https://aihot.virxact.com/';
const AIHOT_ITEMS_URL = 'https://aihot.virxact.com/api/public/items';
const AIHOT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
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

function timeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer)
  };
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
  switch (category) {
    case 'ai-models':
      return 'models';
    case 'ai-products':
      return 'products';
    case 'paper':
      return 'papers';
    case 'tip':
      return 'tools';
    case 'industry':
      return 'industry';
    default:
      return category || 'other';
  }
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
  private readonly categories: string[];
  private readonly fetchImpl: typeof fetch;

  constructor(options: AIHotCollectorOptions = {}) {
    this.endpoint = options.endpoint ?? process.env.AIHOT_ENDPOINT ?? AIHOT_ITEMS_URL;
    this.limit = options.limit ?? 30;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.categories = options.categories ?? [];
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetch(limit = this.limit): Promise<TrendItem[]> {
    const url = new URL(this.endpoint);
    const isApiEndpoint = url.pathname.startsWith('/api/public/items');
    if (isApiEndpoint) {
      url.searchParams.set('mode', url.searchParams.get('mode') ?? 'selected');
      url.searchParams.set('take', String(Math.min(limit, 100)));
    }

    const timeout = timeoutSignal(this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          accept: isApiEndpoint ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'user-agent': AIHOT_USER_AGENT
        },
        signal: timeout.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`AIHot request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      timeout.cleanup();
    }

    if (!response.ok) {
      throw new Error(`AIHot request failed: HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (isApiEndpoint || contentType.includes('application/json')) {
      const data = await response.json() as AIHotApiResponse;
      return extractAIHotItemsFromApiResponse(data, limit, this.categories);
    }

    const html = await response.text();
    return extractAIHotItemsFromHtml(html, url.toString(), limit, this.categories);
  }
}

export function createAIHotCollector(options?: AIHotCollectorOptions): AIHotCollector {
  return new AIHotCollector(options);
}
