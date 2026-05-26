import type { SourceConfig, TrendItem } from '../trends/types.js';

const AIHOT_URL = 'https://aihot.virxact.com/';

interface AIHotCollectorOptions extends SourceConfig {
  endpoint?: string;
  timeoutMs?: number;
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  return controller.signal;
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

function inferCategory(text: string): string | undefined {
  const normalized = text.toLowerCase();
  if (/model|llm|模型|大模型/.test(normalized)) return 'models';
  if (/paper|research|论文|研究/.test(normalized)) return 'papers';
  if (/tool|工具|技巧|prompt/.test(normalized)) return 'tools';
  if (/product|launch|产品|应用/.test(normalized)) return 'products';
  if (/industry|公司|融资|监管|行业/.test(normalized)) return 'industry';
  return undefined;
}

function extractItems(html: string, baseUrl: string, limit: number): TrendItem[] {
  const collectedAt = new Date().toISOString();
  const candidates: TrendItem[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) && candidates.length < limit) {
    const href = match[1];
    const title = compact(match[2].replace(/<[^>]+>/g, ' '));
    if (!href || !title || title.length < 4 || title.length > 180) continue;

    const url = absoluteUrl(href, baseUrl);
    const key = `${title}:${url}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const summary = undefined;
    const category = inferCategory(`${title} ${summary ?? ''}`);

    candidates.push({
      id: `aihot:${Buffer.from(key).toString('base64url').slice(0, 32)}`,
      source: 'aihot',
      sourceType: 'curated_trend',
      title,
      url,
      summary,
      category,
      originalSource: 'AIHot',
      originalUrl: url,
      recommendedReason: summary,
      collectedAt,
      raw: {
        sourceUrl: baseUrl
      }
    });
  }

  return candidates.slice(0, limit);
}

export class AIHotCollector {
  readonly name = 'aihot';
  private readonly endpoint: string;
  private readonly limit: number;
  private readonly timeoutMs: number;

  constructor(options: AIHotCollectorOptions = {}) {
    this.endpoint = options.endpoint ?? process.env.AIHOT_ENDPOINT ?? AIHOT_URL;
    this.limit = options.limit ?? 30;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async fetch(limit = this.limit): Promise<TrendItem[]> {
    const response = await fetch(this.endpoint, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'user-agent': 'ai-trend-radar/0.1 (+https://github.com/Tsin418/ai-trend-radar)'
      },
      signal: timeoutSignal(this.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`AIHot request failed: HTTP ${response.status}`);
    }

    const html = await response.text();
    return extractItems(html, this.endpoint, limit);
  }
}

export function createAIHotCollector(options?: AIHotCollectorOptions): AIHotCollector {
  return new AIHotCollector(options);
}
