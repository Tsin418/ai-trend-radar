import { loadRadarProfile } from '../radar/config.js';
import { getLocalDateLabel } from '../radar/date.js';
import { buildDailyRadarDigest } from '../renderers/daily-digest.js';
import type { RadarRunOptions, RadarRunResult } from './ai-developer-radar-shared.js';
import { appendErrorsToDigest, collectAndScoreRadarCandidates, getRadarLimits, maybeSendRadarDigest } from './ai-developer-radar-shared.js';

export async function runAiDeveloperRadarDaily(options: RadarRunOptions = {}): Promise<RadarRunResult> {
  const startedAt = new Date().toISOString();
  const profile = loadRadarProfile();
  const { recommendationLimit } = getRadarLimits(options);
  const storePathContext = await collectAndScoreRadarCandidates(options);

  try {
    const date = getLocalDateLabel();
    const baselineCreated = options.baselineOnly || storePathContext.scored.length === 0 || storePathContext.scored.every((item) => item.score.dailyStarDelta === null);
    let digest = buildDailyRadarDigest(storePathContext.scored, profile, date, recommendationLimit, baselineCreated);
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
