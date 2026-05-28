import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildLatestDailyDashboardData } from '../src/dashboard/build-dashboard-data.js';
import { generateRadarLlmDigest } from '../src/llm/radar-digest-generator.js';
import { createPotentialScoreRanker } from '../src/rankers/potential-score.js';
import { loadRadarProfile } from '../src/radar/config.js';
import { createSampleRepositories } from '../src/radar/sample-data.js';
import { buildDailyRadarDigest } from '../src/renderers/daily-digest.js';
import { JsonRadarStore, createSnapshots } from '../src/storage/json-store.js';

function createDashboardFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-llm-digest-store-'));
  const store = new JsonRadarStore(path.join(dir, 'store.json'));
  const profile = loadRadarProfile();
  const now = new Date('2026-05-28T01:00:00.000Z');
  const [repo] = createSampleRepositories(now);
  store.addSnapshots(createSnapshots([{ ...repo, stars: repo.stars - 80 }], new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()));
  store.addSnapshots(createSnapshots([repo], now.toISOString()));
  const scored = createPotentialScoreRanker().score([repo], profile, store, now.toISOString());
  const digest = {
    ...buildDailyRadarDigest(scored, profile, '2026-05-28', 10, false, store),
    multiSourceSections: {
      productLaunches: [{
        id: 'product-hunt:test',
        source: 'product-hunt',
        sourceType: 'product_launch' as const,
        title: 'Test Product',
        url: 'https://example.com/product',
        summary: 'A test product launch.',
        collectedAt: now.toISOString()
      }],
      modelDemoSignals: [],
      developerBuzz: [],
      aihotHighlights: [{
        id: 'aihot:test',
        source: 'aihot',
        sourceType: 'curated_trend' as const,
        title: 'AIHot Test',
        url: 'https://example.com/news',
        summary: 'A test trend item.',
        collectedAt: now.toISOString()
      }],
      crossSourceHighlights: []
    }
  };
  return buildLatestDailyDashboardData({
    digest,
    scored,
    store,
    targetDate: '2026-05-28',
    generatedAt: now.toISOString(),
    timezone: 'Asia/Shanghai',
    digestId: 'daily-2026-05-28',
    source: { repo: 'Tsin418/ai-trend-radar', branch: 'main', workflow: 'radar-daily' }
  });
}

test('LLM digest uses fallback when disabled', async () => {
  const dashboard = createDashboardFixture();
  const llmDigest = await generateRadarLlmDigest(dashboard, {
    enabled: false,
    apiKey: undefined,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    language: 'zh-CN',
    timeoutMs: 30000,
    maxInputItems: 80,
    temperature: 0.2,
    maxOutputTokens: 2200
  });

  assert.equal(llmDigest.status, 'fallback');
  assert.ok(llmDigest.todayPulse);
});

test('LLM digest uses fallback when api key is missing', async () => {
  const dashboard = createDashboardFixture();
  const llmDigest = await generateRadarLlmDigest(dashboard, {
    enabled: true,
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    language: 'zh-CN',
    timeoutMs: 30000,
    maxInputItems: 80,
    temperature: 0.2,
    maxOutputTokens: 2200
  });

  assert.equal(llmDigest.status, 'fallback');
  assert.ok(llmDigest.warnings?.some((item) => item.includes('API key missing')));
});

test('LLM digest falls back when model returns invalid json even after repair', async () => {
  const dashboard = createDashboardFixture();
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount += 1;
    return new Response(JSON.stringify({
      choices: [{ message: { content: callCount === 1 ? '```json\nnot valid\n```' : 'still not valid' } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const llmDigest = await generateRadarLlmDigest(dashboard, {
      enabled: true,
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
      language: 'zh-CN',
      timeoutMs: 30000,
      maxInputItems: 80,
      temperature: 0.2,
      maxOutputTokens: 2200
    });
    assert.equal(callCount, 2);
    assert.equal(llmDigest.status, 'fallback');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('LLM digest writes success payload when model returns valid json', async () => {
  const dashboard = createDashboardFixture();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    const payload = {
      todayPulse: {
        title: '今日 AI 脉搏',
        date: '2026-05-28',
        executiveSummary: '今天信号集中在开发者工具和产品化探索，跨来源重复出现说明该方向值得继续关注，但短期结论仍需观察持续性。',
        topChanges: [{
          title: dashboard.projects[0].repoFullName,
          summary: '该项目在开发者社区持续升温。',
          perspective: 'developer',
          whyItMatters: '说明开发者对该类工具需求在增加。',
          suggestedAction: '值得了解',
          confidence: 'high',
          sourceRefs: [dashboard.projects[0].repoFullName]
        }],
        developerView: {
          headline: '开发者关注集中',
          summary: '优先关注最热仓库的实际可用性。',
          keyItems: [dashboard.projects[0].repoFullName],
          suggestedAction: '值得了解',
          sourceRefs: [dashboard.projects[0].repoFullName]
        },
        productView: {
          headline: '产品侧出现新尝试',
          summary: '产品信号可作为技术趋势验证。',
          keyItems: ['Test Product'],
          suggestedAction: '持续观察',
          sourceRefs: ['product-hunt:test']
        },
        informationView: {
          headline: '资讯侧补充判断',
          summary: '资讯可帮助排除短期噪音。',
          keyItems: ['AIHot Test'],
          suggestedAction: '值得了解',
          sourceRefs: ['aihot:test']
        },
        noiseWarning: '部分信号仍是短周期变化。',
        suggestedReadingOrder: ['developerView', 'productView', 'informationView']
      },
      trendClusters: [{
        name: 'AI Developer Tooling',
        oneLiner: '开发者工具在多个来源同步升温。',
        whyNow: '跨来源重复出现，说明该主题不只是单点热度。',
        audience: ['developer', 'general'],
        judgment: '升温中',
        confidence: 'high',
        relatedSources: ['product-hunt', 'aihot'],
        relatedItems: [{
          title: 'Test Product',
          source: 'product-hunt',
          url: 'https://example.com/product',
          itemType: 'product'
        }]
      }],
      warnings: []
    };

    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const llmDigest = await generateRadarLlmDigest(dashboard, {
      enabled: true,
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
      language: 'zh-CN',
      timeoutMs: 30000,
      maxInputItems: 80,
      temperature: 0.2,
      maxOutputTokens: 2200
    });
    assert.equal(llmDigest.status, 'success');
    assert.equal(llmDigest.todayPulse?.title, '今日 AI 脉搏');
    assert.equal(llmDigest.trendClusters?.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
