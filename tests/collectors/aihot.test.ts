import assert from 'node:assert/strict';
import test from 'node:test';
import { AIHotCollector, extractAIHotItemsFromApiResponse, extractAIHotItemsFromHtml, inferAIHotCategory, isNavigationTitle } from '../../src/collectors/aihot.js';

const MOCK_HTML = `
  <main>
    <nav>
      <a href="/">首页</a>
      <a href="/about">About</a>
    </nav>
    <article class="news-card">
      <a href="https://example.com/model-release?utm_source=aihot">New multimodal LLM model release</a>
      <p>Open weights model adds realtime vision language capabilities.</p>
      <span class="source">Example AI</span>
      <time datetime="2026-05-26T08:00:00Z"></time>
    </article>
    <li class="feed-item">
      <a href="https://tools.example.com/agent-workflow">Agent workflow tool for coding teams</a>
      <p>Developer automation product for code review and release workflows.</p>
    </li>
    <li>
      <a href="https://tools.example.com/agent-workflow">Agent workflow tool for coding teams</a>
    </li>
    <footer>
      <a href="https://twitter.com/aihot">Twitter</a>
    </footer>
  </main>
`;

test('extracts structured AIHot items from content blocks', () => {
  const items = extractAIHotItemsFromHtml(MOCK_HTML, 'https://aihot.virxact.com/', 10);

  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'New multimodal LLM model release');
  assert.equal(items[0].category, 'models');
  assert.equal(items[0].originalSource, 'Example AI');
  assert.equal(items[0].publishedAt, '2026-05-26T08:00:00.000Z');
  assert.match(items[0].summary ?? '', /Open weights model/);
});

test('filters navigation links and duplicate AIHot candidates', () => {
  const items = extractAIHotItemsFromHtml(MOCK_HTML, 'https://aihot.virxact.com/', 10);

  assert.equal(isNavigationTitle('首页'), true);
  assert.equal(items.some((item) => item.title === '首页' || item.title === 'About'), false);
  assert.equal(items.filter((item) => item.url === 'https://tools.example.com/agent-workflow').length, 1);
});

test('applies AIHot category filter with fallback when too sparse', () => {
  const modelOnly = extractAIHotItemsFromHtml(MOCK_HTML, 'https://aihot.virxact.com/', 10, ['models']);
  assert.equal(modelOnly[0].category, 'models');
  assert.equal(modelOnly.some((item) => item.category === 'agents'), true);
});

test('infers expanded AIHot categories', () => {
  assert.equal(inferAIHotCategory('browser coding agent for developers'), 'agents');
  assert.equal(inferAIHotCategory('AI policy regulation update'), 'policy');
});

test('extracts AIHot items from the public API response', () => {
  const items = extractAIHotItemsFromApiResponse({
    items: [
      {
        id: 'api-1',
        title: 'Open model release',
        url: 'https://example.com/model',
        source: 'Example AI',
        publishedAt: '2026-05-27T10:00:00.000Z',
        summary: 'A model release for developer workflows.',
        category: 'ai-models'
      },
      {
        id: 'api-2',
        title: 'Prompting tip',
        url: 'https://example.com/tip',
        source: 'Example Blog',
        summary: 'Useful workflow advice.',
        category: 'tip'
      }
    ]
  }, 10, ['models']);

  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'aihot:api-1');
  assert.equal(items[0].category, 'models');
  assert.equal(items[0].originalSource, 'Example AI');
  assert.equal(items[0].publishedAt, '2026-05-27T10:00:00.000Z');
  assert.equal(items[1].category, 'tools');
});

test('AIHot collector fetches the public API with a browser user-agent', async () => {
  let requestedUrl = '';
  let userAgent: string | null = null;
  const fetchImpl: typeof fetch = async (url, init) => {
    requestedUrl = String(url);
    userAgent = new Headers(init?.headers).get('user-agent');
    return new Response(JSON.stringify({
      items: [
        {
          id: 'api-1',
          title: 'AI product launch',
          url: 'https://example.com/product',
          source: 'Example AI',
          summary: 'New AI product for teams.',
          category: 'ai-products'
        }
      ]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  const collector = new AIHotCollector({ fetchImpl });

  const items = await collector.fetch(5);
  const url = new URL(requestedUrl);

  assert.equal(url.pathname, '/api/public/items');
  assert.equal(url.searchParams.get('mode'), 'selected');
  assert.equal(url.searchParams.get('take'), '5');
  assert.equal(Boolean(url.searchParams.get('since')), true);
  assert.equal(Number.isFinite(Date.parse(url.searchParams.get('since') as string)), true);
  assert.match(userAgent ?? '', /Mozilla\/5\.0/);
  assert.equal(items[0].category, 'products');
});

test('AIHot collector clamps API take parameter to safe bounds', async () => {
  let requestedUrl = '';
  const fetchImpl: typeof fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  const collector = new AIHotCollector({ fetchImpl });

  await collector.fetch(250);

  assert.equal(new URL(requestedUrl).searchParams.get('take'), '100');
});

test('AIHot collector normalizes abort-like errors', async () => {
  const collector = new AIHotCollector({
    maxRetries: 0,
    timeoutMs: 12_345,
    fetchImpl: async () => {
      throw new Error('This operation was aborted');
    }
  });

  await assert.rejects(
    () => collector.fetch(5),
    /AIHot request timed out or was aborted after 12345ms/
  );
});

test('AIHot collector falls back to /api/public/daily when items API aborts', async () => {
  const fetchImpl: typeof fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname === '/api/public/items') {
      throw new Error('This operation was aborted');
    }

    return new Response(JSON.stringify({
      date: '2026-05-28',
      windowEnd: '2026-05-28T12:00:00.000Z',
      sections: [
        {
          label: '模型',
          items: [
            {
              title: 'Daily fallback model pick',
              sourceUrl: 'https://example.com/daily-model',
              summary: 'Fallback summary',
              sourceName: 'AIHot Daily'
            }
          ]
        }
      ]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  const collector = new AIHotCollector({ fetchImpl, maxRetries: 0 });

  const items = await collector.fetch(5);

  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Daily fallback model pick');
  assert.equal(items[0].category, 'models');
});

test('AIHot collector includes response body in HTTP errors', async () => {
  const collector = new AIHotCollector({
    fetchImpl: async () => new Response('Forbidden crawler user-agent', { status: 403 })
  });

  await assert.rejects(
    () => collector.fetch(5),
    /AIHot request failed: HTTP 403 - Forbidden crawler user-agent/
  );
});
