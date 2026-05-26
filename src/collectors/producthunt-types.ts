export type ProductHuntPostsOrder = 'FEATURED_AT' | 'NEWEST' | 'RANKING' | 'VOTES';

export interface ProductHuntTopicNode {
  name?: string;
  slug?: string;
}

export interface ProductHuntPost {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description?: string | null;
  url: string;
  website?: string | null;
  votesCount: number;
  commentsCount: number;
  reviewsCount?: number | null;
  reviewsRating?: number | null;
  dailyRank?: number | null;
  weeklyRank?: number | null;
  monthlyRank?: number | null;
  createdAt: string;
  featuredAt?: string | null;
  topics?: {
    edges?: Array<{
      node?: ProductHuntTopicNode | null;
    } | null>;
  } | null;
  makers?: Array<{
    name?: string;
    username?: string;
    url?: string;
  } | null> | null;
  thumbnail?: {
    url?: string;
  } | null;
  productLinks?: Array<{
    type?: string;
    url?: string;
  } | null> | null;
}

export interface ProductHuntPostsQueryVariables {
  first: number;
  postedAfter?: string | null;
  postedBefore?: string | null;
  topic?: string | null;
  order?: ProductHuntPostsOrder | null;
}

export interface ProductHuntCollectorOptions {
  token?: string;
  limit?: number;
  daysBack?: number;
  topics?: string[];
  keywords?: string[];
  minVotes?: number;
  minComments?: number;
  order?: ProductHuntPostsOrder;
}

export interface ProductHuntClientOptions {
  token?: string;
  endpoint?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}
