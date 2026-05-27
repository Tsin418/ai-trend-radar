import { scoreTrendItem } from '../trends/scoring.js';
import type { TrendEntity, TrendItem } from '../trends/types.js';
import type { IntelligenceEvidenceItem, TopicBrief } from './types.js';

export interface TopicBriefBuilderOptions {
  limit?: number;
  evidenceLimitPerTopic?: number;
}

const DEFAULT_LIMIT = 5;
const DEFAULT_EVIDENCE_LIMIT = 6;

export function buildTopicBriefs(
  topicClusters: TrendEntity[],
  options: TopicBriefBuilderOptions = {}
): TopicBrief[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const evidenceLimitPerTopic = options.evidenceLimitPerTopic ?? DEFAULT_EVIDENCE_LIMIT;

  return topicClusters
    .filter(isUsableTopic)
    .sort(compareTopics)
    .slice(0, limit)
    .map((entity) => toTopicBrief(entity, evidenceLimitPerTopic));
}

export function toEvidenceItem(item: TrendItem): IntelligenceEvidenceItem {
  return {
    id: item.id,
    title: item.title,
    source: item.source,
    sourceType: item.sourceType,
    url: item.url,
    summary: item.summary ?? item.description ?? item.recommendedReason,
    category: item.category,
    tags: item.tags,
    publishedAt: item.publishedAt,
    collectedAt: item.collectedAt,
    metrics: item.metrics
  };
}

function compareTopics(left: TrendEntity, right: TrendEntity): number {
  return right.metrics.heatScore - left.metrics.heatScore ||
    right.sourceCount - left.sourceCount ||
    right.crossSourceBonus - left.crossSourceBonus;
}

function isUsableTopic(entity: TrendEntity): boolean {
  if (!entity.title.trim()) return false;
  if (entity.items.length === 0) return false;
  if (entity.metrics.heatScore <= 0) return false;
  if (entity.sourceCount > 1) return true;
  return hasMeaningfulMetrics(entity) || entity.items.length >= 3;
}

function hasMeaningfulMetrics(entity: TrendEntity): boolean {
  const metrics = entity.metrics;
  return Boolean(
    (metrics.starDelta24h ?? 0) >= 10 ||
    (metrics.starDelta7d ?? 0) >= 30 ||
    (metrics.votes ?? 0) >= 50 ||
    (metrics.likes ?? 0) >= 50 ||
    (metrics.downloads ?? 0) >= 1_000 ||
    (metrics.commentsCount ?? 0) >= 10
  );
}

function toTopicBrief(entity: TrendEntity, evidenceLimit: number): TopicBrief {
  const summary = entity.llmSummary;
  const evidenceItems = [...entity.items]
    .sort((left, right) => scoreTrendItem(right) - scoreTrendItem(left))
    .slice(0, evidenceLimit)
    .map(toEvidenceItem);

  return {
    id: entity.id,
    title: entity.title,
    category: entity.category,
    sources: entity.sources,
    sourceCount: entity.sourceCount,
    heatScore: entity.metrics.heatScore,
    confidence: adjustedConfidence(entity),
    watchDecision: summary?.watchDecision ?? fallbackWatchDecision(entity),
    whatItIs: summary?.whatItIs ?? fallbackWhatItIs(entity),
    whyNow: summary?.whyNow ?? fallbackWhyNow(entity),
    whoShouldCare: summary?.whoShouldCare ?? fallbackWhoShouldCare(entity),
    developerRelevance: summary?.developerRelevance ?? fallbackDeveloperRelevance(entity),
    businessRelevance: summary?.businessRelevance ?? fallbackBusinessRelevance(entity),
    riskNotes: summary?.riskNotes ?? fallbackRiskNotes(entity),
    technicalKeywords: summary?.technicalKeywords?.length ? summary.technicalKeywords : fallbackTechnicalKeywords(entity),
    evidenceItems,
    relatedEntities: relatedEntities(entity),
    metrics: {
      stars: entity.metrics.stars,
      starDelta24h: entity.metrics.starDelta24h,
      starDelta7d: entity.metrics.starDelta7d,
      votes: entity.metrics.votes,
      likes: entity.metrics.likes,
      downloads: entity.metrics.downloads,
      commentsCount: entity.metrics.commentsCount,
      heatScore: entity.metrics.heatScore,
      crossSourceBonus: entity.metrics.crossSourceBonus
    }
  };
}

function adjustedConfidence(entity: TrendEntity): TopicBrief['confidence'] {
  if (!entity.llmSummary) return entity.sourceCount > 1 && hasMeaningfulMetrics(entity) ? 'medium' : 'low';
  if (entity.sourceCount <= 1 || entity.items.length <= 1) return 'low';
  return entity.llmSummary.confidence;
}

function fallbackWatchDecision(entity: TrendEntity): TopicBrief['watchDecision'] {
  if (entity.sourceCount >= 2 && entity.metrics.heatScore >= 80) return 'deep_dive';
  if (entity.sourceCount >= 2 || hasMeaningfulMetrics(entity)) return 'track';
  return 'wait';
}

function fallbackWhatItIs(entity: TrendEntity): string {
  const category = entity.category ? ` in ${entity.category}` : '';
  return `${entity.title} is an AI trend topic${category} represented by related signals from today's collection.`;
}

function fallbackWhyNow(entity: TrendEntity): string {
  const sourceText = entity.sources.join(', ');
  return `This topic appeared across ${entity.sourceCount} source(s): ${sourceText}, with ${entity.items.length} related signal(s). Treat it as correlation evidence rather than proven adoption.`;
}

function fallbackWhoShouldCare(entity: TrendEntity): string {
  return `Developers, technical founders, and product builders tracking ${entity.title} should watch how the evidence develops.`;
}

function fallbackDeveloperRelevance(entity: TrendEntity): string {
  return `Review the linked evidence for implementation patterns, tooling choices, and developer workflow implications around ${entity.title}.`;
}

function fallbackBusinessRelevance(entity: TrendEntity): string {
  return `The topic may indicate market attention, launch activity, or developer interest, but the current evidence should not be read as proof of durable demand.`;
}

function fallbackRiskNotes(entity: TrendEntity): string {
  if (entity.sourceCount <= 1) return 'Evidence is concentrated in one source, so confidence is low until more independent signals appear.';
  return 'Evidence is attention-based and may reflect short-term interest rather than production adoption.';
}

function fallbackTechnicalKeywords(entity: TrendEntity): string[] {
  const words = new Set<string>();
  for (const item of entity.items) {
    for (const tag of item.tags ?? []) words.add(tag);
    if (item.category) words.add(item.category);
  }
  return [...words].slice(0, 8);
}

function relatedEntities(entity: TrendEntity): string[] {
  return Array.from(new Set(
    entity.items
      .map((item) => item.title)
      .filter((title) => title.trim() && title !== entity.title)
  )).slice(0, 8);
}
