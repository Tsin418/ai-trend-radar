import { getDigestNarrativeLLMConfig, getLLMEnrichmentConfig, getTrendLLMEnrichmentConfig, loadRadarProfile } from '../radar/config.js';
import { summarizeCurrentFeedback } from '../feedback/summary.js';
import { getLocalDateLabel } from '../radar/date.js';
import { enrichDailyDigestNarrative } from '../llm/digest-narrative.js';
import { enrichRadarDigestWithLLM } from '../llm/repo-enricher.js';
import { enrichTrendEntitiesWithLLM } from '../llm/trend-enricher.js';
import { buildDailyRadarDigest } from '../renderers/daily-digest.js';
import type { RadarRunOptions, RadarRunResult } from './ai-developer-radar-shared.js';
import { appendErrorsToDigest, collectAndScoreRadarCandidates, getRadarLimits, maybeSendRadarDigest } from './ai-developer-radar-shared.js';
import { collectMultiSourceSignals } from './multi-source-radar.js';

export async function runAiDeveloperRadarDaily(options: RadarRunOptions = {}): Promise<RadarRunResult> {
  const startedAt = new Date().toISOString();
  const profile = loadRadarProfile();
  const { recommendationLimit } = getRadarLimits(options);
  const storePathContext = await collectAndScoreRadarCandidates(options);

  try {
    const date = getLocalDateLabel();
    const baselineCreated = options.baselineOnly || storePathContext.scored.length === 0 || storePathContext.scored.every((item) => item.score.dailyStarDelta === null);
    let digest = buildDailyRadarDigest(storePathContext.scored, profile, date, recommendationLimit, baselineCreated, storePathContext.store);
    const multiSource = await collectMultiSourceSignals(storePathContext.scored, recommendationLimit);
    const trendEnriched = await enrichTrendEntitiesWithLLM(
      [...multiSource.trendEntities, ...multiSource.topicClusters],
      getTrendLLMEnrichmentConfig()
    );
    const enrichedTrendMap = new Map(trendEnriched.entities.map((entity) => [entity.id, entity]));
    const trendEntities = multiSource.trendEntities.map((entity) => enrichedTrendMap.get(entity.id) ?? entity);
    const topicClusters = multiSource.topicClusters.map((entity) => enrichedTrendMap.get(entity.id) ?? entity);
    digest = {
      ...digest,
      multiSourceSections: {
        ...multiSource.sections,
        crossSourceHighlights: multiSource.sections.crossSourceHighlights.map((entity) => enrichedTrendMap.get(entity.id) ?? entity)
      },
      multiSourceItems: multiSource.items,
      sourceHealth: [...storePathContext.sourceHealth, ...multiSource.sourceHealth],
      trendEntities,
      topicClusters,
      dataNotes: [
        ...digest.dataNotes,
        ...multiSource.warnings.map((warning) => `Multi-source warning: ${warning}`),
        ...trendEnriched.warnings.map((warning) => `Trend enrichment warning: ${warning}`)
      ]
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
    const narrative = await enrichDailyDigestNarrative(digest, getDigestNarrativeLLMConfig());
    digest = narrative.digest;
    if (narrative.warnings.length > 0) {
      narrative.warnings.forEach((warning) => console.warn(`[Digest narrative] ${warning}`));
      digest = {
        ...digest,
        dataNotes: [...digest.dataNotes, ...narrative.warnings]
      };
    }
    digest = appendErrorsToDigest(digest, storePathContext.errors);
    digest = {
      ...digest,
      feedbackSummary: summarizeCurrentFeedback()
    };
    const notify = await maybeSendRadarDigest(digest, options.send);
    storePathContext.store.recordDigestRun('daily', startedAt, 'success', digest.selectedProjects.length);

    return {
      ok: true,
      digest,
      scored: storePathContext.scored,
      store: storePathContext.store,
      notify
    };
  } catch (error) {
    storePathContext.store.recordDigestRun('daily', startedAt, 'failed', 0, error instanceof Error ? error.message : String(error));
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown radar daily error'
    };
  }
}
