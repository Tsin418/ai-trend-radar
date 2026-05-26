import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateProductHuntHeatScore,
  calculateProductHuntRelevance,
  isRelevantProductHuntPost,
  mapProductHuntPostToTrendingItem
} from '../src/collectors/producthunt-mapper.js';
import type { ProductHuntPost } from '../src/collectors/producthunt-types.js';

function createPost(overrides: Partial<ProductHuntPost> = {}): ProductHuntPost {
  return {
    id: '123',
    name: 'AgentKit',
    slug: 'agentkit',
    tagline: 'Build AI coding agents for developer workflows',
    description: 'An SDK for automating pull request reviews with LLMs.',
    url: 'https://www.producthunt.com/posts/agentkit',
    website: 'https://agentkit.dev',
    votesCount: 42,
    commentsCount: 6,
    reviewsCount: 3,
    reviewsRating: 4.8,
    dailyRank: 5,
    weeklyRank: null,
    monthlyRank: null,
    createdAt: '2026-05-26T00:00:00Z',
    featuredAt: '2026-05-26T02:00:00Z',
    topics: {
      edges: [
        { node: { name: 'Artificial Intelligence', slug: 'artificial-intelligence' } },
        { node: { name: 'Developer Tools', slug: 'developer-tools' } }
      ]
    },
    makers: [{ name: 'Ada', username: 'ada', url: 'https://www.producthunt.com/@ada' }],
    thumbnail: { url: 'https://example.com/thumb.png' },
    productLinks: [{ type: 'GitHub', url: 'https://github.com/example/agentkit' }],
    ...overrides
  };
}

test('maps Product Hunt post into TrendingItem shape', () => {
  const item = mapProductHuntPostToTrendingItem(createPost(), 2);

  assert.equal(item.rank, 2);
  assert.equal(item.id, 'producthunt:123');
  assert.equal(item.title, 'AgentKit');
  assert.equal(item.description, 'Build AI coding agents for developer workflows - An SDK for automating pull request reviews with LLMs.');
  assert.equal(item.url, 'https://www.producthunt.com/posts/agentkit');
  assert.equal(item.primaryTag, 'Artificial Intelligence');
  assert.deepEqual(item.tags, ['Artificial Intelligence', 'Developer Tools']);
  assert.equal(item.heatScore, 60);
  assert.equal(item.totalScore, 42);
  assert.equal(item.metadata.source, 'producthunt');
  assert.equal(item.metadata.website, 'https://agentkit.dev');
  assert.equal(item.metadata.votesCount, 42);
  assert.equal(item.metadata.commentsCount, 6);
  assert.equal(item.metadata.thumbnailUrl, 'https://example.com/thumb.png');
});

test('calculates Product Hunt heat score from votes and comments', () => {
  assert.equal(calculateProductHuntHeatScore(createPost({ votesCount: 10, commentsCount: 4 })), 22);
});

test('AI and developer-tool posts pass relevance filter', () => {
  assert.equal(isRelevantProductHuntPost(createPost()), true);
  assert.ok(calculateProductHuntRelevance(createPost()) >= 20);
});

test('irrelevant consumer product fails relevance filter', () => {
  const post = createPost({
    name: 'Lunch Buddy',
    tagline: 'Find nearby restaurants with friends',
    description: 'A simple social planning app for casual meals.',
    website: 'https://lunchbuddy.example',
    topics: {
      edges: [{ node: { name: 'Food & Drink', slug: 'food-drink' } }]
    },
    productLinks: []
  });

  assert.equal(isRelevantProductHuntPost(post), false);
});

test('minimum votes and comments filters are applied', () => {
  const post = createPost({ votesCount: 9, commentsCount: 1 });

  assert.equal(isRelevantProductHuntPost(post, { minVotes: 10 }), false);
  assert.equal(isRelevantProductHuntPost(post, { minVotes: 5, minComments: 2 }), false);
  assert.equal(isRelevantProductHuntPost(post, { minVotes: 5, minComments: 1 }), true);
});
