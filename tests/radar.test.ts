import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classifyAiCategory } from '../src/rankers/ai-category.js';
import { createPotentialScoreRanker } from '../src/rankers/potential-score.js';
import { loadRadarProfile } from '../src/radar/config.js';
import { createSampleRepositories } from '../src/radar/sample-data.js';
import type { RadarRepository } from '../src/radar/types.js';
import { buildDailyRadarDigest } from '../src/renderers/daily-digest.js';
import { renderRadarDigestText } from '../src/renderers/radar-text.js';
import { JsonRadarStore, createSnapshots } from '../src/storage/json-store.js';

function createTempStore(): JsonRadarStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-store-'));
  return new JsonRadarStore(path.join(dir, 'store.json'));
}

function withStars(repo: RadarRepository, stars: number): RadarRepository {
  return {
    ...repo,
    stars
  };
}

test('AI keyword classification detects coding agent projects', () => {
  const repo = createSampleRepositories()[0];
  const result = classifyAiCategory(repo);

  assert.equal(result.category, 'Coding Agent / SWE Agent');
  assert.ok(result.aiRelevanceScore >= 50);
});

test('JSON store writes snapshots and potential ranker calculates daily and weekly deltas', () => {
  const store = createTempStore();
  const now = new Date('2026-05-24T01:00:00.000Z');
  const repo = createSampleRepositories(now)[0];
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  store.addSnapshots(createSnapshots([withStars(repo, 700)], weekAgo));
  store.addSnapshots(createSnapshots([withStars(repo, 780)], dayAgo));
  store.addSnapshots(createSnapshots([repo], now.toISOString()));

  const scored = createPotentialScoreRanker().score([repo], loadRadarProfile(), store, now.toISOString());

  assert.equal(scored[0].score.dailyStarDelta, 40);
  assert.equal(scored[0].score.weeklyStarDelta, 120);
});

test('baseline day marks missing delta without inventing growth', () => {
  const store = createTempStore();
  const now = new Date('2026-05-24T01:00:00.000Z');
  const repo = createSampleRepositories(now)[1];
  store.addSnapshots(createSnapshots([repo], now.toISOString()));

  const scored = createPotentialScoreRanker().score([repo], loadRadarProfile(), store, now.toISOString());

  assert.equal(scored[0].score.dailyStarDelta, null);
  assert.equal(scored[0].score.weeklyStarDelta, null);
});

test('daily digest prioritizes hot projects and fills with early signals', () => {
  const profile = loadRadarProfile();
  const store = createTempStore();
  const now = new Date('2026-05-24T01:00:00.000Z');
  const [hot, early, fallback] = createSampleRepositories(now);
  store.addSnapshots(createSnapshots([
    withStars(hot, hot.stars - 80),
    withStars(early, early.stars - 30),
    withStars(fallback, fallback.stars - 5)
  ], new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()));
  store.addSnapshots(createSnapshots([
    withStars(hot, hot.stars - 180),
    withStars(early, early.stars - 100),
    withStars(fallback, fallback.stars - 20)
  ], new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()));
  store.addSnapshots(createSnapshots([hot, early, fallback], now.toISOString()));

  const scored = createPotentialScoreRanker().score([hot, early, fallback], profile, store, now.toISOString());
  const digest = buildDailyRadarDigest(scored, profile, '2026-05-24', 10, false);

  assert.equal(digest.hotProjects[0].repository.repoFullName, hot.repoFullName);
  assert.ok(digest.earlySignals.some((item) => item.repository.repoFullName === early.repoFullName));
  assert.ok(digest.selectedProjects.length >= 2);
});

test('Feishu text renderer includes required radar fields', () => {
  const profile = loadRadarProfile();
  const store = createTempStore();
  const now = new Date('2026-05-24T01:00:00.000Z');
  const repo = createSampleRepositories(now)[0];
  store.addSnapshots(createSnapshots([withStars(repo, repo.stars - 90)], new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()));
  store.addSnapshots(createSnapshots([repo], now.toISOString()));
  const scored = createPotentialScoreRanker().score([repo], profile, store, now.toISOString());
  const digest = buildDailyRadarDigest(scored, profile, '2026-05-24', 10, false);
  const text = renderRadarDigestText(digest);

  assert.match(text, /AI Developer Radar｜Daily｜2026-05-24/);
  assert.match(text, /Why it matters/);
  assert.match(text, /Developer insight/);
  assert.match(text, /Risk:/);
});
