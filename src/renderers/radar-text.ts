import type { RadarDigest, ScoredRadarRepository } from '../radar/types.js';

function deltaText(value: number | null, suffix: string): string {
  return value === null ? `${suffix} 暂无基线` : `${suffix} +${value}`;
}

function renderProject(item: ScoredRadarRepository, index?: number): string[] {
  const repo = item.repository;
  const score = item.score;
  const prefix = index === undefined ? '-' : `${index}.`;

  return [
    `${prefix} ${repo.repoFullName}`,
    `   Category: ${repo.category}`,
    `   Stars: ${repo.stars.toLocaleString()} (${deltaText(score.dailyStarDelta, '24h')}, ${deltaText(score.weeklyStarDelta, '7d')})`,
    `   Score: ${score.finalScore} | Risk: ${score.riskLevel}`,
    `   What: ${repo.description || '暂无项目描述'}`,
    `   Why it matters: ${item.whyItMatters}`,
    `   Developer insight: ${item.developerInsight}`,
    `   GitHub: ${repo.repoUrl}`
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
    digest.earlySignals.forEach((item) => {
      lines.push(`- ${item.repository.repoFullName}: total stars ${item.repository.stars.toLocaleString()}, 7d ${item.score.weeklyStarDelta === null ? '暂无基线' : `+${item.score.weeklyStarDelta}`}，${item.whyItMatters}`);
    });
    lines.push('');
  }

  if (digest.watchlistMovements.length > 0) {
    lines.push('Watchlist Movements');
    digest.watchlistMovements.forEach((item) => {
      lines.push(`- ${item.repository.repoFullName}: ${item.whyItMatters}`);
    });
    lines.push('');
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
