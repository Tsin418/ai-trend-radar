import type { TrendItem } from './types.js';

export type AccelerationConfidence = 'high' | 'medium' | 'low';

export interface AccelerationResult {
  acceleration: number;
  confidence: AccelerationConfidence;
}

function metric(value: number | undefined, cap: number): number {
  if (!value || value <= 0) return 0;
  return Math.min(100, (Math.log10(value + 1) / Math.log10(cap + 1)) * 100);
}

function recencyScore(value: string | undefined): number {
  if (!value) return 30;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 30;
  const ageHours = Math.max(0, (Date.now() - timestamp) / 3_600_000);
  if (ageHours <= 24) return 100;
  if (ageHours <= 72) return 75;
  if (ageHours <= 168) return 50;
  return 25;
}

export function scoreTrendItem(item: TrendItem): number {
  const metrics = item.metrics ?? {};
  const recency = recencyScore(item.publishedAt ?? item.updatedAt);

  switch (item.sourceType) {
    case 'product_launch':
      return Math.round(metric(metrics.upvotes, 1000) * 0.7 + metric(metrics.commentsCount, 200) * 0.2 + recency * 0.1);
    case 'model_hub':
      return Math.round(metric(metrics.downloads, 1_000_000) * 0.55 + metric(metrics.likes, 10_000) * 0.3 + recency * 0.15);
    case 'developer_discussion':
      return Math.round(metric(metrics.upvotes, 1000) * 0.55 + metric(metrics.commentsCount, 500) * 0.3 + recency * 0.15);
    case 'curated_trend':
    case 'media':
      return Math.round(recency * 0.55 + (item.summary || item.recommendedReason ? 35 : 20));
    case 'opensource':
      return Math.round(metric(metrics.starDelta24h ?? metrics.stars, 10_000) * 0.65 + metric(metrics.starDelta7d, 50_000) * 0.25 + recency * 0.1);
    default:
      return recency;
  }
}

export function calcAcceleration(todayDelta: number, historicalDeltas: number[]): AccelerationResult {
  const usableDeltas = historicalDeltas.filter((value) => Number.isFinite(value));
  if (usableDeltas.length < 2) {
    return { acceleration: 1.0, confidence: 'low' };
  }

  const avg = usableDeltas.reduce((sum, value) => sum + value, 0) / usableDeltas.length;
  if (avg <= 0) {
    return { acceleration: todayDelta > 0 ? 3.0 : 1.0, confidence: 'medium' };
  }

  const acceleration = todayDelta / avg;
  return {
    acceleration: Math.round(acceleration * 10) / 10,
    confidence: usableDeltas.length >= 3 ? 'high' : 'medium'
  };
}

export function sortTrendItems(items: TrendItem[]): TrendItem[] {
  return [...items].sort((left, right) => scoreTrendItem(right) - scoreTrendItem(left));
}
