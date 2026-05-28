import assert from 'node:assert/strict';
import test from 'node:test';
import { HuggingFaceModelsCollector } from '../../src/collectors/huggingface-models.js';

test('Hugging Face models collector uses a supported sort parameter', async () => {
  let requestedUrl = '';
  const fetchImpl: typeof fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify([
      {
        id: 'example/code-llm',
        modelId: 'example/code-llm',
        author: 'example',
        downloads: 42,
        likes: 7,
        pipeline_tag: 'text-generation',
        tags: ['transformers', 'code', 'text-generation'],
        createdAt: '2026-05-28T00:00:00.000Z',
        lastModified: '2026-05-28T01:00:00.000Z'
      }
    ]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  const collector = new HuggingFaceModelsCollector({ fetchImpl });

  const items = await collector.fetch(10);
  const url = new URL(requestedUrl);

  assert.equal(url.searchParams.get('sort'), 'createdAt');
  assert.equal(url.searchParams.get('direction'), '-1');
  assert.equal(url.searchParams.get('limit'), '10');
  assert.equal(url.searchParams.has('full'), false);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'example/code-llm');
  assert.equal(items[0].metrics?.downloads, 42);
});
