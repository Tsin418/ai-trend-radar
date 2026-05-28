import type { RadarCategoryStat, RadarDigest, RadarProfile, ScoredRadarRepository } from '../radar/types.js';
import type { JsonRadarStore } from '../storage/json-store.js';

function sortByScore(items: ScoredRadarRepository[]): ScoredRadarRepository[] {
  return [...items].sort((a, b) => b.score.finalScore - a.score.finalScore);
}

function buildCategoryStats(items: ScoredRadarRepository[]): RadarCategoryStat[] {
  const groups = new Map<string, ScoredRadarRepository[]>();
  for (const item of items) {
    const group = groups.get(item.repository.category) ?? [];
    group.push(item);
    groups.set(item.repository.category, group);
  }

  return Array.from(groups.entries()).map(([category, repos]) => {
    const weeklyValues = repos.map((item) => item.score.weeklyStarDelta).filter((value): value is number => value !== null);
    const top = [...repos].sort((a, b) => (b.score.weeklyStarDelta ?? -1) - (a.score.weeklyStarDelta ?? -1))[0];
    return {
      category,
      repoCount: repos.length,
      averageWeeklyStarDelta: weeklyValues.length > 0 ? Math.round(weeklyValues.reduce((sum, value) => sum + value, 0) / weeklyValues.length) : null,
      topRepoFullName: top?.repository.repoFullName ?? null,
      newRepoCount: repos.filter((item) => item.score.dailyStarDelta === null).length
    };
  }).sort((a, b) => (b.averageWeeklyStarDelta ?? -1) - (a.averageWeeklyStarDelta ?? -1));
}

function activeWatchlistNames(scored: ScoredRadarRepository[], store?: JsonRadarStore): Set<string> {
  if (store) return store.getActiveWatchlistNames();
  return new Set(scored.filter((item) => item.repository.isWatchlist).map((item) => item.repository.repoFullName));
}

function withWatchlistMetadata(item: ScoredRadarRepository, store: JsonRadarStore | undefined, activeNames: Set<string>): ScoredRadarRepository {
  const repoFullName = item.repository.repoFullName;
  if (!activeNames.has(repoFullName)) return item;
  const state = store?.getWatchlistState(repoFullName);
  return {
    ...item,
    repository: {
      ...item.repository,
      isWatchlist: true,
      watchlistSource: state?.source ?? item.repository.watchlistSource,
      watchlistStatus: state?.status ?? item.repository.watchlistStatus,
      watchlistPromotedAt: state?.promotedAt ?? item.repository.watchlistPromotedAt,
      watchlistLastMovementAt: state?.lastMovementAt ?? item.repository.watchlistLastMovementAt,
      watchlistPromotedReason: state?.promotedReason ?? item.repository.watchlistPromotedReason
    }
  };
}

export function buildWeeklyRadarDigest(
  scored: ScoredRadarRepository[],
  profile: RadarProfile,
  weekLabel: string,
  limit: number,
  insufficientWeeklyData: boolean,
  store?: JsonRadarStore
): RadarDigest {
  const aiCandidates = scored.filter((item) => item.score.aiRelevanceScore >= profile.thresholds.aiRelevanceMin);
  const activeNames = activeWatchlistNames(aiCandidates, store);
  const nonWatchlistCandidates = aiCandidates.filter((item) => !activeNames.has(item.repository.repoFullName));
  const activeWatchlistCandidates = aiCandidates.filter((item) => activeNames.has(item.repository.repoFullName));
  const hotProjects = [...aiCandidates]
    .filter((item) => !activeNames.has(item.repository.repoFullName))
    .filter((item) => (item.score.weeklyStarDelta ?? -1) >= profile.thresholds.weeklyStarEarly)
    .sort((a, b) => (b.score.weeklyStarDelta ?? -1) - (a.score.weeklyStarDelta ?? -1));
  const earlySignals = sortByScore(nonWatchlistCandidates.filter((item) => {
    const weekly = item.score.weeklyStarDelta ?? -1;
    return weekly >= profile.thresholds.weeklyStarEarly &&
      item.repository.stars >= profile.thresholds.earlyStageMinStars &&
      item.repository.stars <= profile.thresholds.earlyStageMaxStars;
  }));
  const watchlistMovements = sortByScore(activeWatchlistCandidates.filter((item) => (item.score.weeklyStarDelta ?? 0) >= profile.thresholds.weeklyStarEarly || item.score.developerActivityScore >= 70));
  const categoryStats = buildCategoryStats(aiCandidates);
  const researchPicks = sortByScore([...hotProjects, ...earlySignals, ...watchlistMovements]).slice(0, 3);
  const decorate = (items: ScoredRadarRepository[]): ScoredRadarRepository[] =>
    items.map((item) => withWatchlistMetadata(item, store, activeNames));

  const topCategory = categoryStats[0]?.category ?? 'AI developer tooling';
  const summary = insufficientWeeklyData
    ? `历史 snapshot 不足 7 天，本周趋势只能作为弱信号。当前候选中 ${topCategory} 最值得继续观察。`
    : `本周 ${topCategory} 的平均增长信号最强，建议优先关注其工具链、协议适配和开发者工作流变化。`;

  return {
    mode: 'weekly',
    title: `AI Developer Radar｜Weekly｜${weekLabel}`,
    date: weekLabel,
    generatedAt: new Date().toISOString(),
    summary,
    baselineCreated: insufficientWeeklyData,
    dataNotes: [
      insufficientWeeklyData ? 'weekly delta 数据不足 7 天，周报结论为临时观察。' : 'weekly delta 来自约 7 天前 snapshot 对比。',
      '分类、风险和 insight 均为 rule-based MVP，可在 V2 接入 LLM 增强。'
    ],
    hotProjects: decorate(hotProjects.slice(0, limit)),
    acceleratingProjects: [],
    earlySignals: decorate(earlySignals.slice(0, limit)),
    watchlistMovements: decorate(watchlistMovements.slice(0, limit)),
    selectedProjects: decorate(sortByScore(nonWatchlistCandidates).slice(0, limit)),
    categoryStats,
    researchPicks: decorate(researchPicks)
  };
}
