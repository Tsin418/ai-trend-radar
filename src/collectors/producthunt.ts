import type { Collector, TrendingItem } from './types.js';
import { createProductHuntClient, ProductHuntClient } from './producthunt-client.js';
import {
  DEFAULT_PRODUCT_HUNT_KEYWORDS,
  DEFAULT_PRODUCT_HUNT_TOPICS,
  isRelevantProductHuntPost,
  mapProductHuntPostToTrendingItem
} from './producthunt-mapper.js';
import type {
  ProductHuntCollectorOptions,
  ProductHuntPost,
  ProductHuntPostsOrder
} from './producthunt-types.js';

const DEFAULT_LIMIT = 30;
const DEFAULT_DAYS_BACK = 1;
const DEFAULT_MIN_VOTES = 10;
const DEFAULT_MIN_COMMENTS = 0;
const DEFAULT_ORDER: ProductHuntPostsOrder = 'VOTES';

interface ResolvedProductHuntCollectorOptions {
  token?: string;
  limit: number;
  daysBack: number;
  topics: string[];
  keywords: string[];
  minVotes: number;
  minComments: number;
  order: ProductHuntPostsOrder;
}

/**
 * Product Hunt launch signal collector.
 * Keeps Product Hunt posts as product/market momentum, not GitHub repo quality.
 */
export class ProductHuntCollector implements Collector<TrendingItem> {
  readonly name = 'producthunt';
  private readonly options: ResolvedProductHuntCollectorOptions;
  private readonly client: ProductHuntClient;

  constructor(options: ProductHuntCollectorOptions = {}, client?: ProductHuntClient) {
    this.options = resolveOptions(options);
    this.client = client ?? createProductHuntClient({ token: this.options.token });
  }

  async fetch(limit = this.options.limit): Promise<TrendingItem[]> {
    const requestedLimit = positiveNumber(limit, this.options.limit);
    const { postedAfter, postedBefore } = getDateWindow(this.options.daysBack);
    const posts = await this.fetchCandidatePosts(requestedLimit, postedAfter, postedBefore);
    const deduped = dedupePosts(posts);

    return deduped
      .filter((post) => isRelevantProductHuntPost(post, this.options))
      .map((post) => mapProductHuntPostToTrendingItem(post, 0))
      .sort((left, right) => right.heatScore - left.heatScore)
      .slice(0, requestedLimit)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  private async fetchCandidatePosts(limit: number, postedAfter: string, postedBefore: string): Promise<ProductHuntPost[]> {
    if (this.options.topics.length === 0) {
      return this.client.fetchPosts({
        first: limit,
        postedAfter,
        postedBefore,
        topic: null,
        order: this.options.order
      });
    }

    const perTopicLimit = Math.max(limit, this.options.limit);
    const topicResults = await Promise.allSettled(
      this.options.topics.map((topic) => this.client.fetchPosts({
        first: perTopicLimit,
        postedAfter,
        postedBefore,
        topic,
        order: this.options.order
      }))
    );
    const posts = topicResults.flatMap((result) => result.status === 'fulfilled' ? result.value : []);

    if (posts.length > 0) {
      return posts;
    }

    return this.client.fetchPosts({
      first: limit,
      postedAfter,
      postedBefore,
      topic: null,
      order: this.options.order
    });
  }
}

function resolveOptions(options: ProductHuntCollectorOptions): ResolvedProductHuntCollectorOptions {
  return {
    token: optionalString(options.token ?? process.env.PRODUCT_HUNT_TOKEN),
    limit: positiveNumber(options.limit, envNumber('PRODUCT_HUNT_POST_LIMIT', DEFAULT_LIMIT)),
    daysBack: positiveNumber(options.daysBack, envNumber('PRODUCT_HUNT_DAYS_BACK', DEFAULT_DAYS_BACK)),
    topics: nonEmptyArray(options.topics, envCsv('PRODUCT_HUNT_TOPICS'), DEFAULT_PRODUCT_HUNT_TOPICS),
    keywords: nonEmptyArray(options.keywords, envCsv('PRODUCT_HUNT_KEYWORDS'), DEFAULT_PRODUCT_HUNT_KEYWORDS),
    minVotes: nonNegativeNumber(options.minVotes, envNumber('PRODUCT_HUNT_MIN_VOTES', DEFAULT_MIN_VOTES)),
    minComments: nonNegativeNumber(options.minComments, envNumber('PRODUCT_HUNT_MIN_COMMENTS', DEFAULT_MIN_COMMENTS)),
    order: options.order ?? parseOrder(process.env.PRODUCT_HUNT_ORDER) ?? DEFAULT_ORDER
  };
}

function getDateWindow(daysBack: number, now = new Date()): { postedAfter: string; postedBefore: string } {
  const postedBefore = now.toISOString();
  const postedAfter = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  return { postedAfter, postedBefore };
}

function dedupePosts(posts: ProductHuntPost[]): ProductHuntPost[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

function optionalString(value: string | undefined | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function envCsv(name: string): string[] {
  return process.env[name]?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
}

function envNumber(name: string, fallback: number): number {
  return positiveNumber(process.env[name], fallback);
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function nonEmptyArray<T>(first: T[] | undefined, second: T[], fallback: T[]): T[] {
  if (first && first.length > 0) return first;
  if (second.length > 0) return second;
  return fallback;
}

function parseOrder(value: string | undefined): ProductHuntPostsOrder | undefined {
  const normalized = value?.trim().toUpperCase();
  if (normalized === 'FEATURED_AT' || normalized === 'NEWEST' || normalized === 'RANKING' || normalized === 'VOTES') {
    return normalized;
  }
  return undefined;
}

export function createProductHuntCollector(options?: ProductHuntCollectorOptions): ProductHuntCollector {
  return new ProductHuntCollector(options);
}
