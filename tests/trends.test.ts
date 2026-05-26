import assert from 'node:assert/strict';
import test from 'node:test';
import { productHuntTrendingItemToTrendItem } from '../src/trends/adapters.js';
import { mergeTrendItems, normalizeTrendUrl } from '../src/trends/dedupe.js';
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
