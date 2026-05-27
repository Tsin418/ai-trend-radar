import assert from 'node:assert/strict';
import test from 'node:test';
import { productHuntTrendingItemToTrendItem } from '../src/trends/adapters.js';
import { buildTopicClusters, buildTrendEntities, mergeTrendItems, normalizeTrendUrl } from '../src/trends/dedupe.js';
import type { TrendItem } from '../src/trends/types.js';

test('normalizes common tracking URLs for dedupe', () => {
  assert.equal(
    normalizeTrendUrl('http://www.github.com/OpenAI/Codex/tree/main?utm_source=hn#readme'),
    'https://github.com/openai/codex'
  );
  assert.equal(
    normalizeTrendUrl('https://www.producthunt.com/posts/agentkit?ref=homepage'),
    'https://producthunt.com/posts/agentkit'
  );
});

test('merges cross-source trend items by canonical URL', () => {
  const collectedAt = '2026-05-27T00:00:00.000Z';
  const items: TrendItem[] = [
    {
      id: 'github:openai/codex',
      source: 'github',
      sourceType: 'opensource',
      title: 'openai/codex',
      url: 'https://github.com/openai/codex',
      collectedAt
    },
    {
      id: 'hn:1',
      source: 'hackernews',
      sourceType: 'developer_discussion',
      title: 'OpenAI Codex',
      url: 'https://github.com/openai/codex?utm_source=news',
      collectedAt
    }
  ];

  const merged = mergeTrendItems(items);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].sources.sort(), ['github', 'hackernews']);
  assert.equal(merged[0].sourceCount, 2);
  assert.equal(merged[0].entityType, 'repo');
  assert.equal(merged[0].metrics.crossSourceBonus, 10);
});

test('normalizes Hugging Face model and space URLs', () => {
  assert.equal(
    normalizeTrendUrl('https://huggingface.co/openai/gpt-oss?utm_campaign=test'),
    'https://huggingface.co/openai/gpt-oss'
  );
  assert.equal(
    normalizeTrendUrl('https://huggingface.co/spaces/Org/Demo/tree/main?source=feed'),
    'https://huggingface.co/spaces/org/demo'
  );
});

test('builds topic clusters from related trend items', () => {
  const collectedAt = '2026-05-27T00:00:00.000Z';
  const items: TrendItem[] = [
    {
      id: 'ph:1',
      source: 'product_hunt',
      sourceType: 'product_launch',
      title: 'Browser agent for QA automation',
      url: 'https://producthunt.com/posts/browser-agent',
      collectedAt
    },
    {
      id: 'hn:2',
      source: 'hackernews',
      sourceType: 'developer_discussion',
      title: 'Show HN: web agent with computer use',
      url: 'https://news.ycombinator.com/item?id=2',
      collectedAt
    }
  ];

  const clusters = buildTopicClusters(items);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].entityType, 'topic');
  assert.equal(clusters[0].items.length, 2);
});

test('builds heat-scored trend entities', () => {
  const collectedAt = '2026-05-27T00:00:00.000Z';
  const entities = buildTrendEntities([
    {
      id: 'github:openai/codex',
      source: 'github',
      sourceType: 'opensource',
      title: 'openai/codex',
      url: 'https://github.com/openai/codex',
      metrics: { stars: 1000, starDelta24h: 100 },
      collectedAt
    },
    {
      id: 'hn:1',
      source: 'hackernews',
      sourceType: 'developer_discussion',
      title: 'OpenAI Codex',
      url: 'https://github.com/openai/codex?gclid=tracking',
      metrics: { upvotes: 50, commentsCount: 12 },
      collectedAt
    }
  ]);

  assert.equal(entities[0].sourceCount, 2);
  assert.equal(entities[0].metrics.starDelta24h, 100);
  assert.equal(entities[0].metrics.heatScore > 0, true);
});

test('maps Product Hunt trending items into TrendItem shape', () => {
  const item = productHuntTrendingItemToTrendItem({
    rank: 1,
    id: 'producthunt:123',
    title: 'AgentKit',
    description: 'AI agents for developer workflows',
    url: 'https://www.producthunt.com/posts/agentkit',
    primaryTag: 'Developer Tools',
    tags: ['Developer Tools', 'Artificial Intelligence'],
    heatScore: 180,
    totalScore: 120,
    metadata: {
      votesCount: 120,
      commentsCount: 20,
      dailyRank: 3,
      featuredAt: '2026-05-27T00:00:00Z'
    }
  });

  assert.equal(item.source, 'product_hunt');
  assert.equal(item.sourceType, 'product_launch');
  assert.equal(item.metrics?.upvotes, 120);
  assert.equal(item.metrics?.commentsCount, 20);
  assert.equal(item.metrics?.rank, 3);
});
