import assert from 'node:assert/strict';
import test from 'node:test';
import { extractAIHotItemsFromHtml, inferAIHotCategory, isNavigationTitle } from '../../src/collectors/aihot.js';

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
