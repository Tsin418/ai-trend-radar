import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { LLMEnrichmentConfig } from '../../src/radar/config.js';
import type { RadarDigest, RadarRepository, RepoLLMSummary, ScoredRadarRepository } from '../../src/radar/types.js';
import { loadRadarProfile } from '../../src/radar/config.js';
import { createSampleRepositories } from '../../src/radar/sample-data.js';
import { createPotentialScoreRanker } from '../../src/rankers/potential-score.js';
import { JsonRadarStore, createSnapshots } from '../../src/storage/json-store.js';
import { enrichRadarDigestWithLLM, enrichReposWithLLM } from '../../src/llm/repo-enricher.js';
import type { TrendItem } from '../../src/trends/types.js';

function tempCachePath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cache-')), 'cache.json');
}

function baseOptions(cachePath = tempCachePath()): LLMEnrichmentConfig {
  return {
    enabled: true,
    apiKey: 'test-key',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-test',
    limit: 10,
    readmeMaxChars: 500,
    timeoutMs: 1000,
    maxRetries: 0,
    maxOutputTokens: 1200,
    cachePath
  };
}

function sampleSummary(overrides: Partial<RepoLLMSummary> = {}): RepoLLMSummary {
  return {
    oneLiner: 'A coding agent for repository tasks.',
    problemSolved: 'It helps developers automate repo work.',
    aiCategory: 'Coding',
    trendType: 'sudden_breakout',
    whyNow: 'It jumped from a 20-star baseline to 80 stars today, a 4x acceleration.',
    whatChanged: 'The exact trigger is unclear from the available metadata.',
    whyTrending: 'Recent star growth and active positioning make it worth checking.',
    developerTakeaway: 'Study its task planning and tool integration flow.',
    developerInsight: 'Coding agents are shifting toward repo-native workflows.',
    targetUsers: 'AI developers and product builders.',
    riskNotes: 'Validate README claims before adoption.',
    confidence: 'medium',
    ...overrides
  };
}

function scoredRepo(): ScoredRadarRepository {
  const now = new Date('2026-05-24T01:00:00.000Z');
  const repo = createSampleRepositories(now)[0];
  const store = new JsonRadarStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'radar-store-')), 'store.json'));
  store.addSnapshots(createSnapshots([repo], now.toISOString()));
  return createPotentialScoreRanker().score([repo], loadRadarProfile(), store, now.toISOString())[0];
}

function withRepository(item: ScoredRadarRepository, overrides: Partial<RadarRepository>): ScoredRadarRepository {
  const repository = {
    ...item.repository,
    ...overrides
  };
  return {
    ...item,
    repository,
    score: {
      ...item.score,
      repoFullName: repository.repoFullName
    }
  };
}

function trendItem(overrides: Partial<TrendItem>): TrendItem {
  return {
    id: overrides.id ?? 'hn-1',
    source: overrides.source ?? 'hackernews',
    sourceType: overrides.sourceType ?? 'developer_discussion',
    title: overrides.title ?? 'Discussion',
    url: overrides.url ?? 'https://news.ycombinator.com/item?id=1',
    collectedAt: overrides.collectedAt ?? '2026-05-24T01:00:00.000Z',
    ...overrides
  };
}

function digestWithRepos(repos: ScoredRadarRepository[], multiSourceItems: TrendItem[]): RadarDigest {
  return {
    mode: 'daily',
    title: 'Test digest',
    date: '2026-05-24',
    generatedAt: '2026-05-24T02:00:00.000Z',
    summary: 'Test digest',
    baselineCreated: false,
    dataNotes: [],
    hotProjects: [],
    acceleratingProjects: [],
    earlySignals: [],
    watchlistMovements: [],
    selectedProjects: repos,
    multiSourceItems
  };
}

test('repo enricher adds LLM summary and writes cache', async () => {
  const repo = scoredRepo();
  const cachePath = tempCachePath();
  let calls = 0;

  const result = await enrichReposWithLLM([repo], baseOptions(cachePath), {
    fetchReadme: async () => ({ content: '# README\nUseful project.' }),
    callJson: async () => {
      calls += 1;
      return sampleSummary();
    },
    fetchLatestReleaseDate: async () => null,
    now: () => '2026-05-24T02:00:00.000Z'
  });

  assert.equal(calls, 1);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.repos[0].llmSummary?.oneLiner, 'A coding agent for repository tasks.');
  assert.ok(fs.existsSync(cachePath));
});

test('repo enricher uses cache hit without calling DeepSeek', async () => {
  const repo = scoredRepo();
  const cachePath = tempCachePath();

  await enrichReposWithLLM([repo], baseOptions(cachePath), {
    fetchReadme: async () => ({ content: '# README\nUseful project.' }),
    fetchLatestReleaseDate: async () => null,
    callJson: async () => sampleSummary()
  });

  const result = await enrichReposWithLLM([repo], baseOptions(cachePath), {
    fetchReadme: async () => {
      throw new Error('should not fetch README on cache hit');
    },
    callJson: async () => {
      throw new Error('should not call DeepSeek on cache hit');
    }
  });

  assert.equal(result.repos[0].llmSummary?.problemSolved, 'It helps developers automate repo work.');
});

test('repo enricher skips when API key is missing', async () => {
  const repo = scoredRepo();
  const result = await enrichReposWithLLM([repo], {
    ...baseOptions(),
    apiKey: undefined
  }, {
    callJson: async () => {
      throw new Error('should not call DeepSeek without key');
    }
  });

  assert.equal(result.repos[0].llmSummary, undefined);
  assert.match(result.warnings[0], /missing DEEPSEEK_API_KEY/);
});

test('repo enricher downgrades confidence when README is unavailable', async () => {
  const repo = scoredRepo();
  const result = await enrichReposWithLLM([repo], baseOptions(), {
    fetchReadme: async () => {
      throw new Error('not found');
    },
    fetchLatestReleaseDate: async () => null,
    callJson: async () => sampleSummary({ confidence: 'high' })
  });

  assert.equal(result.repos[0].llmSummary?.confidence, 'low');
  assert.match(result.repos[0].llmSummary?.riskNotes ?? '', /README unavailable/);
});

test('repo enricher falls back when DeepSeek fails', async () => {
  const repo = scoredRepo();
  const result = await enrichReposWithLLM([repo], baseOptions(), {
    fetchReadme: async () => ({ content: '# README\nUseful project.' }),
    fetchLatestReleaseDate: async () => null,
    callJson: async () => {
      throw new Error('timeout');
    }
  });

  assert.equal(result.repos[0].llmSummary, undefined);
  assert.match(result.warnings[0], /LLM enrichment failed/);
});

test('repo enricher includes recent release signal in the LLM prompt', async () => {
  const repo = scoredRepo();
  let capturedPrompt = '';

  await enrichReposWithLLM([repo], baseOptions(), {
    fetchReadme: async () => ({ content: '# README\nUseful project.' }),
    fetchLatestReleaseDate: async () => '2026-05-10T00:00:00.000Z',
    callJson: async ({ userPrompt }) => {
      capturedPrompt = userPrompt;
      return sampleSummary();
    },
    now: () => '2026-05-24T02:00:00.000Z'
  });

  assert.match(capturedPrompt, /hasRecentRelease: yes \(within 30 days\)/);
});

test('repo enricher filters noisy Hacker News buzz matches', async () => {
  const base = scoredRepo();
  const apiRepo = withRepository(base, {
    repoFullName: 'example/api',
    repoUrl: 'https://github.com/example/api',
    owner: 'example',
    name: 'api',
    description: 'Short-name API project'
  });
  const reactRepo = withRepository(base, {
    repoFullName: 'example/react',
    repoUrl: 'https://github.com/example/react',
    owner: 'example',
    name: 'react',
    description: 'React project'
  });
  const prompts = new Map<string, string>();

  await enrichRadarDigestWithLLM(digestWithRepos([apiRepo, reactRepo], [
    trendItem({
      id: 'api-noise',
      title: 'API patterns for agent tools',
      metrics: { upvotes: 200 }
    }),
    trendItem({
      id: 'react-noise',
      title: 'Reactive systems for agent tools',
      metrics: { upvotes: 150 }
    }),
    trendItem({
      id: 'react-match',
      title: 'React for agent dashboards',
      metrics: { upvotes: 100 }
    })
  ]), baseOptions(), {
    fetchReadme: async () => ({ content: '# README\nUseful project.' }),
    fetchLatestReleaseDate: async () => null,
    callJson: async ({ userPrompt }) => {
      const fullName = userPrompt.match(/- fullName: ([^\n]+)/)?.[1];
      if (fullName) prompts.set(fullName, userPrompt);
      return sampleSummary();
    },
    now: () => '2026-05-24T02:00:00.000Z'
  });

  assert.match(prompts.get('example/api') ?? '', /externalBuzz:\nn\/a/);
  assert.doesNotMatch(prompts.get('example/react') ?? '', /Reactive systems/);
  assert.match(prompts.get('example/react') ?? '', /top="React for agent dashboards"/);
});
