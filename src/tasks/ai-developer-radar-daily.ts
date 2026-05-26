import { getLLMEnrichmentConfig, loadRadarProfile } from '../radar/config.js';
import { getLocalDateLabel } from '../radar/date.js';
import { enrichRadarDigestWithLLM } from '../llm/repo-enricher.js';
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
    let digest = buildDailyRadarDigest(storePathContext.scored, profile, date, recommendationLimit, baselineCreated);
    const multiSource = await collectMultiSourceSignals(storePathContext.scored, recommendationLimit);
    digest = {
      ...digest,
      multiSourceSections: multiSource.sections,
      dataNotes: [
        ...digest.dataNotes,
        ...multiSource.warnings.map((warning) => `Multi-source warning: ${warning}`)
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
    digest = appendErrorsToDigest(digest, storePathContext.errors);
    const notify = await maybeSendRadarDigest(digest, options.send);
    storePathContext.store.recordDigestRun('daily', startedAt, 'success', digest.selectedProjects.length);

    return {
      ok: true,
      digest,
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
