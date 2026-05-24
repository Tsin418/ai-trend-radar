import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadRadarProfile } from '../../src/radar/config.js';
import { createSampleRepositories } from '../../src/radar/sample-data.js';
import { createPotentialScoreRanker } from '../../src/rankers/potential-score.js';
import { buildDailyRadarDigest } from '../../src/renderers/daily-digest.js';
import { renderRadarDigestText } from '../../src/renderers/radar-text.js';
import { JsonRadarStore, createSnapshots } from '../../src/storage/json-store.js';

function createScoredDigestInput() {
  const profile = loadRadarProfile();
  const now = new Date('2026-05-24T01:00:00.000Z');
  const repo = createSampleRepositories(now)[0];
  const store = new JsonRadarStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'radar-store-')), 'store.json'));
  store.addSnapshots(createSnapshots([{
    ...repo,
    stars: repo.stars - 90
  }], new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()));
  store.addSnapshots(createSnapshots([repo], now.toISOString()));
  const scored = createPotentialScoreRanker().score([repo], profile, store, now.toISOString());
  return { profile, scored };
}

test('enriched renderer includes URL, score, star delta, and LLM summary', () => {
  const { profile, scored } = createScoredDigestInput();
  const digest = buildDailyRadarDigest([{
    ...scored[0],
    llmSummary: {
      oneLiner: 'LLM one-liner for the project.',
      problemSolved: 'It solves repo automation.',
      aiCategory: 'Coding',
      whyTrending: 'It is gaining developer attention.',
      developerTakeaway: 'Study its repo context handling.',
      targetUsers: 'AI builders.',
      riskNotes: 'Check production readiness.',
      confidence: 'high'
    }
  }], profile, '2026-05-24', 10, false);
  const text = renderRadarDigestText(digest);

  assert.match(text, /GitHub: https:\/\/github\.com\//);
  assert.match(text, /Stars: .*\(24h \+90/);
  assert.match(text, /Score:/);
  assert.match(text, /One-liner: LLM one-liner for the project\./);
  assert.match(text, /Why worth watching: It is gaining developer attention\./);
  assert.match(text, /Developer takeaway: Study its repo context handling\./);
  assert.match(text, /Risk notes: Check production readiness\./);
});

test('renderer hides LLM unavailable placeholders when summary is missing', () => {
  const { profile, scored } = createScoredDigestInput();
  const digest = buildDailyRadarDigest(scored, profile, '2026-05-24', 10, false);
  const text = renderRadarDigestText(digest);

  assert.doesNotMatch(text, /LLM summary unavailable/);
  assert.doesNotMatch(text, /LLM confidence: unavailable/);
  assert.match(text, /GitHub: https:\/\/github\.com\//);
  assert.match(text, /Why worth watching:/);
  assert.match(text, /Developer takeaway:/);
});
