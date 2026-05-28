import type { MultiSourceDigestSections, SourceHealth, TrendEntity, TrendItem } from '../trends/types.js';

export type RadarRunMode = 'daily' | 'weekly';

export interface RadarProfile {
  name: string;
  description: string;
  categories: string[];
  keywords: string[];
  searchTopics: string[];
  searchKeywords: string[];
  thresholds: {
    dailyStarHot: number;
    dailyStarEarly: number;
    weeklyStarEarly: number;
    earlyStageMinStars: number;
    earlyStageMaxStars: number;
    aiRelevanceMin: number;
  };
}

export interface WatchlistEntry {
  repoFullName: string;
  categoryKey: string;
}

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

export type WatchlistSource = 'manual' | 'auto';

export type WatchlistStatus = 'manual_active' | 'auto_active' | 'cooling' | 'archived';

export interface WatchlistState {
  repoFullName: string;
  source: WatchlistSource;
  status: WatchlistStatus;
  promotedAt?: string;
  promotedReason?: string;
  hotAppearanceDates: string[];
  lastMovementAt?: string;
  coolingStartedAt?: string;
  archivedAt?: string;
  archivedReason?: string;
  reactivatedAt?: string;
  reactivatedReason?: string;
}

export interface RepoSnapshot {
  repoFullName: string;
  stars: number;
  forks: number;
  openIssues: number;
  pushedAt: string | null;
  collectedAt: string;
}

export interface RepoDeltas {
  dailyStarDelta: number | null;
  weeklyStarDelta: number | null;
  dailyGrowthRate: number | null;
  weeklyGrowthRate: number | null;
  yesterdayStarDelta: number | null;
  threeDayAverageDelta: number | null;
  sevenDayAverageDelta: number | null;
  acceleration: number;
  accelerationConfidence: 'high' | 'medium' | 'low';
  newlySeen: boolean;
  baselineOnly: boolean;
}

export type TrendType = 'sustained_hot' | 'sudden_breakout' | 'early_signal';

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
  riskLevel: 'Low' | 'Medium' | 'High' | 'Unknown';
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

export interface DigestChanges {
  newInTop10: string[];
  droppedFromTop10: string[];
  accelerationSurges: Array<{
    repoFullName: string;
    accelerationChange: number;
  }>;
  categoryShift: string | null;
}

export interface WeeklyNarrative {
  weeklyOverview: string;
  hottestDirection: string;
  notableProjects: string[];
  earlySignals: string;
  developerBuzz: string;
  developerTakeaway: string;
}

export interface WeekOverWeekComparison {
  topCategoriesThisWeek: Array<{ category: string; repoCount: number; avgDelta: number | null }>;
  topCategoriesLastWeek: Array<{ category: string; repoCount: number; avgDelta: number | null }>;
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
  feedbackSummary?: FeedbackSummary;
  categoryStats?: RadarCategoryStat[];
  researchPicks?: ScoredRadarRepository[];
  multiSourceSections?: MultiSourceDigestSections;
  multiSourceItems?: TrendItem[];
  sourceHealth?: SourceHealth[];
  trendEntities?: TrendEntity[];
  topicClusters?: TrendEntity[];
  changesFromYesterday?: DigestChanges | null;
  weeklyNarrative?: WeeklyNarrative;
  weekOverWeekComparison?: WeekOverWeekComparison;
  recurringProjects?: string[];
}

export interface FeedbackEntry {
  repoFullName: string;
  action: 'useful' | 'not_useful' | 'seen';
  source: string;
  scoredAt?: string;
  feedbackAt: string;
  scoreAtTime?: number;
  rankAtTime?: number;
  category?: string;
}

export interface FeedbackStoreData {
  entries: FeedbackEntry[];
}

export interface FeedbackSummary {
  totalEntries: number;
  weekEntries: number;
  usefulThisWeek: number;
  notUsefulThisWeek: number;
  seenThisWeek: number;
  usefulCategories: Array<{ category: string; count: number }>;
  recentUsefulRepos: string[];
}

export interface RadarCategoryStat {
  category: string;
  repoCount: number;
  averageWeeklyStarDelta: number | null;
  topRepoFullName: string | null;
  newRepoCount: number;
}

export interface RadarStoreData {
  repositories: Record<string, RadarRepository>;
  snapshots: RepoSnapshot[];
  scores: RepoScore[];
  hotProjectAppearances: Record<string, string[]>;
  digestRuns: Array<{
    id: string;
    runType: RadarRunMode;
    startedAt: string;
    finishedAt: string;
    status: 'success' | 'failed';
    selectedRepoCount: number;
    errorMessage?: string;
  }>;
  watchlist: Record<string, WatchlistState>;
}
