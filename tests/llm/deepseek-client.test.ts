import assert from 'node:assert/strict';
import test from 'node:test';
import { callDeepSeekJson } from '../../src/llm/deepseek-client.js';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('DeepSeek client returns parsed JSON content', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [
      {
        message: {
          content: JSON.stringify({ ok: true })
        }
      }
    ]
  }), { status: 200 });

  const result = await callDeepSeekJson<{ ok: boolean }>({
    systemPrompt: 'system',
    userPrompt: 'user'
  }, {
    apiKey: 'test-key',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-test',
    timeoutMs: 1000,
    maxRetries: 0,
    maxOutputTokens: 1200
  });

  assert.deepEqual(result, { ok: true });
});

test('DeepSeek client rejects invalid JSON response content', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [
      {
        message: {
          content: '{'
        }
      }
    ]
  }), { status: 200 });

  await assert.rejects(() => callDeepSeekJson({
    systemPrompt: 'system',
    userPrompt: 'user'
  }, {
    apiKey: 'test-key',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-test',
    timeoutMs: 1000,
    maxRetries: 0,
    maxOutputTokens: 1200
  }));
});

test('DeepSeek client sends JSON mode, thinking disabled, and max_tokens', async () => {
  let requestBody: Record<string, unknown> | undefined;

  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    return new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({ ok: true })
          }
        }
      ]
    }), { status: 200 });
  };

  await callDeepSeekJson<{ ok: boolean }>({
    systemPrompt: 'system',
    userPrompt: 'user'
  }, {
    apiKey: 'test-key',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-test',
    timeoutMs: 1000,
    maxRetries: 0,
    maxOutputTokens: 1200
  });

  assert.deepEqual(requestBody?.response_format, { type: 'json_object' });
  assert.deepEqual(requestBody?.thinking, { type: 'disabled' });
  assert.equal(requestBody?.max_tokens, 1200);
});
