import type { RadarDigest, ScoredRadarRepository } from '../radar/types.js';
import type { MergedTrendEntity, TrendItem } from '../trends/types.js';
import { normalizeTrendUrl } from '../trends/dedupe.js';

export type RadarDigestTextFormat = 'full' | 'compact';

const SOURCE_LABELS: Record<string, string> = {
  github: 'GitHub',
  'github-trending': 'GitHub Trending',
  product_hunt: 'Product Hunt',
  'product-hunt': 'Product Hunt',
  hackernews: 'Hacker News',
  huggingface_models: 'Hugging Face Models',
  huggingface_spaces: 'Hugging Face Spaces',
  aihot: 'AIHot'
};

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

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function relatedMultiSourceItems(item: ScoredRadarRepository, digest: RadarDigest): TrendItem[] {
  const repoUrl = normalizeTrendUrl(item.repository.repoUrl);
  const repoName = item.repository.repoFullName.toLowerCase();
  return (digest.multiSourceItems ?? []).filter((trendItem) => {
    const urls = [trendItem.url, trendItem.originalUrl].filter((url): url is string => Boolean(url));
    if (urls.some((url) => normalizeTrendUrl(url) === repoUrl)) return true;
    const text = [trendItem.title, trendItem.description, trendItem.summary, trendItem.url, trendItem.originalUrl]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return text.includes(repoName);
  });
}

function renderProject(item: ScoredRadarRepository, index?: number, digest?: RadarDigest): string[] {
  const repo = item.repository;
  const score = item.score;
  const summary = item.llmSummary;
  const prefix = index === undefined ? '-' : `${index}.`;
  const relatedItems = digest ? relatedMultiSourceItems(item, digest) : [];

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

  if (relatedItems.length > 0) {
    const labels = Array.from(new Set(relatedItems.map((related) => sourceLabel(related.source))));
    lines.push(`   Also on: ${labels.join(', ')}`);
  }

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
  const sourceList = entity.sources.map(sourceLabel).join(' + ');
  const lines = [
    `${index}. ${entity.title}`,
    `   URL: ${entity.canonicalUrl}`,
    `   Cross-source: ${sourceList} 同时捕捉到该信号`,
    `   Why it matters: 同一趋势被 ${entity.sourceCount} 个来源同时捕捉，cross-source bonus ${entity.crossSourceBonus}。`
  ];

  if (entity.sources.includes('github') && entity.sources.includes('product_hunt')) {
    lines.push('   Signal: GitHub 热度 + Product Hunt 发布同步出现，该产品/项目正在集中获取关注。');
  }
  if (entity.sources.includes('github') && entity.sources.includes('hackernews')) {
    lines.push('   Signal: 开发者社区讨论伴随 GitHub 热度上升，可能是技术方向信号。');
  }
  if (entity.llmSummary?.whyNow) {
    lines.push(`   Why now: ${entity.llmSummary.whyNow}`);
  }
  return lines;
}

function renderTrendSection(title: string, items: TrendItem[]): string[] {
  if (items.length === 0) return [];
  return [
    title,
    ...items.flatMap((item, index) => [...renderTrendItem(item, index + 1), ''])
  ];
}

function renderChangesFromYesterday(digest: RadarDigest, compact = false): string[] {
  const changes = digest.changesFromYesterday;
  if (!changes) return [];
  if (compact) {
    const parts = [
      changes.newInTop10.length > 0 ? `+${changes.newInTop10.length} 新项目` : '',
      changes.droppedFromTop10.length > 0 ? `-${changes.droppedFromTop10.length} 退出` : '',
      changes.accelerationSurges.length > 0 ? `${changes.accelerationSurges.length} 个加速` : '',
      changes.categoryShift ? `方向变化 ${changes.categoryShift}` : 'Top category 无变化'
    ].filter(Boolean);
    return parts.length > 0 ? [`与昨日对比: ${parts.join(', ')}`, ''] : [];
  }

  const lines = ['与昨日对比：'];
  if (changes.newInTop10.length > 0) lines.push(`  + 新进 Top 10: ${changes.newInTop10.join(', ')}`);
  if (changes.droppedFromTop10.length > 0) lines.push(`  - 退出 Top 10: ${changes.droppedFromTop10.join(', ')}`);
  if (changes.accelerationSurges.length > 0) {
    changes.accelerationSurges.forEach((surge) => lines.push(`  ↗ 加速: ${surge.repoFullName} (${surge.accelerationChange}x)`));
  }
  if (changes.categoryShift) lines.push(`  方向变化: ${changes.categoryShift}`);
  lines.push('');
  return lines;
}

function renderProjectCompact(item: ScoredRadarRepository, index: number): string {
  const repo = item.repository;
  const score = item.score;
  const summary = item.llmSummary;
  const daily = score.dailyStarDelta === null ? '?' : score.dailyStarDelta.toLocaleString();
  const oneLiner = summary?.oneLiner ?? repo.description ?? '';
  return `${index}. ${repo.repoFullName} ⭐${repo.stars.toLocaleString()} (+${daily}/24h) | ${summary?.aiCategory ?? repo.category} | Risk: ${score.riskLevel} | ${oneLiner.slice(0, 140)}`;
}

function compactTrendList(items: TrendItem[], metric: 'upvotes' | 'likes' = 'upvotes'): string {
  return items.slice(0, 3).map((item) => {
    const value = metric === 'likes' ? item.metrics?.likes : item.metrics?.upvotes;
    return value === undefined ? item.title : `${item.title} (${value})`;
  }).join(', ');
}

function archiveUrl(digest: RadarDigest): string | null {
  const base = process.env.DIGEST_ARCHIVE_BASE_URL?.trim() || 'https://raw.githubusercontent.com/Tsin418/ai-trend-radar/main/data/archive';
  if (!base) return null;
  const match = digest.date.match(/^(\d{4})-(\d{2})-/);
  if (!match) return null;
  return `${base.replace(/\/$/, '')}/${match[1]}/${match[2]}/${digest.date}-${digest.mode}.md`;
}

function renderCompactRadarDigestText(digest: RadarDigest): string {
  const lines: string[] = [];
  lines.push(digest.title);
  lines.push('');
  if (digest.headline) lines.push(digest.headline);
  lines.push(digest.summary);
  lines.push('');

  if (digest.selectedProjects.length > 0) {
    lines.push(digest.mode === 'weekly' ? 'Top 5 This Week:' : 'Top 5:');
    digest.selectedProjects.slice(0, 5).forEach((item, index) => lines.push(renderProjectCompact(item, index + 1)));
    lines.push('');
  }

  if (digest.multiSourceSections) {
    const sections = digest.multiSourceSections;
    const productLaunches = compactTrendList(sections.productLaunches);
    const modelSignals = compactTrendList(sections.modelDemoSignals, 'likes');
    const hnBuzz = compactTrendList(sections.developerBuzz);
    if (productLaunches) lines.push(`Product Launches: ${productLaunches}`);
    if (modelSignals) lines.push(`Model & Demo Signals: ${modelSignals}`);
    if (hnBuzz) lines.push(`HN Buzz: ${hnBuzz}`);
    if (sections.crossSourceHighlights.length > 0) {
      lines.push(`Cross-source: ${sections.crossSourceHighlights.slice(0, 3).map((item) => item.title).join(', ')}`);
    }
    lines.push('');
  }

  lines.push(...renderChangesFromYesterday(digest, true));

  const url = archiveUrl(digest);
  if (url) lines.push(`完整分析 -> ${url}`);

  return lines.join('\n').trim();
}

export function renderRadarDigestText(digest: RadarDigest, format: RadarDigestTextFormat = 'full'): string {
  if (format === 'compact') return renderCompactRadarDigestText(digest);

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

  lines.push(...renderChangesFromYesterday(digest));

  if (digest.mode === 'weekly' && digest.categoryStats?.length) {
    if (digest.weeklyNarrative) {
      lines.push('本周分析：');
      lines.push(digest.weeklyNarrative.hottestDirection);
      if (digest.weeklyNarrative.notableProjects.length > 0) {
        lines.push(`值得关注：${digest.weeklyNarrative.notableProjects.join('；')}`);
      }
      lines.push(digest.weeklyNarrative.earlySignals);
      lines.push(digest.weeklyNarrative.developerBuzz);
      lines.push(digest.weeklyNarrative.developerTakeaway);
      lines.push('');
    }

    lines.push('本周最热方向：');
    for (const stat of digest.categoryStats.slice(0, 5)) {
      lines.push(`- ${stat.category}: ${stat.repoCount} repos, avg 7d ${stat.averageWeeklyStarDelta === null ? 'n/a' : `+${stat.averageWeeklyStarDelta}`}, top ${stat.topRepoFullName ?? 'n/a'}`);
    }
    lines.push('');
  }

  if (digest.selectedProjects.length > 0) {
    lines.push(digest.mode === 'weekly' ? '本周精选项目' : '今日精选项目');
    digest.selectedProjects.forEach((item, index) => lines.push(...renderProject(item, index + 1, digest), ''));
  }

  if (digest.mode === 'daily' && (digest.acceleratingProjects?.length ?? 0) > 0) {
    lines.push('🚀 Accelerating（近期突然加速的项目）');
    digest.acceleratingProjects.forEach((item, index) => lines.push(...renderProject(item, index + 1, digest), ''));
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
      extraPicks.forEach((item, index) => lines.push(...renderProject(item, index + 1, digest), ''));
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
