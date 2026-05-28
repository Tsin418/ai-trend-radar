import type { LatestDailyDashboardFile } from './build-dashboard-data.js';
import type { RadarDigest, ScoredRadarRepository, TrendType } from '../radar/types.js';

function toTrendType(value: string): TrendType {
  if (value === 'sudden_breakout' || value === 'early_signal' || value === 'sustained_hot') {
    return value;
  }
  return 'sustained_hot';
}

function toScoredRepository(project: LatestDailyDashboardFile['projects'][number]): ScoredRadarRepository {
  return {
    repository: {
      repoFullName: project.repoFullName,
      repoUrl: project.repoUrl,
      owner: project.owner,
      name: project.name,
      description: project.description,
      language: project.language,
      topics: project.topics,
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
      newlyPromotedToWatchlist: project.newlyPromotedToWatchlist
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
      accelerationConfidence: project.accelerationConfidence === 'high' || project.accelerationConfidence === 'medium' || project.accelerationConfidence === 'low'
        ? project.accelerationConfidence
        : 'low',
      trendType: toTrendType(project.trendType),
      attentionScore: project.score.attentionScore,
      accelerationScore: project.score.accelerationScore,
      earlyPotentialScore: project.score.earlyPotentialScore,
      developerActivityScore: project.score.developerActivityScore,
      aiRelevanceScore: project.score.aiRelevanceScore,
      usefulnessScore: project.score.usefulnessScore,
      riskScore: project.score.riskScore,
      finalScore: project.score.finalScore,
      riskLevel: project.score.riskLevel === 'Low' || project.score.riskLevel === 'Medium' || project.score.riskLevel === 'High' || project.score.riskLevel === 'Unknown'
        ? project.score.riskLevel
        : 'Unknown',
      scoreDate: project.lastSeenAt.slice(0, 10),
      signals: project.score.signals
    },
    whyItMatters: project.whyItMatters,
    developerInsight: project.developerInsight,
    llmSummary: project.llmSummary
  };
}

export function latestDailyDashboardToRadarDigest(file: LatestDailyDashboardFile): RadarDigest {
  const selectedProjects = file.projects.map(toScoredRepository);
  return {
    mode: 'daily',
    title: `AI Developer Radar｜Daily｜${file.targetDate}`,
    date: file.targetDate,
    generatedAt: file.generatedAt,
    summary: file.summary.text,
    baselineCreated: file.summary.baselineCreated,
    scannedRepoCount: file.summary.scannedRepoCount,
    aiCandidateCount: file.summary.aiCandidateCount,
    dataNotes: file.dataNotes,
    hotProjects: file.sections.hotProjects.map(toScoredRepository),
    acceleratingProjects: file.sections.acceleratingProjects.map(toScoredRepository),
    earlySignals: file.sections.earlySignals.map(toScoredRepository),
    watchlistMovements: file.sections.watchlistMovements.map(toScoredRepository),
    selectedProjects,
    multiSourceSections: {
      productLaunches: file.sections.productLaunches,
      modelDemoSignals: file.sections.modelDemoSignals,
      developerBuzz: file.sections.developerBuzz,
      aihotHighlights: file.sections.aihotHighlights,
      crossSourceHighlights: file.sections.crossSourceHighlights
    },
    sourceHealth: file.sourceHealth,
    trendEntities: file.trendEntities,
    topicClusters: file.topicClusters
  };
}
