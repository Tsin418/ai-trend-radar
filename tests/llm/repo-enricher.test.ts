import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { LLMEnrichmentConfig } from '../../src/radar/config.js';
import type { RepoLLMSummary, ScoredRadarRepository } from '../../src/radar/types.js';
import { loadRadarProfile } from '../../src/radar/config.js';
import { createSampleRepositories } from '../../src/radar/sample-data.js';
import { createPotentialScoreRanker } from '../../src/rankers/potential-score.js';
import { JsonRadarStore, createSnapshots } from '../../src/storage/json-store.js';
import { enrichReposWithLLM } from '../../src/llm/repo-enricher.js';

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
    cachePath
  };
}

function sampleSummary(overrides: Partial<RepoLLMSummary> = {}): RepoLLMSummary {
  return {
    oneLiner: 'A coding agent for repository tasks.',
    problemSolved: 'It helps developers automate repo work.',
    aiCategory: 'Coding',
    whyTrending: 'Recent star growth and active positioning make it worth checking.',
    developerTakeaway: 'Study its task planning and tool integration flow.',
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
    callJson: async () => sampleSummary({ confidence: 'high' })
  });

  assert.equal(result.repos[0].llmSummary?.confidence, 'low');
  assert.match(result.repos[0].llmSummary?.riskNotes ?? '', /README unavailable/);
});

test('repo enricher falls back when DeepSeek fails', async () => {
  const repo = scoredRepo();
  const result = await enrichReposWithLLM([repo], baseOptions(), {
    fetchReadme: async () => ({ content: '# README\nUseful project.' }),
    callJson: async () => {
      throw new Error('timeout');
    }
  });

  assert.equal(result.repos[0].llmSummary, undefined);
  assert.match(result.warnings[0], /LLM enrichment failed/);
});
