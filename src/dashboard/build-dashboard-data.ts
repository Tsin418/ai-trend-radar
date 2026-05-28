import type { RadarDigest, ScoredRadarRepository, WatchlistSource, WatchlistState, WatchlistStatus } from '../radar/types.js';
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
  llmSummary?: ScoredRadarRepository['llmSummary'];
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
    productLaunches: TrendItem[];
    modelDemoSignals: TrendItem[];
    developerBuzz: TrendItem[];
    aihotHighlights: TrendItem[];
    crossSourceHighlights: TrendEntity[];
  };
  homepageSections: {
    openSourceRadar: HomepageSection;
    aiProductRadar: HomepageSection;
    aiNewsRadar: HomepageSection;
    selfHostPush: HomepageSection;
  };
  growthLinks: GrowthLinks;
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

function toDashboardProject(item: ScoredRadarRepository, watchlistState?: WatchlistState): DashboardProject {
  const repo = item.repository;
  const score = item.score;
  const isWatchlist = Boolean(watchlistState && watchlistState.status !== 'archived') || repo.isWatchlist;
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
    yesterdayStarDelta: score.yesterdayStarDelta,
    threeDayAverageDelta: score.threeDayAverageDelta,
    sevenDayAverageDelta: score.sevenDayAverageDelta,
    acceleration: score.acceleration,
    accelerationConfidence: score.accelerationConfidence,
    trendType: score.trendType,
    score: {
      finalScore: score.finalScore,
      attentionScore: score.attentionScore,
      accelerationScore: score.accelerationScore,
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
    isWatchlist,
    watchlistSource: watchlistState?.source ?? repo.watchlistSource,
    watchlistStatus: watchlistState?.status ?? repo.watchlistStatus,
    watchlistPromotedAt: watchlistState?.promotedAt ?? repo.watchlistPromotedAt,
    watchlistLastMovementAt: watchlistState?.lastMovementAt ?? repo.watchlistLastMovementAt,
    watchlistPromotedReason: watchlistState?.promotedReason ?? repo.watchlistPromotedReason,
    newlyPromotedToWatchlist: repo.newlyPromotedToWatchlist
  };
}

function toHomepageItemFromProject(project: DashboardProject): HomepageSectionItem {
  return {
    id: project.repoFullName,
    title: project.repoFullName,
    url: project.repoUrl,
    source: project.source,
    sourceType: 'opensource',
    description: project.description,
    category: project.category,
    tags: project.topics,
    metrics: {
      stars: project.stars,
      forks: project.forks,
      dailyStarDelta: project.dailyStarDelta,
      weeklyStarDelta: project.weeklyStarDelta,
      finalScore: project.score.finalScore,
      trendType: project.trendType
    },
    whyItMatters: project.whyItMatters,
    updatedAt: project.pushedAt ?? project.lastSeenAt
  };
}

function trendReason(item: TrendItem): string | undefined {
  return item.recommendedReason ?? item.summary ?? item.description;
}

function toHomepageItemFromTrendItem(item: TrendItem): HomepageSectionItem {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    source: item.source,
    sourceType: item.sourceType,
    description: item.description,
    summary: item.summary,
    category: item.category,
    tags: item.tags,
    metrics: item.metrics,
    whyItMatters: trendReason(item),
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt ?? item.collectedAt
  };
}

function toHomepageItemFromTrendEntity(entity: TrendEntity): HomepageSectionItem {
  return {
    id: entity.id,
    title: entity.title,
    url: entity.canonicalUrl,
    source: entity.sources.join(','),
    sourceType: entity.entityType === 'topic' ? 'topic' : entity.entityType,
    description: entity.summary ?? entity.whyItMatters,
    summary: entity.summary,
    category: entity.category,
    tags: entity.normalizedKeys,
    metrics: {
      ...entity.metrics,
      sourceCount: entity.sourceCount,
      crossSourceBonus: entity.crossSourceBonus
    },
    whyItMatters: entity.whyItMatters ?? entity.llmSummary?.businessRelevance ?? entity.llmSummary?.developerRelevance,
    updatedAt: entity.lastSeenAt
  };
}

function dedupeHomepageItems(items: HomepageSectionItem[]): HomepageSectionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = (item.url || item.id).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSelfHostPushItems(repoUrl: string): HomepageSectionItem[] {
  return [
    {
      id: 'feishu',
      title: 'Feishu Webhook Push',
      url: `${repoUrl}#feishu`,
      source: 'docs',
      sourceType: 'self_host',
      description: 'Fork the repo and configure your own Feishu webhook for daily AI radar push.'
    },
    {
      id: 'github-actions',
      title: 'GitHub Actions Scheduled Run',
      url: `${repoUrl}/actions`,
      source: 'docs',
      sourceType: 'self_host',
      description: 'Run the radar daily with GitHub Actions and commit updated JSON snapshots.'
    },
    {
      id: 'json-output',
      title: 'Static JSON Output',
      url: `${repoUrl}/tree/main/data`,
      source: 'docs',
      sourceType: 'self_host',
      description: 'Use latest daily JSON files as your own data source.'
    }
  ];
}

function buildGrowthLinks(): GrowthLinks {
  return {
    githubRepoUrl: process.env.RADAR_GITHUB_REPO_URL || process.env.RADAR_PROJECT_GITHUB_URL || 'https://github.com/Tsin418/ai-trend-radar',
    githubProfileUrl: process.env.RADAR_GITHUB_PROFILE_URL || process.env.RADAR_AUTHOR_GITHUB_URL || 'https://github.com/Tsin418',
    personalHomepageUrl: process.env.RADAR_PERSONAL_HOMEPAGE_URL || '',
    linkedinUrl: process.env.RADAR_LINKEDIN_URL || '',
    xiaohongshuUrl: process.env.RADAR_XIAOHONGSHU_URL || ''
  };
}

function buildHomepageSections(
  sections: LatestDailyDashboardFile['sections'],
  trendEntities: TrendEntity[],
  topicClusters: TrendEntity[],
  growthLinks: GrowthLinks
): LatestDailyDashboardFile['homepageSections'] {
  const openSourceItems = dedupeHomepageItems([
    ...sections.hotProjects,
    ...sections.acceleratingProjects,
    ...sections.earlySignals,
    ...sections.watchlistMovements
  ]
    .sort((left, right) => right.score.finalScore - left.score.finalScore)
    .map(toHomepageItemFromProject))
    .slice(0, 10);

  const productEntityItems = sections.crossSourceHighlights
    .filter((entity) => ['product', 'space', 'model'].includes(entity.entityType))
    .map(toHomepageItemFromTrendEntity);
  const aiProductItems = dedupeHomepageItems([
    ...sections.productLaunches.map(toHomepageItemFromTrendItem),
    ...sections.aihotHighlights.map(toHomepageItemFromTrendItem),
    ...productEntityItems
  ]).slice(0, 8);

  const newsEntityItems = [
    ...sections.crossSourceHighlights,
    ...topicClusters,
    ...trendEntities.filter((entity) => ['topic', 'news', 'unknown'].includes(entity.entityType))
  ].map(toHomepageItemFromTrendEntity);
  const aiNewsItems = dedupeHomepageItems([
    ...sections.developerBuzz.map(toHomepageItemFromTrendItem),
    ...sections.aihotHighlights.map(toHomepageItemFromTrendItem),
    ...newsEntityItems
  ]).slice(0, 8);

  return {
    openSourceRadar: {
      id: 'open-source-radar',
      title: 'Open-source Radar',
      subtitle: 'Emerging AI open-source projects',
      description: 'Hot projects, accelerating repositories, early signals, and watchlist movements ranked by potential score.',
      items: openSourceItems,
      cta: {
        label: 'Star this project',
        url: growthLinks.githubRepoUrl
      }
    },
    aiProductRadar: {
      id: 'ai-product-radar',
      title: 'AI Product Radar',
      subtitle: 'AI launches and product signals',
      description: 'Product Hunt launches, AIHot highlights, Hugging Face demos, and cross-source product entities from existing collectors.',
      items: aiProductItems
    },
    aiNewsRadar: {
      id: 'ai-news-radar',
      title: 'AI News Radar',
      subtitle: 'AI news and developer community discussion',
      description: 'Hacker News developer buzz, AIHot trend items, cross-source highlights, and topic clusters from existing sources.',
      items: aiNewsItems
    },
    selfHostPush: {
      id: 'self-host-push',
      title: 'Self-host Push',
      subtitle: 'Fork and run your own AI radar',
      description: 'Use the open-source workflow and JSON outputs to plug the radar into your own push channel.',
      items: buildSelfHostPushItems(growthLinks.githubRepoUrl),
      cta: {
        label: 'Fork on GitHub',
        url: growthLinks.githubRepoUrl
      }
    }
  };
}

function buildLastUpdatedLabel(generatedAt: string, timezone: string): string {
  const date = new Date(generatedAt);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const value = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  return `Last updated: ${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')} ${timezone}`;
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
    .map((item) => toDashboardProject(item, data.watchlist[item.repository.repoFullName]));
}

export function buildLatestDailyDashboardData(options: BuildDashboardDataOptions): LatestDailyDashboardFile {
  const scored = options.scored ?? options.digest.selectedProjects;
  const watchlistStates = options.store?.load().watchlist ?? {};
  const toProject = (item: ScoredRadarRepository): DashboardProject =>
    toDashboardProject(item, watchlistStates[item.repository.repoFullName]);
  const projects = options.digest.selectedProjects.map(toProject);
  const categoryStats = buildCategoryStats(scored, options.digest.selectedProjects);
  const sections = options.digest.multiSourceSections;
  const topCategory = categoryStats.find((stat) => stat.selectedRepoCount > 0)?.category ?? projects[0]?.category ?? null;
  const legacySections = {
    hotProjects: options.digest.hotProjects.map(toProject),
    acceleratingProjects: (options.digest.acceleratingProjects ?? []).map(toProject),
    earlySignals: options.digest.earlySignals.map(toProject),
    watchlistMovements: options.digest.watchlistMovements.map(toProject),
    productLaunches: sections?.productLaunches ?? [],
    modelDemoSignals: sections?.modelDemoSignals ?? [],
    developerBuzz: sections?.developerBuzz ?? [],
    aihotHighlights: sections?.aihotHighlights ?? [],
    crossSourceHighlights: sections?.crossSourceHighlights ?? []
  };
  const growthLinks = buildGrowthLinks();
  const homepageSections = buildHomepageSections(
    legacySections,
    options.digest.trendEntities ?? [],
    options.digest.topicClusters ?? [],
    growthLinks
  );

  return {
    schemaVersion: 1,
    mode: 'daily',
    targetDate: options.targetDate,
    generatedAt: options.generatedAt,
    timezone: options.timezone,
    lastUpdatedLabel: buildLastUpdatedLabel(options.generatedAt, options.timezone),
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
    sections: legacySections,
    homepageSections,
    growthLinks,
    sourceHealth: options.digest.sourceHealth ?? [],
    categoryStats,
    historyHighlights: {
      topStarDelta24h: scored
        .filter((item) => item.score.dailyStarDelta !== null)
        .sort((left, right) => (right.score.dailyStarDelta ?? 0) - (left.score.dailyStarDelta ?? 0))
        .slice(0, 10)
        .map(toProject),
      topStarDelta7d: scored
        .filter((item) => item.score.weeklyStarDelta !== null)
        .sort((left, right) => (right.score.weeklyStarDelta ?? 0) - (left.score.weeklyStarDelta ?? 0))
        .slice(0, 10)
        .map(toProject),
      recurringProjects: buildRecurringProjects(scored, options.store),
      risingCategories: categoryStats.slice(0, 10)
    },
    trendEntities: options.digest.trendEntities ?? [],
    topicClusters: options.digest.topicClusters ?? [],
    dataNotes: options.digest.dataNotes
  };
}
