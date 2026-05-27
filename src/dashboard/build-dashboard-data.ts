import type { RadarDigest, ScoredRadarRepository } from '../radar/types.js';
import type { JsonRadarStore } from '../storage/json-store.js';
import type { SourceHealth, TrendEntity, TrendItem } from '../trends/types.js';

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
  score: {
    finalScore: number;
    attentionScore: number;
    earlyPotentialScore: number;
    developerActivityScore: number;
    aiRelevanceScore: number;
    usefulnessScore: number;
    riskScore: number;
    riskLevel: string;
    signals: string[];
  };
  llmSummary?: ScoredRadarRepository['llmSummary'];
  whyItMatters: string;
  developerInsight: string;
  createdAt: string | null;
  pushedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isWatchlist: boolean;
}

export interface CategoryStat {
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
    earlySignals: DashboardProject[];
    watchlistMovements: DashboardProject[];
    productLaunches: TrendItem[];
    modelDemoSignals: TrendItem[];
    developerBuzz: TrendItem[];
    aihotHighlights: TrendItem[];
    crossSourceHighlights: TrendEntity[];
  };
  sourceHealth: SourceHealth[];
  categoryStats: CategoryStat[];
  historyHighlights: {
    topStarDelta24h: DashboardProject[];
    topStarDelta7d: DashboardProject[];
    recurringProjects: DashboardProject[];
    risingCategories: CategoryStat[];
  };
  trendEntities: TrendEntity[];
  topicClusters: TrendEntity[];
  dataNotes: string[];
}

interface BuildDashboardDataOptions {
  digest: RadarDigest;
  scored?: ScoredRadarRepository[];
  store?: JsonRadarStore;
  targetDate: string;
  generatedAt: string;
  timezone: string;
  digestId: string;
  source: LatestDailyDashboardFile['source'];
}

function toDashboardProject(item: ScoredRadarRepository): DashboardProject {
  const repo = item.repository;
  const score = item.score;
  return {
    repoFullName: repo.repoFullName,
    repoUrl: repo.repoUrl,
    owner: repo.owner,
    name: repo.name,
    description: repo.description,
    language: repo.language,
    topics: repo.topics,
    category: repo.category,
    source: repo.source,
    stars: repo.stars,
    forks: repo.forks,
    openIssues: repo.openIssues,
    dailyStarDelta: score.dailyStarDelta,
    weeklyStarDelta: score.weeklyStarDelta,
    dailyGrowthRate: score.dailyGrowthRate,
    weeklyGrowthRate: score.weeklyGrowthRate,
    score: {
      finalScore: score.finalScore,
      attentionScore: score.attentionScore,
      earlyPotentialScore: score.earlyPotentialScore,
      developerActivityScore: score.developerActivityScore,
      aiRelevanceScore: score.aiRelevanceScore,
      usefulnessScore: score.usefulnessScore,
      riskScore: score.riskScore,
      riskLevel: score.riskLevel,
      signals: score.signals
    },
    llmSummary: item.llmSummary,
    whyItMatters: item.whyItMatters,
    developerInsight: item.developerInsight,
    createdAt: repo.createdAt,
    pushedAt: repo.pushedAt,
    firstSeenAt: repo.firstSeenAt,
    lastSeenAt: repo.lastSeenAt,
    isWatchlist: repo.isWatchlist
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildCategoryStats(scored: ScoredRadarRepository[], selected: ScoredRadarRepository[]): CategoryStat[] {
  const selectedNames = new Set(selected.map((item) => item.repository.repoFullName));
  const grouped = new Map<string, ScoredRadarRepository[]>();

  for (const item of scored) {
    const category = item.repository.category || 'unknown';
    const group = grouped.get(category) ?? [];
    group.push(item);
    grouped.set(category, group);
  }

  return [...grouped.entries()]
    .map(([category, items]) => {
      const sorted = [...items].sort((left, right) => right.score.finalScore - left.score.finalScore);
      const avgFinal = average(items.map((item) => item.score.finalScore)) ?? 0;
      const avgDaily = average(items.map((item) => item.score.dailyStarDelta).filter((value): value is number => value !== null));
      const avgWeekly = average(items.map((item) => item.score.weeklyStarDelta).filter((value): value is number => value !== null));
      return {
        category,
        repoCount: items.length,
        selectedRepoCount: items.filter((item) => selectedNames.has(item.repository.repoFullName)).length,
        averageFinalScore: avgFinal,
        averageDailyStarDelta: avgDaily,
        averageWeeklyStarDelta: avgWeekly,
        topRepoFullName: sorted[0]?.repository.repoFullName ?? null,
        heatScore: avgFinal + Math.max(0, avgDaily ?? 0) + Math.max(0, avgWeekly ?? 0) * 0.3
      };
    })
    .sort((left, right) => right.heatScore - left.heatScore);
}

function buildRecurringProjects(scored: ScoredRadarRepository[], store: JsonRadarStore | undefined): DashboardProject[] {
  if (!store) return [];
  const data = store.load();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const counts = new Map<string, Set<string>>();

  for (const snapshot of data.snapshots) {
    const timestamp = Date.parse(snapshot.collectedAt);
    if (!Number.isFinite(timestamp) || timestamp < cutoff) continue;
    const days = counts.get(snapshot.repoFullName) ?? new Set<string>();
    days.add(snapshot.collectedAt.slice(0, 10));
    counts.set(snapshot.repoFullName, days);
  }

  return scored
    .filter((item) => (counts.get(item.repository.repoFullName)?.size ?? 0) >= 2)
    .sort((left, right) => right.score.finalScore - left.score.finalScore)
    .slice(0, 10)
    .map(toDashboardProject);
}

export function buildLatestDailyDashboardData(options: BuildDashboardDataOptions): LatestDailyDashboardFile {
  const scored = options.scored ?? options.digest.selectedProjects;
  const projects = options.digest.selectedProjects.map(toDashboardProject);
  const categoryStats = buildCategoryStats(scored, options.digest.selectedProjects);
  const sections = options.digest.multiSourceSections;
  const topCategory = categoryStats.find((stat) => stat.selectedRepoCount > 0)?.category ?? projects[0]?.category ?? null;

  return {
    schemaVersion: 1,
    mode: 'daily',
    targetDate: options.targetDate,
    generatedAt: options.generatedAt,
    timezone: options.timezone,
    digestId: options.digestId,
    source: options.source,
    summary: {
      text: options.digest.summary,
      scannedRepoCount: options.digest.scannedRepoCount ?? scored.length,
      aiCandidateCount: options.digest.aiCandidateCount ?? scored.filter((item) => item.score.aiRelevanceScore > 0).length,
      selectedProjectCount: options.digest.selectedProjects.length,
      topCategory,
      baselineCreated: options.digest.baselineCreated
    },
    projects,
    sections: {
      hotProjects: options.digest.hotProjects.map(toDashboardProject),
      earlySignals: options.digest.earlySignals.map(toDashboardProject),
      watchlistMovements: options.digest.watchlistMovements.map(toDashboardProject),
      productLaunches: sections?.productLaunches ?? [],
      modelDemoSignals: sections?.modelDemoSignals ?? [],
      developerBuzz: sections?.developerBuzz ?? [],
      aihotHighlights: sections?.aihotHighlights ?? [],
      crossSourceHighlights: sections?.crossSourceHighlights ?? []
    },
    sourceHealth: options.digest.sourceHealth ?? [],
    categoryStats,
    historyHighlights: {
      topStarDelta24h: scored
        .filter((item) => item.score.dailyStarDelta !== null)
        .sort((left, right) => (right.score.dailyStarDelta ?? 0) - (left.score.dailyStarDelta ?? 0))
        .slice(0, 10)
        .map(toDashboardProject),
      topStarDelta7d: scored
        .filter((item) => item.score.weeklyStarDelta !== null)
        .sort((left, right) => (right.score.weeklyStarDelta ?? 0) - (left.score.weeklyStarDelta ?? 0))
        .slice(0, 10)
        .map(toDashboardProject),
      recurringProjects: buildRecurringProjects(scored, options.store),
      risingCategories: categoryStats.slice(0, 10)
    },
    trendEntities: options.digest.trendEntities ?? [],
    topicClusters: options.digest.topicClusters ?? [],
    dataNotes: options.digest.dataNotes
  };
}
