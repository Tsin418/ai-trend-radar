import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIntelligenceHeadline } from '../src/intelligence/headline-builder.js';
import { buildTopicBriefs, toEvidenceItem } from '../src/intelligence/topic-brief-builder.js';
import type { TrendEntity, TrendItem } from '../src/trends/types.js';

const collectedAt = '2026-05-27T00:00:00.000Z';

function item(overrides: Partial<TrendItem>): TrendItem {
  return {
    id: 'item:default',
    title: 'Default item',
    source: 'github',
    sourceType: 'opensource',
    url: 'https://example.com/default',
    collectedAt,
    ...overrides
  };
}

function topic(overrides: Partial<TrendEntity>): TrendEntity {
  const items = overrides.items ?? [
    item({
      id: 'github:agent/repo',
      title: 'agent/repo',
      metrics: { stars: 1000, starDelta24h: 25 }
    }),
    item({
      id: 'hn:agent',
      title: 'Show HN: coding agent',
      source: 'hackernews',
      sourceType: 'developer_discussion',
      url: 'https://news.ycombinator.com/item?id=1',
      metrics: { upvotes: 100, commentsCount: 25 }
    })
  ];

  return {
    id: 'topic:coding-agent',
    canonicalId: 'topic:coding-agent',
    title: 'Coding Agent / SWE Agent',
    canonicalUrl: 'https://example.com/topic',
    entityType: 'topic',
    normalizedKeys: ['topic:coding-agent'],
    sources: Array.from(new Set(items.map((entry) => entry.source))),
    sourceCount: Array.from(new Set(items.map((entry) => entry.source))).length,
    items,
    sourceItems: items,
    metrics: {
      stars: 1000,
      starDelta24h: 25,
      votes: 100,
      commentsCount: 25,
      crossSourceBonus: 10,
      heatScore: 120
    },
    crossSourceBonus: 10,
    firstSeenAt: collectedAt,
    lastSeenAt: collectedAt,
    ...overrides
  };
}

test('builds empty headline for empty topic input', () => {
  const topicBriefs = buildTopicBriefs([]);
  const headline = buildIntelligenceHeadline(topicBriefs);

  assert.equal(topicBriefs.length, 0);
  assert.equal(headline.headline, 'No strong multi-source AI trend signal was detected today.');
  assert.deepEqual(headline.keyTakeaways, []);
});

test('builds topic brief from LLM summary', () => {
  const [brief] = buildTopicBriefs([
    topic({
      llmSummary: {
        whatItIs: 'Tools that automate software engineering tasks.',
        whyNow: 'Multiple signals point to attention around repo-aware automation.',
        whoShouldCare: 'Developer-tool builders.',
        technicalKeywords: ['coding agent', 'repo context'],
        businessRelevance: 'May shape developer productivity products.',
        developerRelevance: 'Inspect how tools manage repository context and review.',
        watchDecision: 'deep_dive',
        riskNotes: 'Attention does not prove adoption.',
        confidence: 'medium'
      }
    })
  ]);

  assert.equal(brief.whatItIs, 'Tools that automate software engineering tasks.');
  assert.equal(brief.watchDecision, 'deep_dive');
  assert.equal(brief.confidence, 'medium');
  assert.equal(brief.evidenceItems.length, 2);
  assert.deepEqual(brief.technicalKeywords, ['coding agent', 'repo context']);
});

test('builds fallback topic brief without causal wording', () => {
  const [brief] = buildTopicBriefs([topic({ llmSummary: undefined })]);

  assert.equal(Boolean(brief.whyNow), true);
  assert.equal(brief.confidence, 'medium');
  assert.equal(brief.whyNow.includes('caused'), false);
  assert.equal(brief.riskNotes.includes('Evidence'), true);
});

test('normalizes evidence items and preserves metrics', () => {
  const source = item({
    id: 'aihot:1',
    title: 'Agent workflows are changing',
    source: 'aihot',
    sourceType: 'curated_trend',
    url: 'https://www.aibase.com/news/1',
    description: 'Curated AI news summary',
    category: 'Agent',
    tags: ['agent'],
    metrics: { rank: 2 }
  });

  const evidence = toEvidenceItem(source);

  assert.equal(evidence.id, 'aihot:1');
  assert.equal(evidence.title, 'Agent workflows are changing');
  assert.equal(evidence.url, 'https://www.aibase.com/news/1');
  assert.equal(evidence.summary, 'Curated AI news summary');
  assert.deepEqual(evidence.metrics, { rank: 2 });
});

test('sorts topic briefs by heat score then source count', () => {
  const low = topic({
    id: 'topic:low',
    title: 'Low Topic',
    metrics: { crossSourceBonus: 20, heatScore: 80 },
    crossSourceBonus: 20
  });
  const high = topic({
    id: 'topic:high',
    title: 'High Topic',
    metrics: { crossSourceBonus: 10, heatScore: 120 },
    crossSourceBonus: 10
  });
  const tieMoreSources = topic({
    id: 'topic:tie-more-sources',
    title: 'Tie More Sources',
    sourceCount: 3,
    sources: ['github', 'hackernews', 'aihot'],
    metrics: { crossSourceBonus: 20, heatScore: 120 },
    crossSourceBonus: 20
  });

  const briefs = buildTopicBriefs([low, high, tieMoreSources]);

  assert.equal(briefs[0].id, 'topic:tie-more-sources');
  assert.equal(briefs[1].id, 'topic:high');
  assert.equal(briefs[2].id, 'topic:low');
});
