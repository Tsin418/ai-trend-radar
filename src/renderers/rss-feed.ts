import type { RadarDigest, ScoredRadarRepository } from '../radar/types.js';

export interface RssFeedOptions {
  title: string;
  description: string;
  link: string;
  language?: string;
  ttl?: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(value: string): string {
  return `<![CDATA[${value.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
}

function pubDate(value: string | undefined): string {
  const timestamp = value ? Date.parse(value) : NaN;
  return new Date(Number.isFinite(timestamp) ? timestamp : Date.now()).toUTCString();
}

function starDeltaText(value: number | null): string {
  return value === null ? 'n/a' : `+${value}`;
}

function itemTitle(item: ScoredRadarRepository): string {
  const repo = item.repository;
  const delta = starDeltaText(item.score.dailyStarDelta);
  return `[${item.score.trendType}] ${repo.repoFullName} (${delta} stars/24h)`;
}

function itemDescription(item: ScoredRadarRepository): string {
  const repo = item.repository;
  const summary = item.llmSummary;
  return [
    `Category: ${summary?.aiCategory ?? repo.category}`,
    `Description: ${summary?.oneLiner ?? repo.description ?? 'No description'}`,
    `Why it matters: ${summary?.whyNow ?? summary?.whyTrending ?? item.whyItMatters}`,
    `Developer insight: ${summary?.developerInsight ?? summary?.developerTakeaway ?? item.developerInsight}`,
    `Risk: ${item.score.riskLevel}`
  ].join('\n');
}

export function renderItemToRss(item: ScoredRadarRepository): string {
  const repo = item.repository;
  return [
    '    <item>',
    `      <title>${escapeXml(itemTitle(item))}</title>`,
    `      <link>${escapeXml(repo.repoUrl)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(repo.repoUrl)}</guid>`,
    `      <description>${cdata(itemDescription(item))}</description>`,
    `      <pubDate>${pubDate(item.score.scoreDate)}</pubDate>`,
    `      <category>${escapeXml(item.llmSummary?.aiCategory ?? repo.category)}</category>`,
    '    </item>'
  ].join('\n');
}

function renderSummaryItem(digest: RadarDigest, link: string): string {
  const selected = digest.selectedProjects.map((item) => item.repository.repoFullName).join(', ');
  const description = [
    digest.summary,
    '',
    selected ? `Top projects: ${selected}` : '',
    ...digest.dataNotes.map((note) => `Note: ${note}`)
  ].filter(Boolean).join('\n');

  return [
    '    <item>',
    `      <title>${escapeXml(`${digest.title} - Today's Summary`)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <guid isPermaLink="false">${escapeXml(`${digest.mode}-${digest.date}-summary`)}</guid>`,
    `      <description>${cdata(description)}</description>`,
    `      <pubDate>${pubDate(digest.generatedAt)}</pubDate>`,
    '      <category>Summary</category>',
    '    </item>'
  ].join('\n');
}

export function renderRssXml(digest: RadarDigest, options: RssFeedOptions): string {
  const language = options.language ?? 'en';
  const ttl = options.ttl ?? 360;
  const items = [
    renderSummaryItem(digest, options.link),
    ...digest.selectedProjects.map(renderItemToRss)
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(options.title)}</title>`,
    `    <link>${escapeXml(options.link)}</link>`,
    `    <description>${escapeXml(options.description)}</description>`,
    `    <language>${escapeXml(language)}</language>`,
    `    <ttl>${ttl}</ttl>`,
    `    <lastBuildDate>${pubDate(digest.generatedAt)}</lastBuildDate>`,
    items.join('\n'),
    '  </channel>',
    '</rss>'
  ].join('\n');
}
