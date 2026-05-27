import type { RadarDigest, RadarProfile, ScoredRadarRepository } from '../radar/types.js';

function sortByScore(items: ScoredRadarRepository[]): ScoredRadarRepository[] {
  return [...items].sort((a, b) => b.score.finalScore - a.score.finalScore);
}

function unique(items: ScoredRadarRepository[]): ScoredRadarRepository[] {
  const seen = new Set<string>();
  const result: ScoredRadarRepository[] = [];
  for (const item of items) {
    if (seen.has(item.repository.repoFullName)) continue;
    seen.add(item.repository.repoFullName);
    result.push(item);
  }
  return result;
}

export function buildDailyRadarDigest(
  scored: ScoredRadarRepository[],
  profile: RadarProfile,
  date: string,
  limit: number,
  baselineCreated: boolean
): RadarDigest {
  const aiCandidates = scored.filter((item) => item.score.aiRelevanceScore >= profile.thresholds.aiRelevanceMin);
  const hotProjects = sortByScore(aiCandidates.filter((item) => (item.score.dailyStarDelta ?? -1) >= profile.thresholds.dailyStarHot));
  const acceleratingProjects = [...aiCandidates]
    .filter((item) => item.score.accelerationConfidence === 'high' && item.score.acceleration > 2.0)
    .sort((a, b) => {
      if (b.score.acceleration !== a.score.acceleration) return b.score.acceleration - a.score.acceleration;
      return b.score.finalScore - a.score.finalScore;
    });
  const earlySignals = sortByScore(aiCandidates.filter((item) => {
    const daily = item.score.dailyStarDelta ?? -1;
    const weekly = item.score.weeklyStarDelta ?? -1;
    return daily >= profile.thresholds.dailyStarEarly &&
      daily < profile.thresholds.dailyStarHot &&
      weekly >= profile.thresholds.weeklyStarEarly &&
      item.repository.stars >= profile.thresholds.earlyStageMinStars &&
      item.repository.stars <= profile.thresholds.earlyStageMaxStars;
  }));
  const watchlistMovements = sortByScore(aiCandidates.filter((item) => {
    if (!item.repository.isWatchlist) return false;
    return (item.score.dailyStarDelta ?? 0) >= profile.thresholds.dailyStarEarly ||
      (item.score.weeklyStarDelta ?? 0) >= profile.thresholds.weeklyStarEarly ||
      item.score.developerActivityScore >= 70;
  }));

  const selectedProjects = unique([
    ...hotProjects,
    ...acceleratingProjects,
    ...earlySignals,
    ...watchlistMovements,
    ...sortByScore(aiCandidates)
  ]).slice(0, limit);

  const topCategory = selectedProjects[0]?.repository.category ?? 'AI developer tooling';
  const summaryParts = [
    `扫描到 ${scored.length} 个候选项目，AI 相关候选 ${aiCandidates.length} 个。`,
    hotProjects.length > 0
      ? `今日 ${hotProjects.length} 个项目达到 24h stars >= ${profile.thresholds.dailyStarHot}。`
      : `今日新增 stars >= ${profile.thresholds.dailyStarHot} 的 AI 项目不足 ${limit} 个，已补充 Early Signals。`,
    acceleratingProjects.length > 0 ? `发现 ${acceleratingProjects.length} 个突然加速项目。` : '',
    `当前最强信号集中在 ${topCategory}。`
  ].filter(Boolean);

  return {
    mode: 'daily',
    title: `AI Developer Radar｜Daily｜${date}`,
    date,
    generatedAt: new Date().toISOString(),
    summary: summaryParts.join(' '),
    baselineCreated,
    scannedRepoCount: scored.length,
    aiCandidateCount: aiCandidates.length,
    dataNotes: [
      'GitHub API 只提供当前 stars，总量变化来自本项目保存的历史 snapshot。',
      baselineCreated ? '本次为 baseline run，daily/weekly delta 尚不可用。' : 'daily delta 使用约 24h 前 snapshot，weekly delta 使用约 7 天前 snapshot。',
      'Accelerating 只展示至少 3 天历史基线且今日 delta 超过前 3 日均值 2 倍的项目。',
      'Potential Score 为规则评分，用于排序，不代表项目质量结论。'
    ],
    hotProjects: hotProjects.slice(0, limit),
    acceleratingProjects: acceleratingProjects.slice(0, 3),
    earlySignals: earlySignals.slice(0, limit),
    watchlistMovements: watchlistMovements.slice(0, limit),
    selectedProjects
  };
}
