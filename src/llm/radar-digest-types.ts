export type LlmDigestStatus = 'success' | 'skipped' | 'failed' | 'fallback';
export type LlmDigestLanguage = 'zh-CN' | 'en-US';
export type PulsePerspective = 'developer' | 'product' | 'information' | 'cross_source';
export type SuggestedAction = '值得试用' | '值得了解' | '持续观察' | '暂时忽略';
export type LlmConfidence = 'high' | 'medium' | 'low';
export type TrendJudgment = '升温中' | '值得观察' | '可能是噪音';
export type LlmAudience = 'developer' | 'product' | 'general';
export type LlmRelatedItemType = 'repo' | 'product' | 'model' | 'paper' | 'news' | 'discussion' | 'unknown';

export interface LlmDigestInputStats {
  hotProjects: number;
  earlySignals: number;
  watchlistMovements: number;
  productLaunches: number;
  aihotHighlights: number;
  modelDemoSignals: number;
  developerBuzz: number;
  crossSourceHighlights: number;
  trendEntities: number;
  topicClusters: number;
}

export interface TodayPulseChange {
  title: string;
  summary: string;
  perspective: PulsePerspective;
  whyItMatters: string;
  suggestedAction: SuggestedAction;
  confidence: LlmConfidence;
  sourceRefs: string[];
}

export interface PerspectiveSummary {
  headline: string;
  summary: string;
  keyItems: string[];
  suggestedAction: SuggestedAction;
  sourceRefs: string[];
}

export interface TodayPulse {
  title: string;
  date: string;
  executiveSummary: string;
  topChanges: TodayPulseChange[];
  developerView: PerspectiveSummary;
  productView: PerspectiveSummary;
  informationView: PerspectiveSummary;
  noiseWarning?: string;
  suggestedReadingOrder?: string[];
}

export interface LlmTrendCluster {
  name: string;
  oneLiner: string;
  whyNow: string;
  audience: LlmAudience[];
  judgment: TrendJudgment;
  confidence: LlmConfidence;
  relatedSources: string[];
  relatedItems: Array<{
    title: string;
    source: string;
    url?: string;
    itemType: LlmRelatedItemType;
  }>;
}

export interface LlmDigest {
  status: LlmDigestStatus;
  generatedAt: string;
  model?: string;
  language: LlmDigestLanguage;
  inputStats: LlmDigestInputStats;
  todayPulse?: TodayPulse;
  trendClusters?: LlmTrendCluster[];
  warnings?: string[];
  errorMessage?: string;
}

export interface CompactDigestItem {
  id: string;
  type: 'repo' | 'product' | 'model' | 'paper' | 'news' | 'discussion' | 'trend_entity';
  source: string;
  title: string;
  url?: string;
  summary?: string;
  description?: string;
  category?: string;
  tags?: string[];
  metrics?: Record<string, number | string | null>;
  whyItMatters?: string;
  developerInsight?: string;
  publishedAt?: string;
  collectedAt?: string;
}

export interface CompactDailyDigestInput {
  date: string;
  sourceHealth: Array<{ source: string; success: boolean; itemCount: number; warning?: string; error?: string }>;
  dataNotes: string[];
  items: CompactDigestItem[];
}

export interface RadarDigestLLMConfig {
  enabled: boolean;
  apiKey?: string;
  baseUrl: string;
  model: string;
  language: LlmDigestLanguage;
  timeoutMs: number;
  maxInputItems: number;
  temperature: number;
  maxOutputTokens: number;
}

export interface LlmDigestModelOutput {
  todayPulse?: TodayPulse;
  trendClusters?: LlmTrendCluster[];
  warnings?: string[];
}
