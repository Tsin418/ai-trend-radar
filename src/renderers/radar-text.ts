import type { RadarDigest, ScoredRadarRepository } from '../radar/types.js';

function deltaText(value: number | null, suffix: string): string {
  return value === null ? `${suffix} 暂无基线` : `${suffix} +${value}`;
}

function renderProject(item: ScoredRadarRepository, index?: number): string[] {
  const repo = item.repository;
  const score = item.score;
  const summary = item.llmSummary;
  const prefix = index === undefined ? '-' : `${index}.`;

  return [
    `${prefix} ${repo.repoFullName}`,
    `   GitHub: ${repo.repoUrl}`,
    `   Category: ${repo.category}`,
    `   Stars: ${repo.stars.toLocaleString()} (${deltaText(score.dailyStarDelta, '24h')}, ${deltaText(score.weeklyStarDelta, '7d')})`,
    `   Score: ${score.finalScore} | Risk: ${score.riskLevel}`,
    `   One-liner: ${summary?.oneLiner ?? repo.description ?? '暂无项目描述'}`,
    `   Problem solved: ${summary?.problemSolved ?? 'LLM summary unavailable'}`,
    `   Why worth watching: ${summary?.whyTrending ?? item.whyItMatters}`,
    `   Developer takeaway: ${summary?.developerTakeaway ?? item.developerInsight}`,
    `   Target users: ${summary?.targetUsers ?? 'LLM summary unavailable'}`,
    `   Risk notes: ${summary?.riskNotes ?? 'LLM summary unavailable'}`,
    `   LLM confidence: ${summary?.confidence ?? 'unavailable'}`
  ];
}

export function renderRadarDigestText(digest: RadarDigest): string {
  const lines: string[] = [];

  lines.push(digest.title);
  lines.push('');
  lines.push('今日结论：');
  lines.push(digest.summary);
  lines.push('');

  if (digest.baselineCreated) {
    lines.push('Baseline created. Star delta will be available from the next run.');
    lines.push('');
  }

  if (digest.mode === 'weekly' && digest.categoryStats?.length) {
    lines.push('本周最热方向：');
    for (const stat of digest.categoryStats.slice(0, 5)) {
      lines.push(`- ${stat.category}: ${stat.repoCount} repos, avg 7d ${stat.averageWeeklyStarDelta === null ? 'n/a' : `+${stat.averageWeeklyStarDelta}`}, top ${stat.topRepoFullName ?? 'n/a'}`);
    }
    lines.push('');
  }

  if (digest.hotProjects.length > 0) {
    lines.push(digest.mode === 'weekly' ? '本周增长最快项目' : 'Top Hot Projects');
    digest.hotProjects.forEach((item, index) => lines.push(...renderProject(item, index + 1), ''));
  }

  if (digest.earlySignals.length > 0) {
    lines.push(digest.mode === 'weekly' ? '本周早期潜力项目' : 'Early Signals');
    digest.earlySignals.forEach((item, index) => lines.push(...renderProject(item, index + 1), ''));
  }

  if (digest.watchlistMovements.length > 0) {
    lines.push('Watchlist Movements');
    digest.watchlistMovements.forEach((item, index) => lines.push(...renderProject(item, index + 1), ''));
  }

  if (digest.hotProjects.length === 0 && digest.earlySignals.length === 0 && digest.watchlistMovements.length === 0 && digest.selectedProjects.length > 0) {
    lines.push(digest.mode === 'weekly' ? '本周候选项目' : 'Fallback Radar Picks');
    digest.selectedProjects.forEach((item, index) => lines.push(...renderProject(item, index + 1), ''));
  }

  if (digest.mode === 'weekly' && digest.researchPicks?.length) {
    lines.push('本周值得深入研究的 3 个项目');
    digest.researchPicks.forEach((item, index) => lines.push(...renderProject(item, index + 1), ''));
  }

  lines.push('数据说明：');
  digest.dataNotes.forEach((note) => lines.push(`- ${note}`));

  return lines.join('\n').trim();
}
