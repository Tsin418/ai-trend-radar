import { getDigestNarrativeLLMConfig, getLLMEnrichmentConfig, loadRadarProfile } from '../radar/config.js';
import { getLocalIsoWeekLabel } from '../radar/date.js';
import { enrichWeeklyDigestNarrative } from '../llm/digest-narrative.js';
import { enrichRadarDigestWithLLM } from '../llm/repo-enricher.js';
import { writeDigestArchive } from '../renderers/archive.js';
import { buildWeeklyRadarDigest } from '../renderers/weekly-digest.js';
import type { RadarCategoryStat, RadarStoreData } from '../radar/types.js';
import type { RadarRunOptions, RadarRunResult } from './ai-developer-radar-shared.js';
import { appendErrorsToDigest, collectAndScoreRadarCandidates, getRadarLimits, maybeSendRadarDigest } from './ai-developer-radar-shared.js';

function safeDate(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function computeRecurringProjects(data: RadarStoreData, now = Date.now()): string[] {
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const daysByRepo = new Map<string, Set<string>>();
  for (const snapshot of data.snapshots) {
    const timestamp = safeDate(snapshot.collectedAt);
    if (timestamp < weekAgo || timestamp > now) continue;
    const days = daysByRepo.get(snapshot.repoFullName) ?? new Set<string>();
    days.add(snapshot.collectedAt.slice(0, 10));
    daysByRepo.set(snapshot.repoFullName, days);
  }
  return [...daysByRepo.entries()]
    .filter(([, days]) => days.size >= 3)
    .map(([repoFullName]) => repoFullName)
    .slice(0, 20);
}

function categoryStatsForScoreWindow(data: RadarStoreData, start: number, end: number): RadarCategoryStat[] {
  const grouped = new Map<string, number[]>();
  for (const score of data.scores) {
    const timestamp = safeDate(score.scoreDate);
    if (timestamp < start || timestamp >= end) continue;
    const category = data.repositories[score.repoFullName]?.category ?? 'Unknown';
    const values = grouped.get(category) ?? [];
    if (score.weeklyStarDelta !== null) values.push(score.weeklyStarDelta);
    grouped.set(category, values);
  }
  return [...grouped.entries()].map(([category, values]) => ({
    category,
    repoCount: values.length,
    averageWeeklyStarDelta: values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
    topRepoFullName: null,
    newRepoCount: 0
  })).sort((a, b) => (b.averageWeeklyStarDelta ?? -1) - (a.averageWeeklyStarDelta ?? -1));
}

export async function runAiDeveloperRadarWeekly(options: RadarRunOptions = {}): Promise<RadarRunResult> {
  const startedAt = new Date().toISOString();
  const profile = loadRadarProfile();
  const { recommendationLimit } = getRadarLimits(options);
  const context = await collectAndScoreRadarCandidates(options);

  try {
    const insufficientWeeklyData = context.scored.length === 0 || context.scored.every((item) => item.score.weeklyStarDelta === null);
    let digest = buildWeeklyRadarDigest(context.scored, profile, getLocalIsoWeekLabel(), recommendationLimit, insufficientWeeklyData);
    const storeData = context.store.load();
    const now = Date.now();
    digest = {
      ...digest,
      recurringProjects: computeRecurringProjects(storeData, now),
      weekOverWeekComparison: {
        topCategoriesThisWeek: (digest.categoryStats ?? []).slice(0, 5).map((item) => ({
          category: item.category,
          repoCount: item.repoCount,
          avgDelta: item.averageWeeklyStarDelta
        })),
        topCategoriesLastWeek: categoryStatsForScoreWindow(
          storeData,
          now - 14 * 24 * 60 * 60 * 1000,
          now - 7 * 24 * 60 * 60 * 1000
        ).slice(0, 5).map((item) => ({
          category: item.category,
          repoCount: item.repoCount,
          avgDelta: item.averageWeeklyStarDelta
        }))
      }
    };
    const enriched = await enrichRadarDigestWithLLM(digest, getLLMEnrichmentConfig());
    digest = enriched.digest;
    if (enriched.warnings.length > 0) {
      enriched.warnings.forEach((warning) => console.warn(`[LLM enrichment] ${warning}`));
      const llmNote = enriched.warnings.some((warning) => warning.includes('missing DEEPSEEK_API_KEY'))
        ? 'LLM enrichment unavailable; fallback descriptions were used.'
        : `LLM enrichment partially unavailable for ${enriched.warnings.length} project(s); fallback descriptions were used.`;
      digest = {
        ...digest,
        dataNotes: [...digest.dataNotes, llmNote]
      };
    }
    const narrative = await enrichWeeklyDigestNarrative(digest, getDigestNarrativeLLMConfig());
    digest = narrative.digest;
    if (narrative.warnings.length > 0) {
      narrative.warnings.forEach((warning) => console.warn(`[Weekly narrative] ${warning}`));
      digest = {
        ...digest,
        dataNotes: [...digest.dataNotes, ...narrative.warnings]
      };
    }
    digest = appendErrorsToDigest(digest, context.errors);
    writeDigestArchive(digest);
    const notify = await maybeSendRadarDigest(digest, options.send);
    context.store.recordDigestRun('weekly', startedAt, 'success', digest.selectedProjects.length);

    return {
      ok: true,
      digest,
      notify
    };
  } catch (error) {
    context.store.recordDigestRun('weekly', startedAt, 'failed', 0, error instanceof Error ? error.message : String(error));
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown radar weekly error'
    };
  }
}
