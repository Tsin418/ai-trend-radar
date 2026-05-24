import type { RadarDigest, ScoredRadarRepository } from '../radar/types.js';

function deltaText(value: number | null, suffix: string): string {
  return value === null ? `${suffix} 暂无基线` : `${suffix} +${value}`;
}

function renderProject(item: ScoredRadarRepository, index?: number): string[] {
  const repo = item.repository;
  const score = item.score;
  const summary = item.llmSummary;
  const prefix = index === undefined ? '-' : `${index}.`;

  const lines = [
    `${prefix} ${repo.repoFullName}`,
    `   GitHub: ${repo.repoUrl}`,
    `   Category: ${summary?.aiCategory ?? repo.category}`,
    `   Stars: ${repo.stars.toLocaleString()} (${deltaText(score.dailyStarDelta, '24h')}, ${deltaText(score.weeklyStarDelta, '7d')})`,
    `   Score: ${score.finalScore} | Risk: ${score.riskLevel}`,
    `   One-liner: ${summary?.oneLiner ?? repo.description ?? '暂无项目描述'}`,
    `   Why worth watching: ${summary?.whyTrending ?? item.whyItMatters}`,
    `   Developer takeaway: ${summary?.developerTakeaway ?? item.developerInsight}`
  ];

  if (summary) {
    lines.push(
      `   Problem solved: ${summary.problemSolved}`,
      `   Target users: ${summary.targetUsers}`,
      `   Risk notes: ${summary.riskNotes}`,
      `   LLM confidence: ${summary.confidence}`
    );
  }

  return lines;
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

  if (digest.selectedProjects.length > 0) {
    lines.push(digest.mode === 'weekly' ? '本周精选项目' : '今日精选项目');
    digest.selectedProjects.forEach((item, index) => lines.push(...renderProject(item, index + 1), ''));
  }

  if (digest.mode === 'weekly' && digest.researchPicks?.length) {
    const selected = new Set(digest.selectedProjects.map((item) => item.repository.repoFullName));
    const extraPicks = digest.researchPicks.filter((item) => !selected.has(item.repository.repoFullName));
    if (extraPicks.length > 0) {
      lines.push('本周值得深入研究的 3 个项目');
      extraPicks.forEach((item, index) => lines.push(...renderProject(item, index + 1), ''));
    }
  }

  lines.push('数据说明：');
  digest.dataNotes.forEach((note) => lines.push(`- ${note}`));

  return lines.join('\n').trim();
}
