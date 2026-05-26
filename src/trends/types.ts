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

export interface MergedTrendEntity {
  canonicalId: string;
  title: string;
  canonicalUrl: string;
  sources: string[];
  sourceItems: TrendItem[];
  sourceCount: number;
  crossSourceBonus: number;
}

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
