import { loadRadarProfile } from '../radar/config.js';
import { getLocalIsoWeekLabel } from '../radar/date.js';
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
