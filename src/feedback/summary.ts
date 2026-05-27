import path from 'node:path';
import type { FeedbackEntry, FeedbackSummary, ScoredRadarRepository } from '../radar/types.js';
import { JsonFeedbackStore } from '../storage/json-store.js';

export function getFeedbackStorePath(): string {
  return process.env.RADAR_FEEDBACK_PATH || path.join('data', 'feedback.json');
}

export function createFeedbackStore(): JsonFeedbackStore {
  return new JsonFeedbackStore(getFeedbackStorePath());
}

function weekCutoff(now: Date): number {
  return now.getTime() - 7 * 24 * 60 * 60 * 1000;
}

export function buildFeedbackSummary(entries: FeedbackEntry[], now = new Date()): FeedbackSummary {
  const cutoff = weekCutoff(now);
  const weekEntries = entries.filter((entry) => {
    const timestamp = Date.parse(entry.feedbackAt);
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
  const useful = weekEntries.filter((entry) => entry.action === 'useful');
  const usefulCategories = new Map<string, number>();

  for (const entry of useful) {
    const category = entry.category ?? 'unknown';
    usefulCategories.set(category, (usefulCategories.get(category) ?? 0) + 1);
  }

  return {
    totalEntries: entries.length,
    weekEntries: weekEntries.length,
    usefulThisWeek: useful.length,
    notUsefulThisWeek: weekEntries.filter((entry) => entry.action === 'not_useful').length,
    seenThisWeek: weekEntries.filter((entry) => entry.action === 'seen').length,
    usefulCategories: [...usefulCategories.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    recentUsefulRepos: useful
      .sort((a, b) => Date.parse(b.feedbackAt) - Date.parse(a.feedbackAt))
      .slice(0, 5)
      .map((entry) => entry.repoFullName)
  };
}

export function summarizeCurrentFeedback(now = new Date()): FeedbackSummary {
  return buildFeedbackSummary(createFeedbackStore().load().entries, now);
}

export function findScoredRepoContext(
  repoFullName: string,
  scored: ScoredRadarRepository[] | undefined
): Pick<FeedbackEntry, 'scoredAt' | 'scoreAtTime' | 'rankAtTime' | 'category'> {
  if (!scored) return {};
  const index = scored.findIndex((item) => item.repository.repoFullName.toLowerCase() === repoFullName.toLowerCase());
  if (index < 0) return {};
  const item = scored[index];
  return {
    scoredAt: item.score.scoreDate,
    scoreAtTime: item.score.finalScore,
    rankAtTime: index + 1,
    category: item.repository.category
  };
}
