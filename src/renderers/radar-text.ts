import type { RadarDigest, ScoredRadarRepository } from '../radar/types.js';
import type { MergedTrendEntity, TrendItem } from '../trends/types.js';

function deltaText(value: number | null, suffix: string): string {
  return value === null ? `${suffix} 暂无基线` : `${suffix} +${value}`;
}

function trendTypeText(value: ScoredRadarRepository['score']['trendType']): string {
  switch (value) {
    case 'sudden_breakout':
      return '突然爆火';
    case 'early_signal':
      return '早期信号';
    case 'sustained_hot':
      return '持续热门';
  }
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
    `   Trend: ${trendTypeText(summary?.trendType ?? score.trendType)} | Acceleration: ${score.acceleration}x (${score.accelerationConfidence}, 前 3 日均值 ${score.threeDayAverageDelta ?? 'n/a'})`,
    `   Score: ${score.finalScore} | Risk: ${score.riskLevel}`,
    `   One-liner: ${summary?.oneLiner ?? repo.description ?? '暂无项目描述'}`,
    `   Why worth watching: ${summary?.whyNow ?? summary?.whyTrending ?? item.whyItMatters}`,
    `   Developer takeaway: ${summary?.developerInsight ?? summary?.developerTakeaway ?? item.developerInsight}`
  ];

  if (summary) {
    lines.push(
      `   Problem solved: ${summary.problemSolved}`,
      `   What changed: ${summary.whatChanged}`,
      `   Target users: ${summary.targetUsers}`,
      `   Risk notes: ${summary.riskNotes}`,
      `   LLM confidence: ${summary.confidence}`
    );
  }

  return lines;
}

function metricText(item: TrendItem): string {
  const metrics = item.metrics ?? {};
  const parts = [
    metrics.stars !== undefined ? `Stars ${metrics.stars.toLocaleString()}` : '',
    metrics.starDelta24h !== undefined ? `24h +${metrics.starDelta24h}` : '',
    metrics.upvotes !== undefined ? `Votes ${metrics.upvotes}` : '',
    metrics.likes !== undefined ? `Likes ${metrics.likes}` : '',
    metrics.downloads !== undefined ? `Downloads ${metrics.downloads.toLocaleString()}` : '',
    metrics.commentsCount !== undefined ? `Comments ${metrics.commentsCount}` : ''
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : 'Signal captured';
}

function renderTrendItem(item: TrendItem, index: number): string[] {
  const lines = [
    `${index}. ${item.title}`,
    `   Source: ${item.source} | Type: ${item.sourceType}`,
    `   URL: ${item.url}`,
    `   ${metricText(item)}`
  ];

  if (item.category) lines.push(`   Category: ${item.category}`);
  if (item.summary || item.description) lines.push(`   Summary: ${item.summary ?? item.description}`);
  if (item.originalSource || item.originalUrl) {
    lines.push(`   Original: ${[item.originalSource, item.originalUrl].filter(Boolean).join(' - ')}`);
  }
  if (item.recommendedReason) lines.push(`   Why it matters: ${item.recommendedReason}`);
  return lines;
}

function renderCrossSource(entity: MergedTrendEntity, index: number): string[] {
  return [
    `${index}. ${entity.title}`,
    `   URL: ${entity.canonicalUrl}`,
    `   Sources: ${entity.sources.join(', ')}`,
    `   Why it matters: 同一趋势被 ${entity.sourceCount} 个来源同时捕捉，cross-source bonus ${entity.crossSourceBonus}。`
  ];
}

function renderTrendSection(title: string, items: TrendItem[]): string[] {
  if (items.length === 0) return [];
  return [
    title,
    ...items.flatMap((item, index) => [...renderTrendItem(item, index + 1), ''])
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

  if (digest.selectedProjects.length > 0) {
    lines.push(digest.mode === 'weekly' ? '本周精选项目' : '今日精选项目');
    digest.selectedProjects.forEach((item, index) => lines.push(...renderProject(item, index + 1), ''));
  }

  if (digest.mode === 'daily' && (digest.acceleratingProjects?.length ?? 0) > 0) {
    lines.push('🚀 Accelerating（近期突然加速的项目）');
    digest.acceleratingProjects.forEach((item, index) => lines.push(...renderProject(item, index + 1), ''));
  }

  if (digest.mode === 'daily' && digest.multiSourceSections) {
    const sections = digest.multiSourceSections;
    lines.push(...renderTrendSection('Product Launches', sections.productLaunches));
    lines.push(...renderTrendSection('Model & Demo Signals', sections.modelDemoSignals));
    lines.push(...renderTrendSection('Developer Buzz', sections.developerBuzz));
    lines.push(...renderTrendSection('AIHot Curated Highlights', sections.aihotHighlights));
    if (sections.crossSourceHighlights.length > 0) {
      lines.push('Cross-source Highlights');
      sections.crossSourceHighlights.forEach((entity, index) => lines.push(...renderCrossSource(entity, index + 1), ''));
    }
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

  if (digest.feedbackSummary) {
    const usefulCategories = digest.feedbackSummary.usefulCategories
      .slice(0, 3)
      .map((item) => `${item.category} ${item.count}`)
      .join('、') || '暂无';
    lines.push('');
    lines.push('反馈摘要：');
    lines.push(`- 本周反馈 ${digest.feedbackSummary.weekEntries} 条：有用 ${digest.feedbackSummary.usefulThisWeek}，不相关 ${digest.feedbackSummary.notUsefulThisWeek}，已看 ${digest.feedbackSummary.seenThisWeek}。`);
    lines.push(`- 本周有用方向：${usefulCategories}。`);
  }

  if (digest.mode === 'daily') {
    lines.push('');
    lines.push('💬 反馈：对今天的推荐有什么想法？运行 `npx gtr feedback --useful owner/repo`、`--not-useful owner/repo` 或 `--seen owner/repo`。');
  }

  return lines.join('\n').trim();
}
