import type {
  LlmDigest,
  RepoLLMSummary,
  SourceHealth,
  SourceType,
  TrendType,
  WatchlistSource,
  WatchlistStatus,
} from './radar';

export interface DashboardProject {
  repoFullName: string;
  repoUrl: string;
  owner: string;
  name: string;
  description: string;
  language: string | null;
  topics: string[];
  category: string;
  source: string;
  stars: number;
  forks: number;
  openIssues: number;
  dailyStarDelta: number | null;
  weeklyStarDelta: number | null;
  dailyGrowthRate: number | null;
  weeklyGrowthRate: number | null;
  yesterdayStarDelta: number | null;
  threeDayAverageDelta: number | null;
  sevenDayAverageDelta: number | null;
  acceleration: number;
  accelerationConfidence: string;
  trendType: string;
  score: {
    finalScore: number;
    attentionScore: number;
    accelerationScore: number;
    earlyPotentialScore: number;
    developerActivityScore: number;
    aiRelevanceScore: number;
    usefulnessScore: number;
    riskScore: number;
    riskLevel: string;
    signals: string[];
  };
  llmSummary?: RepoLLMSummary;
  whyItMatters: string;
  developerInsight: string;
  createdAt: string | null;
  pushedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isWatchlist: boolean;
  watchlistSource?: WatchlistSource;
  watchlistStatus?: WatchlistStatus;
  watchlistPromotedAt?: string;
  watchlistLastMovementAt?: string;
  watchlistPromotedReason?: string;
  newlyPromotedToWatchlist?: boolean;
}

export interface DashboardTrendItem {
  id: string;
  source: string;
  sourceType: SourceType | string;
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
  metrics?: Record<string, number | undefined>;
  publishedAt?: string;
  updatedAt?: string;
  collectedAt: string;
}

export interface DashboardTrendEntity {
  id: string;
  canonicalId: string;
  title: string;
  canonicalUrl: string;
  entityType: 'repo' | 'product' | 'model' | 'space' | 'paper' | 'topic' | 'news' | 'unknown';
  normalizedKeys: string[];
  sources: string[];
  sourceCount: number;
  sourceItems: DashboardTrendItem[];
  metrics: Record<string, number | undefined>;
  crossSourceBonus: number;
  category?: string;
  summary?: string;
  whyItMatters?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  llmSummary?: {
    oneLiner?: string;
    businessRelevance?: string;
    developerRelevance?: string;
    confidence?: 'high' | 'medium' | 'low';
  };
}

export interface HomepageSectionItem {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceType: string;
  description?: string;
  summary?: string;
  category?: string;
  tags?: string[];
  metrics?: Record<string, unknown>;
  whyItMatters?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface HomepageSection {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  items: HomepageSectionItem[];
  cta?: {
    label: string;
    url: string;
  };
}

export interface GrowthLinks {
  githubRepoUrl: string;
  githubProfileUrl: string;
  personalHomepageUrl: string;
  linkedinUrl: string;
  xiaohongshuUrl: string;
}

export interface DashboardCategoryStat {
  category: string;
  repoCount: number;
  selectedRepoCount: number;
  averageFinalScore: number;
  averageDailyStarDelta: number | null;
  averageWeeklyStarDelta: number | null;
  topRepoFullName: string | null;
  heatScore: number;
}

export interface LatestDailyDashboardFile {
  schemaVersion: 1;
  mode: 'daily';
  targetDate: string;
  generatedAt: string;
  timezone: string;
  lastUpdatedLabel: string;
  digestId: string;
  source: {
    repo: string;
    branch: string;
    workflow: string;
    runId?: string;
  };
  summary: {
    text: string;
    scannedRepoCount: number;
    aiCandidateCount: number;
    selectedProjectCount: number;
    topCategory: string | null;
    baselineCreated: boolean;
  };
  projects: DashboardProject[];
  sections: {
    hotProjects: DashboardProject[];
    acceleratingProjects: DashboardProject[];
    earlySignals: DashboardProject[];
    watchlistMovements: DashboardProject[];
    productLaunches: DashboardTrendItem[];
    modelDemoSignals: DashboardTrendItem[];
    developerBuzz: DashboardTrendItem[];
    aihotHighlights: DashboardTrendItem[];
    crossSourceHighlights: DashboardTrendEntity[];
  };
  homepageSections: {
    openSourceRadar: HomepageSection;
    aiProductRadar: HomepageSection;
    aiNewsRadar: HomepageSection;
    selfHostPush: HomepageSection;
  };
  growthLinks: GrowthLinks;
  sourceHealth: SourceHealth[];
  categoryStats: DashboardCategoryStat[];
  historyHighlights: {
    topStarDelta24h: DashboardProject[];
    topStarDelta7d: DashboardProject[];
    recurringProjects: DashboardProject[];
    risingCategories: DashboardCategoryStat[];
  };
  trendEntities: DashboardTrendEntity[];
  topicClusters: DashboardTrendEntity[];
  dataNotes: string[];
  llmDigest?: LlmDigest;
}

export function isDashboardTrendType(value: string): value is TrendType {
  return value === 'sustained_hot' || value === 'sudden_breakout' || value === 'early_signal';
}
