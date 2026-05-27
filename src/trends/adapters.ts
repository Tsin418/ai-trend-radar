import type { TrendingItem } from '../collectors/types.js';
import type { RadarRepository, ScoredRadarRepository } from '../radar/types.js';
import type { TrendItem } from './types.js';

function nowIso(): string {
  return new Date().toISOString();
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function trendItemFromRadarRepository(item: ScoredRadarRepository): TrendItem {
  const repo = item.repository;
  return {
    id: `github:${repo.repoFullName}`,
    source: 'github',
    sourceType: 'opensource',
    title: repo.repoFullName,
    url: repo.repoUrl,
    description: repo.description,
    category: repo.category,
    tags: repo.topics,
    author: repo.owner,
    metrics: {
      stars: repo.stars,
      starDelta24h: item.score.dailyStarDelta ?? undefined,
      starDelta7d: item.score.weeklyStarDelta ?? undefined
    },
    publishedAt: repo.createdAt ?? undefined,
    updatedAt: repo.pushedAt ?? undefined,
    collectedAt: item.score.scoreDate,
    raw: {
      language: repo.language,
      finalScore: item.score.finalScore,
      signals: item.score.signals
    }
  };
}

export function trendItemFromRadarRepo(repo: RadarRepository): TrendItem {
  return {
    id: `github:${repo.repoFullName}`,
    source: 'github',
    sourceType: 'opensource',
    title: repo.repoFullName,
    url: repo.repoUrl,
    description: repo.description,
    category: repo.category,
    tags: repo.topics,
    author: repo.owner,
    metrics: {
      stars: repo.stars
    },
    publishedAt: repo.createdAt ?? undefined,
    updatedAt: repo.pushedAt ?? undefined,
    collectedAt: repo.lastSeenAt,
    raw: {
      language: repo.language
    }
  };
}

export function productHuntTrendingItemToTrendItem(item: TrendingItem): TrendItem {
  const metadata = item.metadata ?? {};
  const productLinks = Array.isArray(metadata.productLinks) ? metadata.productLinks : [];
  const githubLink = productLinks
    .map((link) => stringValue((link as { url?: unknown })?.url))
    .find((url) => url?.includes('github.com'));
  return {
    id: item.id,
    source: 'product_hunt',
    sourceType: 'product_launch',
    title: item.title,
    url: item.url,
    originalUrl: githubLink ?? stringValue(metadata.website),
    description: item.description,
    tags: item.tags,
    category: item.primaryTag ?? undefined,
    metrics: {
      upvotes: numberValue(metadata.votesCount),
      commentsCount: numberValue(metadata.commentsCount),
      rank: numberValue(metadata.dailyRank) ?? item.rank
    },
    publishedAt: stringValue(metadata.featuredAt) ?? stringValue(metadata.createdAt),
    collectedAt: nowIso(),
    raw: metadata
  };
}
