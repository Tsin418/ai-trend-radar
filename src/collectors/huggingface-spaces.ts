import type { SourceConfig, TrendItem } from '../trends/types.js';

const HF_SPACES_ENDPOINT = 'https://huggingface.co/api/spaces';

interface HuggingFaceSpace {
  id?: string;
  author?: string;
  likes?: number;
  sdk?: string;
  tags?: string[];
  lastModified?: string;
  createdAt?: string;
  cardData?: {
    title?: string;
    emoji?: string;
  };
}

interface HuggingFaceSpacesCollectorOptions extends SourceConfig {
  timeoutMs?: number;
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  return controller.signal;
}

function spaceUrl(id: string): string {
  return `https://huggingface.co/spaces/${id}`;
}

export class HuggingFaceSpacesCollector {
  readonly name = 'huggingface_spaces';
  private readonly limit: number;
  private readonly timeoutMs: number;

  constructor(options: HuggingFaceSpacesCollectorOptions = {}) {
    this.limit = options.limit ?? 30;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async fetch(limit = this.limit): Promise<TrendItem[]> {
    const url = new URL(HF_SPACES_ENDPOINT);
    url.searchParams.set('sort', 'likes');
    url.searchParams.set('direction', '-1');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('full', 'true');

    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'ai-trend-radar/0.1 (+https://github.com/Tsin418/ai-trend-radar)'
      },
      signal: timeoutSignal(this.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`Hugging Face spaces request failed: HTTP ${response.status}`);
    }

    const spaces = await response.json() as HuggingFaceSpace[];
    const collectedAt = new Date().toISOString();
    return spaces
      .filter((space) => space.id)
      .map((space) => ({
        id: `huggingface_spaces:${space.id}`,
        source: 'huggingface_spaces',
        sourceType: 'model_hub',
        title: space.cardData?.title || space.id as string,
        url: spaceUrl(space.id as string),
        author: space.author,
        tags: space.tags ?? [],
        category: space.sdk,
        metrics: {
          likes: space.likes
        },
        publishedAt: space.createdAt,
        updatedAt: space.lastModified,
        collectedAt,
        raw: {
          sdk: space.sdk,
          emoji: space.cardData?.emoji
        }
      } satisfies TrendItem));
  }
}

export function createHuggingFaceSpacesCollector(options?: HuggingFaceSpacesCollectorOptions): HuggingFaceSpacesCollector {
  return new HuggingFaceSpacesCollector(options);
}
