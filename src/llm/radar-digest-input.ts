import type { LatestDailyDashboardFile } from '../dashboard/build-dashboard-data.js';
import type { CompactDailyDigestInput, CompactDigestItem, LlmDigestInputStats } from './radar-digest-types.js';

interface BuildCompactInputOptions {
  maxInputItems: number;
}

const SECTION_LIMITS = {
  hotProjects: 8,
  earlySignals: 8,
  watchlistMovements: 6,
  selectedProjects: 8,
  productLaunches: 8,
  aihotHighlights: 12,
  modelDemoSignals: 8,
  developerBuzz: 8,
  crossSourceHighlights: 8,
  trendEntities: 8,
  topicClusters: 8,
} as const;

function toCompactRepo(
  project: LatestDailyDashboardFile['projects'][number],
  section: keyof typeof SECTION_LIMITS
): CompactDigestItem {
  return {
    id: project.repoFullName,
    type: 'repo',
    source: section,
    title: project.repoFullName,
    url: project.repoUrl,
    summary: project.whyItMatters,
    description: project.description,
    category: project.category,
    tags: project.topics,
    metrics: {
      stars: project.stars,
      dailyStarDelta: project.dailyStarDelta,
      weeklyStarDelta: project.weeklyStarDelta,
      acceleration: Number(project.acceleration.toFixed(2)),
      finalScore: project.score.finalScore
    },
    whyItMatters: project.whyItMatters,
    developerInsight: project.developerInsight,
    collectedAt: project.lastSeenAt
  };
}

function trendTypeFromSource(item: LatestDailyDashboardFile['sections']['productLaunches'][number]): CompactDigestItem['type'] {
  if (item.sourceType === 'product_launch') return 'product';
  if (item.sourceType === 'model_hub') return 'model';
  if (item.sourceType === 'paper') return 'paper';
  if (item.sourceType === 'developer_discussion') return 'discussion';
  if (item.sourceType === 'curated_trend' || item.sourceType === 'media') return 'news';
  return 'news';
}

function toCompactTrendItem(item: LatestDailyDashboardFile['sections']['productLaunches'][number]): CompactDigestItem {
  return {
    id: item.id,
    type: trendTypeFromSource(item),
    source: item.source,
    title: item.title,
    url: item.url,
    summary: item.summary ?? item.recommendedReason,
    description: item.description,
    category: item.category,
    tags: item.tags,
    metrics: {
      upvotes: item.metrics?.upvotes ?? null,
      likes: item.metrics?.likes ?? null,
      downloads: item.metrics?.downloads ?? null,
      commentsCount: item.metrics?.commentsCount ?? null,
      rank: item.metrics?.rank ?? null
    },
    whyItMatters: item.recommendedReason,
    publishedAt: item.publishedAt,
    collectedAt: item.collectedAt
  };
}

function toCompactTrendEntity(entity: LatestDailyDashboardFile['trendEntities'][number], source: string): CompactDigestItem {
  return {
    id: entity.id,
    type: 'trend_entity',
    source,
    title: entity.title,
    url: entity.canonicalUrl,
    summary: entity.summary,
    description: entity.whyItMatters,
    category: entity.category,
    tags: entity.normalizedKeys,
    metrics: {
      sourceCount: entity.sourceCount,
      heatScore: entity.metrics.heatScore ?? null,
      starDelta24h: entity.metrics.starDelta24h ?? null,
      starDelta7d: entity.metrics.starDelta7d ?? null,
      crossSourceBonus: entity.crossSourceBonus
    },
    whyItMatters: entity.whyItMatters,
    collectedAt: entity.lastSeenAt
  };
}

function pushLimited<T>(target: T[], source: T[], limit: number): void {
  source.slice(0, limit).forEach((item) => target.push(item));
}

export function buildLlmDigestInputStats(dashboard: LatestDailyDashboardFile): LlmDigestInputStats {
  return {
    hotProjects: dashboard.sections.hotProjects.length,
    earlySignals: dashboard.sections.earlySignals.length,
    watchlistMovements: dashboard.sections.watchlistMovements.length,
    productLaunches: dashboard.sections.productLaunches.length,
    aihotHighlights: dashboard.sections.aihotHighlights.length,
    modelDemoSignals: dashboard.sections.modelDemoSignals.length,
    developerBuzz: dashboard.sections.developerBuzz.length,
    crossSourceHighlights: dashboard.sections.crossSourceHighlights.length,
    trendEntities: dashboard.trendEntities.length,
    topicClusters: dashboard.topicClusters.length
  };
}

export function buildCompactDailyDigestInput(
  dashboard: LatestDailyDashboardFile,
  options: BuildCompactInputOptions
): { input: CompactDailyDigestInput; inputStats: LlmDigestInputStats } {
  const items: CompactDigestItem[] = [];
  const inputStats = buildLlmDigestInputStats(dashboard);

  pushLimited(items, dashboard.sections.hotProjects.map((item) => toCompactRepo(item, 'hotProjects')), SECTION_LIMITS.hotProjects);
  pushLimited(items, dashboard.sections.earlySignals.map((item) => toCompactRepo(item, 'earlySignals')), SECTION_LIMITS.earlySignals);
  pushLimited(items, dashboard.sections.watchlistMovements.map((item) => toCompactRepo(item, 'watchlistMovements')), SECTION_LIMITS.watchlistMovements);
  pushLimited(items, dashboard.projects.map((item) => toCompactRepo(item, 'selectedProjects')), SECTION_LIMITS.selectedProjects);
  pushLimited(items, dashboard.sections.productLaunches.map(toCompactTrendItem), SECTION_LIMITS.productLaunches);
  pushLimited(items, dashboard.sections.aihotHighlights.map(toCompactTrendItem), SECTION_LIMITS.aihotHighlights);
  pushLimited(items, dashboard.sections.modelDemoSignals.map(toCompactTrendItem), SECTION_LIMITS.modelDemoSignals);
  pushLimited(items, dashboard.sections.developerBuzz.map(toCompactTrendItem), SECTION_LIMITS.developerBuzz);
  pushLimited(items, dashboard.sections.crossSourceHighlights.map((item) => toCompactTrendEntity(item, 'crossSourceHighlights')), SECTION_LIMITS.crossSourceHighlights);
  pushLimited(items, dashboard.trendEntities.map((item) => toCompactTrendEntity(item, 'trendEntities')), SECTION_LIMITS.trendEntities);
  pushLimited(items, dashboard.topicClusters.map((item) => toCompactTrendEntity(item, 'topicClusters')), SECTION_LIMITS.topicClusters);

  const deduped: CompactDigestItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = item.id.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= options.maxInputItems) break;
  }

  return {
    input: {
      date: dashboard.targetDate,
      sourceHealth: (dashboard.sourceHealth ?? []).map((item) => ({
        source: item.source,
        success: item.success,
        itemCount: item.itemCount,
        warning: item.warning,
        error: item.error
      })),
      dataNotes: dashboard.dataNotes.slice(0, 20),
      items: deduped
    },
    inputStats
  };
}
