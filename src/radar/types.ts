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
  newlySeen: boolean;
  baselineOnly: boolean;
}

export interface RepoScore {
  repoFullName: string;
  dailyStarDelta: number | null;
  weeklyStarDelta: number | null;
  dailyGrowthRate: number | null;
  weeklyGrowthRate: number | null;
  attentionScore: number;
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

export interface ScoredRadarRepository {
  repository: RadarRepository;
  score: RepoScore;
  whyItMatters: string;
  developerInsight: string;
}

export interface RadarDigest {
  mode: RadarRunMode;
  title: string;
  date: string;
  generatedAt: string;
  summary: string;
  baselineCreated: boolean;
  dataNotes: string[];
  hotProjects: ScoredRadarRepository[];
  earlySignals: ScoredRadarRepository[];
  watchlistMovements: ScoredRadarRepository[];
  selectedProjects: ScoredRadarRepository[];
  categoryStats?: RadarCategoryStat[];
  researchPicks?: ScoredRadarRepository[];
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
  digestRuns: Array<{
    id: string;
    runType: RadarRunMode;
    startedAt: string;
    finishedAt: string;
    status: 'success' | 'failed';
    selectedRepoCount: number;
    errorMessage?: string;
  }>;
}
