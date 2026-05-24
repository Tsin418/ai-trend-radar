import { getLLMEnrichmentConfig, loadRadarProfile } from '../radar/config.js';
import { getLocalIsoWeekLabel } from '../radar/date.js';
import { enrichRadarDigestWithLLM } from '../llm/repo-enricher.js';
import { buildWeeklyRadarDigest } from '../renderers/weekly-digest.js';
import type { RadarRunOptions, RadarRunResult } from './ai-developer-radar-shared.js';
import { appendErrorsToDigest, collectAndScoreRadarCandidates, getRadarLimits, maybeSendRadarDigest } from './ai-developer-radar-shared.js';

export async function runAiDeveloperRadarWeekly(options: RadarRunOptions = {}): Promise<RadarRunResult> {
  const startedAt = new Date().toISOString();
  const profile = loadRadarProfile();
  const { recommendationLimit } = getRadarLimits(options);
  const context = await collectAndScoreRadarCandidates(options);

  try {
    const insufficientWeeklyData = context.scored.length === 0 || context.scored.every((item) => item.score.weeklyStarDelta === null);
    let digest = buildWeeklyRadarDigest(context.scored, profile, getLocalIsoWeekLabel(), recommendationLimit, insufficientWeeklyData);
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
    digest = appendErrorsToDigest(digest, context.errors);
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
