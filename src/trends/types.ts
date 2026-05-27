export type SourceType =
  | 'opensource'
  | 'product_launch'
  | 'model_hub'
  | 'paper'
  | 'developer_discussion'
  | 'media'
  | 'curated_trend';

export interface TrendItem {
  id: string;
  source: string;
  sourceType: SourceType;
  title: string;
  url: string;
  description?: string;
  summary?: string;
  recommendedReason?: string;
  author?: string;
  organization?: string;
  language?: 'en' | 'zh' | 'other';
  region?: 'global' | 'china' | 'us' | 'europe' | 'unknown';
  tags?: string[];
  category?: string;
  originalSource?: string;
  originalUrl?: string;
  metrics?: {
    stars?: number;
    starDelta24h?: number;
    starDelta7d?: number;
    upvotes?: number;
    likes?: number;
    downloads?: number;
    commentsCount?: number;
    repliesCount?: number;
    rank?: number;
  };
  publishedAt?: string;
  updatedAt?: string;
  collectedAt: string;
  raw?: Record<string, unknown>;
}

export type SourceHealthName =
  | 'github-trending'
  | 'github-search'
  | 'watchlist'
  | 'product-hunt'
  | 'aihot'
  | 'huggingface-models'
  | 'huggingface-spaces'
  | 'hackernews';

export interface SourceHealth {
  source: SourceHealthName;
  enabled: boolean;
  success: boolean;
  itemCount: number;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  error?: string;
  warning?: string;
}

export interface TrendLLMSummary {
  whatItIs: string;
  whyNow: string;
  whoShouldCare: string;
  technicalKeywords: string[];
  businessRelevance: string;
  developerRelevance: string;
  watchDecision: 'track' | 'deep_dive' | 'ignore' | 'wait';
  riskNotes: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface TrendEntity {
  id: string;
  canonicalId: string;
  title: string;
  canonicalUrl: string;
  entityType: 'repo' | 'product' | 'model' | 'space' | 'paper' | 'topic' | 'news' | 'unknown';
  normalizedKeys: string[];
  sources: string[];
  sourceCount: number;
  items: TrendItem[];
  sourceItems: TrendItem[];
  metrics: {
    stars?: number;
    starDelta24h?: number;
    starDelta7d?: number;
    votes?: number;
    likes?: number;
    downloads?: number;
    commentsCount?: number;
    hnScore?: number;
    crossSourceBonus: number;
    heatScore: number;
  };
  crossSourceBonus: number;
  category?: string;
  summary?: string;
  whyItMatters?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  llmSummary?: TrendLLMSummary;
}

export type MergedTrendEntity = TrendEntity;

export interface MultiSourceDigestSections {
  productLaunches: TrendItem[];
  modelDemoSignals: TrendItem[];
  developerBuzz: TrendItem[];
  aihotHighlights: TrendItem[];
  crossSourceHighlights: MergedTrendEntity[];
}

export interface MultiSourceCollectionResult {
  items: TrendItem[];
  sections: MultiSourceDigestSections;
  warnings: string[];
  sourceHealth: SourceHealth[];
  trendEntities: TrendEntity[];
  topicClusters: TrendEntity[];
}

export interface SourceConfig {
  enabled?: boolean;
  limit?: number;
  categories?: string[];
  lists?: string[];
  limitPerList?: number;
}

export interface MultiSourceConfig {
  productHunt: SourceConfig;
  aihot: SourceConfig;
  huggingfaceModels: SourceConfig;
  huggingfaceSpaces: SourceConfig;
  hackernews: SourceConfig;
}
