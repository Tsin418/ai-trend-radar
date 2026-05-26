import assert from 'node:assert/strict';
import test from 'node:test';
import { ProductHuntClient } from '../src/collectors/producthunt-client.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
}

test('Product Hunt client sends Authorization header and parses posts', async () => {
  let authHeader: string | null = null;
  let bodyText = '';
  const fetchImpl: typeof fetch = async (_url, init) => {
    authHeader = new Headers(init?.headers).get('Authorization');
    bodyText = String(init?.body ?? '');
    return jsonResponse({
      data: {
        posts: {
          edges: [
            {
              node: {
                id: 'post-1',
                name: 'AgentKit',
                slug: 'agentkit',
                tagline: 'AI agents',
                url: 'https://www.producthunt.com/posts/agentkit',
                votesCount: 10,
                commentsCount: 2,
                createdAt: '2026-05-26T00:00:00Z'
              }
            }
          ]
        }
      }
    });
  };
  const client = new ProductHuntClient({ token: 'ph-token', fetchImpl, maxRetries: 0 });

  const posts = await client.fetchPosts({ first: 10, order: 'VOTES' });

  assert.equal(authHeader, 'Bearer ph-token');
  assert.match(bodyText, /ProductHuntPosts/);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].id, 'post-1');
});

test('Product Hunt client throws a clear error for missing token', async () => {
  const client = new ProductHuntClient({
    token: '',
    fetchImpl: async () => jsonResponse({ data: { posts: { edges: [] } } }),
    maxRetries: 0
  });

  await assert.rejects(
    () => client.fetchPosts({ first: 10 }),
    /Product Hunt token is missing/
  );
});

test('Product Hunt client surfaces GraphQL errors', async () => {
  const client = new ProductHuntClient({
    token: 'ph-token',
    fetchImpl: async () => jsonResponse({ errors: [{ message: 'Cannot query field website' }] }),
    maxRetries: 0
  });

  await assert.rejects(
    () => client.fetchPosts({ first: 10 }),
    /Product Hunt GraphQL error: Cannot query field website/
  );
});

test('Product Hunt client surfaces non-OK HTTP responses', async () => {
  const client = new ProductHuntClient({
    token: 'ph-token',
    fetchImpl: async () => jsonResponse({ message: 'unauthorized' }, { status: 401 }),
    maxRetries: 0
  });

  await assert.rejects(
    () => client.fetchPosts({ first: 10 }),
    /HTTP 401/
  );
});

test('Product Hunt client surfaces non-JSON responses', async () => {
  const client = new ProductHuntClient({
    token: 'ph-token',
    fetchImpl: async () => new Response('not json', { status: 200 }),
    maxRetries: 0
  });

  await assert.rejects(
    () => client.fetchPosts({ first: 10 }),
    /non-JSON/
  );
});
