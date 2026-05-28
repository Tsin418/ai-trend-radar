export type RadarRunMode = 'daily' | 'weekly';
export type TrendType = 'sustained_hot' | 'sudden_breakout' | 'early_signal';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Unknown';
export type WatchlistSource = 'manual' | 'auto';
export type WatchlistStatus = 'manual_active' | 'auto_active' | 'cooling' | 'archived';
export type SourceType =
  | 'opensource'
  | 'product_launch'
  | 'model_hub'
  | 'paper'
  | 'developer_discussion'
  | 'media'
  | 'curated_trend';

export interface RadarRepository {
  repoFullName: string;
  repoUrl: string;
  owner: string;
  name: string;
  description: string;
  language: string | null;
  topics: string[];
  category: string;
  createdAt: string | null;
  pushedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  source: string;
  stars: number;
  forks: number;
  openIssues: number;
  isArchived: boolean;
  isFork: boolean;
  isWatchlist: boolean;
  watchlistSource?: WatchlistSource;
  watchlistStatus?: WatchlistStatus;
  watchlistPromotedAt?: string;
  watchlistLastMovementAt?: string;
  watchlistPromotedReason?: string;
  newlyPromotedToWatchlist?: boolean;
}

export interface RepoScore {
  repoFullName: string;
  dailyStarDelta: number | null;
  weeklyStarDelta: number | null;
  dailyGrowthRate: number | null;
  weeklyGrowthRate: number | null;
  yesterdayStarDelta: number | null;
  threeDayAverageDelta: number | null;
  sevenDayAverageDelta: number | null;
  acceleration: number;
  accelerationConfidence: 'high' | 'medium' | 'low';
  trendType: TrendType;
  attentionScore: number;
  accelerationScore: number;
  earlyPotentialScore: number;
  developerActivityScore: number;
  aiRelevanceScore: number;
  usefulnessScore: number;
  riskScore: number;
  finalScore: number;
  riskLevel: RiskLevel;
  scoreDate: string;
  signals: string[];
}

export interface RepoLLMSummary {
  oneLiner: string;
  problemSolved: string;
  aiCategory: string;
  trendType: TrendType;
  whyNow: string;
  whatChanged: string;
  whyTrending: string;
  developerTakeaway: string;
  developerInsight: string;
  targetUsers: string;
  riskNotes: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScoredRadarRepository {
  repository: RadarRepository;
  score: RepoScore;
  whyItMatters: string;
  developerInsight: string;
  llmSummary?: RepoLLMSummary;
}

export interface RadarCategoryStat {
  category: string;
  repoCount: number;
  selectedRepoCount?: number;
  averageFinalScore?: number;
  averageDailyStarDelta?: number | null;
  averageWeeklyStarDelta: number | null;
  topRepoFullName: string | null;
  newRepoCount: number;
  heatScore?: number;
}

export interface SourceHealth {
  source: string;
  enabled: boolean;
  success: boolean;
  itemCount: number;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  error?: string;
  warning?: string;
}

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
}

export interface MultiSourceDigestSections {
  productLaunches: TrendItem[];
  modelDemoSignals: TrendItem[];
  developerBuzz: TrendItem[];
  aihotHighlights: TrendItem[];
  crossSourceHighlights: TrendEntity[];
}

export interface WeeklyNarrative {
  weeklyOverview: string;
  hottestDirection: string;
  notableProjects: string[];
  earlySignals: string;
  developerBuzz: string;
  developerTakeaway: string;
}

export interface RadarDigest {
  mode: RadarRunMode;
  title: string;
  date: string;
  generatedAt: string;
  headline?: string;
  summary: string;
  baselineCreated: boolean;
  scannedRepoCount?: number;
  aiCandidateCount?: number;
  dataNotes: string[];
  hotProjects: ScoredRadarRepository[];
  acceleratingProjects: ScoredRadarRepository[];
  earlySignals: ScoredRadarRepository[];
  watchlistMovements: ScoredRadarRepository[];
  selectedProjects: ScoredRadarRepository[];
  categoryStats?: RadarCategoryStat[];
  researchPicks?: ScoredRadarRepository[];
  multiSourceSections?: MultiSourceDigestSections;
  sourceHealth?: SourceHealth[];
  trendEntities?: TrendEntity[];
  topicClusters?: TrendEntity[];
  weeklyNarrative?: WeeklyNarrative;
  recurringProjects?: string[];
}
