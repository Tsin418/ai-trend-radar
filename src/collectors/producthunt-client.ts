import { defaultShouldRetry, withRetry } from '../utils/retry.js';
import type {
  ProductHuntClientOptions,
  ProductHuntPost,
  ProductHuntPostsQueryVariables
} from './producthunt-types.js';

const PRODUCT_HUNT_GRAPHQL_ENDPOINT = 'https://api.producthunt.com/v2/api/graphql';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

const PRODUCT_HUNT_POSTS_QUERY = `
query ProductHuntPosts(
  $first: Int!
  $postedAfter: DateTime
  $postedBefore: DateTime
  $topic: String
  $order: PostsOrder
) {
  posts(
    first: $first
    postedAfter: $postedAfter
    postedBefore: $postedBefore
    topic: $topic
    order: $order
    featured: true
  ) {
    edges {
      node {
        id
        name
        slug
        tagline
        description
        url
        website
        votesCount
        commentsCount
        reviewsCount
        reviewsRating
        dailyRank
        weeklyRank
        monthlyRank
        createdAt
        featuredAt
        thumbnail {
          url
        }
        makers {
          name
          username
          url
        }
        productLinks {
          type
          url
        }
        topics(first: 10) {
          edges {
            node {
              name
              slug
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
`;

interface ProductHuntGraphQLError {
  message?: string;
}

interface ProductHuntPostsResponse {
  data?: {
    posts?: {
      edges?: Array<{
        node?: ProductHuntPost | null;
      } | null>;
      totalCount?: number;
    } | null;
  } | null;
  errors?: ProductHuntGraphQLError[];
}

export class ProductHuntClient {
  private readonly token?: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ProductHuntClientOptions = {}) {
    this.token = normalizeOptionalString(options.token ?? process.env.PRODUCT_HUNT_TOKEN);
    this.endpoint = normalizeOptionalString(options.endpoint) ?? PRODUCT_HUNT_GRAPHQL_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? MAX_RETRIES;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetchPosts(variables: ProductHuntPostsQueryVariables): Promise<ProductHuntPost[]> {
    if (!this.token) {
      throw new Error('Product Hunt token is missing. Set PRODUCT_HUNT_TOKEN in .env.local or pass token in ProductHuntCollector options.');
    }

    const response = await withRetry(
      () => this.request(variables),
      {
        maxRetries: this.maxRetries,
        initialDelay: 1000,
        shouldRetry: defaultShouldRetry,
        onRetry: (error, attempt, delay) => {
          console.warn(
            `[Product Hunt Collector] retry ${attempt}/${this.maxRetries} after ${delay}ms: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    const posts = response.data?.posts;
    if (!posts) {
      if (response.data) return [];
      throw new Error('Product Hunt API returned no posts data.');
    }

    return posts.edges
      ?.map((edge) => edge?.node)
      .filter((post): post is ProductHuntPost => Boolean(post)) ?? [];
  }

  private async request(variables: ProductHuntPostsQueryVariables): Promise<ProductHuntPostsResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'GitHub-Trending-Radar/0.1 ProductHuntCollector'
        },
        body: JSON.stringify({
          query: PRODUCT_HUNT_POSTS_QUERY,
          variables
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(formatHttpError(response.status));
      }

      const payload = await readJson(response);
      const parsed = payload as ProductHuntPostsResponse;
      if (parsed.errors && parsed.errors.length > 0) {
        const messages = parsed.errors.map((error) => error.message).filter(Boolean).join('; ');
        throw new Error(`Product Hunt GraphQL error: ${messages || 'unknown GraphQL error'}`);
      }

      return parsed;
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Product Hunt API request timed out after ${this.timeoutMs}ms`);
        }
        if (error.message.includes('fetch failed')) {
          throw new Error('Product Hunt API network request failed. Check your network connection.');
        }
      }

      throw error;
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Product Hunt API returned a non-JSON response.');
  }
}

function formatHttpError(status: number): string {
  if (status === 401 || status === 403) {
    return `Product Hunt API request failed: HTTP ${status} (check PRODUCT_HUNT_TOKEN permissions)`;
  }
  if (status === 429) {
    return 'Product Hunt API request failed: HTTP 429 (rate limited; try again later)';
  }
  if (status >= 500) {
    return `Product Hunt API request failed: HTTP ${status} (Product Hunt service unavailable)`;
  }
  return `Product Hunt API request failed: HTTP ${status}`;
}

function normalizeOptionalString(value: string | undefined | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function createProductHuntClient(options?: ProductHuntClientOptions): ProductHuntClient {
  return new ProductHuntClient(options);
}
