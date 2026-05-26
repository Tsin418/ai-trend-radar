import type { SourceConfig, TrendItem } from '../trends/types.js';

const HN_BASE_URL = 'https://hacker-news.firebaseio.com/v0';
const HN_WEB_URL = 'https://news.ycombinator.com/item';
const DEFAULT_KEYWORDS = [
  'ai',
  'llm',
  'large language model',
  'agent',
  'agents',
  'rag',
  'mcp',
  'openai',
  'anthropic',
  'claude',
  'gemini',
  'deepseek',
  'llama',
  'mistral',
  'hugging face',
  'cursor',
  'coding agent',
  'ai coding',
  'local llm',
  'inference',
  'vector database',
  'embedding',
  'multimodal',
  'robotics'
];

interface HackerNewsStory {
  id: number;
  type?: string;
  by?: string;
  time?: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
}

interface HackerNewsCollectorOptions extends SourceConfig {
  keywords?: string[];
  timeoutMs?: number;
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  return controller.signal;
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'ai-trend-radar/0.1 (+https://github.com/Tsin418/ai-trend-radar)'
    },
    signal: timeoutSignal(timeoutMs)
  });
  if (!response.ok) throw new Error(`Hacker News request failed: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function matchedKeywords(story: HackerNewsStory, keywords: string[]): string[] {
  const haystack = `${story.title ?? ''} ${story.url ?? ''}`.toLowerCase();
  return keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
}

function publishedAt(story: HackerNewsStory): string | undefined {
  return story.time ? new Date(story.time * 1000).toISOString() : undefined;
}

export class HackerNewsCollector {
  readonly name = 'hackernews';
  private readonly lists: string[];
  private readonly limitPerList: number;
  private readonly keywords: string[];
  private readonly timeoutMs: number;

  constructor(options: HackerNewsCollectorOptions = {}) {
    this.lists = options.lists ?? ['topstories', 'newstories', 'beststories'];
    this.limitPerList = options.limitPerList ?? 30;
    this.keywords = options.keywords ?? DEFAULT_KEYWORDS;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async fetch(): Promise<TrendItem[]> {
    const idsByList = await Promise.all(this.lists.map(async (list) => {
      const ids = await fetchJson<number[]>(`${HN_BASE_URL}/${list}.json`, this.timeoutMs);
      return ids.slice(0, this.limitPerList);
    }));

    const uniqueIds = Array.from(new Set(idsByList.flat()));
    const stories = await Promise.allSettled(
      uniqueIds.map((id) => fetchJson<HackerNewsStory>(`${HN_BASE_URL}/item/${id}.json`, this.timeoutMs))
    );
    const collectedAt = new Date().toISOString();

    return stories
      .flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
      .filter((story) => story.type === 'story' && story.title)
      .map((story) => ({ story, matches: matchedKeywords(story, this.keywords) }))
      .filter(({ matches }) => matches.length > 0)
      .map(({ story, matches }) => ({
        id: `hackernews:${story.id}`,
        source: 'hackernews',
        sourceType: 'developer_discussion',
        title: story.title as string,
        url: story.url ?? `${HN_WEB_URL}?id=${story.id}`,
        author: story.by,
        tags: matches,
        metrics: {
          upvotes: story.score,
          commentsCount: story.descendants
        },
        publishedAt: publishedAt(story),
        collectedAt,
        raw: {
          hnUrl: `${HN_WEB_URL}?id=${story.id}`,
          matchedKeywords: matches
        }
      } satisfies TrendItem));
  }
}

export function createHackerNewsCollector(options?: HackerNewsCollectorOptions): HackerNewsCollector {
  return new HackerNewsCollector(options);
}
