import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classifyAiCategory } from '../src/rankers/ai-category.js';
import { createPotentialScoreRanker } from '../src/rankers/potential-score.js';
import { buildLatestDailyDashboardData } from '../src/dashboard/build-dashboard-data.js';
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

test('daily digest exposes high-confidence accelerating projects', () => {
  const profile = loadRadarProfile();
  const store = createTempStore();
  const now = new Date('2026-05-24T01:00:00.000Z');
  const repo = createSampleRepositories(now)[0];
  const dayMs = 24 * 60 * 60 * 1000;

  store.addSnapshots(createSnapshots([withStars(repo, repo.stars - 70)], new Date(now.getTime() - 4 * dayMs).toISOString()));
  store.addSnapshots(createSnapshots([withStars(repo, repo.stars - 60)], new Date(now.getTime() - 3 * dayMs).toISOString()));
  store.addSnapshots(createSnapshots([withStars(repo, repo.stars - 50)], new Date(now.getTime() - 2 * dayMs).toISOString()));
  store.addSnapshots(createSnapshots([withStars(repo, repo.stars - 40)], new Date(now.getTime() - dayMs).toISOString()));
  store.addSnapshots(createSnapshots([repo], now.toISOString()));

  const scored = createPotentialScoreRanker().score([repo], profile, store, now.toISOString());
  const digest = buildDailyRadarDigest(scored, profile, '2026-05-24', 10, false);

  assert.equal(scored[0].score.acceleration, 4);
  assert.equal(scored[0].score.accelerationConfidence, 'high');
  assert.equal(scored[0].score.trendType, 'sudden_breakout');
  assert.equal(digest.acceleratingProjects[0].repository.repoFullName, repo.repoFullName);
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
  assert.match(text, /Why worth watching/);
  assert.match(text, /Developer takeaway/);
  assert.match(text, /Trend:/);
  assert.match(text, /GitHub: https:\/\/github\.com\//);
  assert.doesNotMatch(text, /LLM summary unavailable/);
});

test('daily dashboard exposes homepage sections and growth links', () => {
  const profile = loadRadarProfile();
  const store = createTempStore();
  const now = new Date('2026-05-24T01:00:00.000Z');
  const repo = createSampleRepositories(now)[0];
  store.addSnapshots(createSnapshots([withStars(repo, repo.stars - 90)], new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()));
  store.addSnapshots(createSnapshots([repo], now.toISOString()));
  const scored = createPotentialScoreRanker().score([repo], profile, store, now.toISOString());
  const digest = {
    ...buildDailyRadarDigest(scored, profile, '2026-05-24', 10, false),
    multiSourceSections: {
      productLaunches: [
        {
          id: 'product-hunt:test',
          source: 'product-hunt',
          sourceType: 'product_launch' as const,
          title: 'AI Launch',
          url: 'https://example.com/product',
          summary: 'A useful AI product launch.',
          metrics: { upvotes: 100 },
          collectedAt: now.toISOString()
        }
      ],
      modelDemoSignals: [],
      developerBuzz: [
        {
          id: 'hackernews:test',
          source: 'hackernews',
          sourceType: 'developer_discussion' as const,
          title: 'OpenAI releases a new coding agent',
          url: 'https://news.ycombinator.com/item?id=1',
          tags: ['OpenAI', 'coding agent'],
          collectedAt: now.toISOString()
        }
      ],
      aihotHighlights: [
        {
          id: 'aihot:test',
          source: 'aihot',
          sourceType: 'curated_trend' as const,
          title: 'AIHot trend update',
          url: 'https://example.com/news',
          summary: 'A useful AI trend update.',
          category: 'industry',
          collectedAt: now.toISOString()
        }
      ],
      crossSourceHighlights: []
    }
  };

  const dashboard = buildLatestDailyDashboardData({
    digest,
    scored,
    store,
    targetDate: '2026-05-24',
    generatedAt: now.toISOString(),
    timezone: 'Asia/Shanghai',
    digestId: 'daily-2026-05-24',
    source: {
      repo: 'Tsin418/ai-trend-radar',
      branch: 'main',
      workflow: 'radar-daily'
    }
  });

  assert.match(dashboard.lastUpdatedLabel, /Last updated: 2026-05-24/);
  assert.equal(dashboard.growthLinks.githubRepoUrl, 'https://github.com/Tsin418/ai-trend-radar');
  assert.equal(dashboard.growthLinks.githubProfileUrl, 'https://github.com/Tsin418');
  assert.ok(dashboard.homepageSections.openSourceRadar.items.length > 0);
  assert.equal(dashboard.homepageSections.openSourceRadar.items[0].sourceType, 'opensource');
  assert.equal(dashboard.homepageSections.aiProductRadar.items[0].sourceType, 'product_launch');
  assert.ok(dashboard.homepageSections.aiNewsRadar.items.some((item) => item.source === 'hackernews'));
  assert.ok(dashboard.homepageSections.selfHostPush.items.some((item) => item.sourceType === 'self_host'));
});
