import fs from 'node:fs';
import path from 'node:path';
import type { DigestChanges, RadarDigest, RadarProfile, ScoredRadarRepository } from '../radar/types.js';

interface PreviousDigestProject {
  repoFullName: string;
  category?: string;
  acceleration?: number;
}

interface PreviousDigestSnapshot {
  date?: string;
  projects: PreviousDigestProject[];
}

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

function defaultPreviousDigestPaths(): string[] {
  return [
    process.env.RADAR_DAILY_DASHBOARD_PATH || path.join('data', 'latest-daily-dashboard.json'),
    path.join('data', 'latest-daily-digest.json')
  ];
}

function readJsonFile(filePath: string): unknown | null {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function projectFromDashboard(value: unknown): PreviousDigestProject | null {
  const item = asRecord(value);
  if (!item || typeof item.repoFullName !== 'string') return null;
  return {
    repoFullName: item.repoFullName,
    category: typeof item.category === 'string' ? item.category : undefined,
    acceleration: typeof item.acceleration === 'number' ? item.acceleration : undefined
  };
}

function projectFromScored(value: unknown): PreviousDigestProject | null {
  const item = asRecord(value);
  const repository = asRecord(item?.repository);
  const score = asRecord(item?.score);
  if (!repository || typeof repository.repoFullName !== 'string') return null;
  return {
    repoFullName: repository.repoFullName,
    category: typeof repository.category === 'string' ? repository.category : undefined,
    acceleration: typeof score?.acceleration === 'number' ? score.acceleration : undefined
  };
}

function parsePreviousDigest(value: unknown): PreviousDigestSnapshot | null {
  const root = asRecord(value);
  if (!root) return null;
  const dashboardProjects = Array.isArray(root.projects)
    ? root.projects.map(projectFromDashboard).filter((item): item is PreviousDigestProject => Boolean(item))
    : [];
  if (dashboardProjects.length > 0) {
    return {
      date: typeof root.targetDate === 'string' ? root.targetDate : undefined,
      projects: dashboardProjects
    };
  }

  const selectedProjects = Array.isArray(root.selectedProjects)
    ? root.selectedProjects.map(projectFromScored).filter((item): item is PreviousDigestProject => Boolean(item))
    : [];
  if (selectedProjects.length > 0) {
    return {
      date: typeof root.date === 'string' ? root.date : undefined,
      projects: selectedProjects
    };
  }

  return null;
}

function loadPreviousDigest(date: string, paths = defaultPreviousDigestPaths()): PreviousDigestSnapshot | null {
  for (const filePath of paths) {
    const snapshot = parsePreviousDigest(readJsonFile(filePath));
    if (snapshot?.projects.length && (!snapshot.date || snapshot.date < date)) return snapshot;
  }
  return null;
}

export function computeChangesFromPreviousDigest(
  today: ScoredRadarRepository[],
  date: string,
  previousDigestPaths?: string[]
): DigestChanges | null {
  const previous = loadPreviousDigest(date, previousDigestPaths);
  if (!previous) return null;

  const todayTop10 = today.slice(0, 10);
  const previousTop10 = previous.projects.slice(0, 10);
  const todayNames = new Set(todayTop10.map((item) => item.repository.repoFullName));
  const previousNames = new Set(previousTop10.map((item) => item.repoFullName));
  const previousByName = new Map(previousTop10.map((item) => [item.repoFullName, item]));
  const newInTop10 = todayTop10
    .map((item) => item.repository.repoFullName)
    .filter((name) => !previousNames.has(name));
  const droppedFromTop10 = previousTop10
    .map((item) => item.repoFullName)
    .filter((name) => !todayNames.has(name));
  const accelerationSurges = todayTop10.flatMap((item) => {
    const previousAcceleration = previousByName.get(item.repository.repoFullName)?.acceleration;
    if (previousAcceleration === undefined) return [];
    const accelerationChange = Number((item.score.acceleration - previousAcceleration).toFixed(1));
    if (item.score.acceleration < 2 || accelerationChange < 1) return [];
    return [{ repoFullName: item.repository.repoFullName, accelerationChange }];
  });
  const todayTopCategory = todayTop10[0]?.llmSummary?.aiCategory ?? todayTop10[0]?.repository.category;
  const previousTopCategory = previousTop10[0]?.category;
  const categoryShift = todayTopCategory && previousTopCategory && todayTopCategory !== previousTopCategory
    ? `${previousTopCategory} -> ${todayTopCategory}`
    : null;

  if (newInTop10.length === 0 && droppedFromTop10.length === 0 && accelerationSurges.length === 0 && !categoryShift) {
    return null;
  }

  return {
    newInTop10,
    droppedFromTop10,
    accelerationSurges,
    categoryShift
  };
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
    selectedProjects,
    changesFromYesterday: computeChangesFromPreviousDigest(selectedProjects, date)
  };
}
