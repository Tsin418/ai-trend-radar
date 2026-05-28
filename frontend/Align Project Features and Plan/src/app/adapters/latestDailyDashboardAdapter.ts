import type {
  LatestDailyDashboardFile,
  DashboardCategoryStat,
  DashboardProject,
  DashboardTrendEntity,
  DashboardTrendItem,
} from '../types/dashboard';
import { isDashboardTrendType } from '../types/dashboard';
import type {
  RadarCategoryStat,
  RadarDigest,
  RiskLevel,
  ScoredRadarRepository,
  SourceType,
  TrendEntity,
  TrendItem,
} from '../types/radar';

function toRiskLevel(value: string): RiskLevel {
  if (value === 'Low' || value === 'Medium' || value === 'High' || value === 'Unknown') {
    return value;
  }
  return 'Unknown';
}

function toAccelerationConfidence(value: string): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'low';
}

function toTrendType(value: string): ScoredRadarRepository['score']['trendType'] {
  return isDashboardTrendType(value) ? value : 'sustained_hot';
}

function scoreDate(project: DashboardProject): string {
  return (project.lastSeenAt || project.pushedAt || new Date().toISOString()).slice(0, 10);
}

function toScoredRepository(project: DashboardProject): ScoredRadarRepository {
  return {
    repository: {
      repoFullName: project.repoFullName,
      repoUrl: project.repoUrl,
      owner: project.owner,
      name: project.name,
      description: project.description,
      language: project.language,
      topics: project.topics ?? [],
      category: project.category,
      createdAt: project.createdAt,
      pushedAt: project.pushedAt,
      firstSeenAt: project.firstSeenAt,
      lastSeenAt: project.lastSeenAt,
      source: project.source,
      stars: project.stars,
      forks: project.forks,
      openIssues: project.openIssues,
      isArchived: false,
      isFork: false,
      isWatchlist: project.isWatchlist,
      watchlistSource: project.watchlistSource,
      watchlistStatus: project.watchlistStatus,
      watchlistPromotedAt: project.watchlistPromotedAt,
      watchlistLastMovementAt: project.watchlistLastMovementAt,
      watchlistPromotedReason: project.watchlistPromotedReason,
      newlyPromotedToWatchlist: project.newlyPromotedToWatchlist,
    },
    score: {
      repoFullName: project.repoFullName,
      dailyStarDelta: project.dailyStarDelta,
      weeklyStarDelta: project.weeklyStarDelta,
      dailyGrowthRate: project.dailyGrowthRate,
      weeklyGrowthRate: project.weeklyGrowthRate,
      yesterdayStarDelta: project.yesterdayStarDelta,
      threeDayAverageDelta: project.threeDayAverageDelta,
      sevenDayAverageDelta: project.sevenDayAverageDelta,
      acceleration: project.acceleration,
      accelerationConfidence: toAccelerationConfidence(project.accelerationConfidence),
      trendType: toTrendType(project.trendType),
      attentionScore: project.score.attentionScore,
      accelerationScore: project.score.accelerationScore,
      earlyPotentialScore: project.score.earlyPotentialScore,
      developerActivityScore: project.score.developerActivityScore,
      aiRelevanceScore: project.score.aiRelevanceScore,
      usefulnessScore: project.score.usefulnessScore,
      riskScore: project.score.riskScore,
      finalScore: project.score.finalScore,
      riskLevel: toRiskLevel(project.score.riskLevel),
      scoreDate: scoreDate(project),
      signals: project.score.signals ?? [],
    },
    whyItMatters: project.whyItMatters,
    developerInsight: project.developerInsight,
    llmSummary: project.llmSummary,
  };
}

function toTrendItem(item: DashboardTrendItem): TrendItem {
  return {
    ...item,
    sourceType: item.sourceType as SourceType,
    metrics: item.metrics,
  };
}

function toTrendEntity(entity: DashboardTrendEntity): TrendEntity {
  return {
    ...entity,
    sourceItems: entity.sourceItems.map(toTrendItem),
    metrics: {
      ...entity.metrics,
      crossSourceBonus: entity.metrics.crossSourceBonus ?? entity.crossSourceBonus,
      heatScore: entity.metrics.heatScore ?? 0,
    },
  };
}

function toCategoryStat(stat: DashboardCategoryStat): RadarCategoryStat {
  return {
    category: stat.category,
    repoCount: stat.repoCount,
    averageWeeklyStarDelta: stat.averageWeeklyStarDelta,
    topRepoFullName: stat.topRepoFullName,
    newRepoCount: 0,
    selectedRepoCount: stat.selectedRepoCount,
    averageFinalScore: stat.averageFinalScore,
    averageDailyStarDelta: stat.averageDailyStarDelta,
    heatScore: stat.heatScore,
  };
}

function headlineFrom(file: LatestDailyDashboardFile): string | undefined {
  if (!file.summary.topCategory) return undefined;
  return `Strongest signal today: ${file.summary.topCategory}.`;
}

export function latestDailyDashboardToRadarDigest(file: LatestDailyDashboardFile): RadarDigest {
  return {
    mode: file.mode,
    title: `AI Developer Radar｜Daily｜${file.targetDate}`,
    date: file.targetDate,
    generatedAt: file.generatedAt,
    headline: headlineFrom(file),
    summary: file.summary.text,
    baselineCreated: file.summary.baselineCreated,
    scannedRepoCount: file.summary.scannedRepoCount,
    aiCandidateCount: file.summary.aiCandidateCount,
    dataNotes: file.dataNotes ?? [],
    hotProjects: file.sections.hotProjects.map(toScoredRepository),
    acceleratingProjects: file.sections.acceleratingProjects.map(toScoredRepository),
    earlySignals: file.sections.earlySignals.map(toScoredRepository),
    watchlistMovements: file.sections.watchlistMovements.map(toScoredRepository),
    selectedProjects: file.projects.map(toScoredRepository),
    categoryStats: file.categoryStats.map(toCategoryStat),
    multiSourceSections: {
      productLaunches: file.sections.productLaunches.map(toTrendItem),
      modelDemoSignals: file.sections.modelDemoSignals.map(toTrendItem),
      developerBuzz: file.sections.developerBuzz.map(toTrendItem),
      aihotHighlights: file.sections.aihotHighlights.map(toTrendItem),
      crossSourceHighlights: file.sections.crossSourceHighlights.map(toTrendEntity),
    },
    sourceHealth: file.sourceHealth ?? [],
    trendEntities: file.trendEntities.map(toTrendEntity),
    topicClusters: file.topicClusters.map(toTrendEntity),
    llmDigest: file.llmDigest,
  };
}
