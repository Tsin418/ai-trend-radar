interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface ScheduledController {
  cron: string;
  scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface Env {
  FEISHU_WEBHOOK_URL: string;
  FEISHU_SECRET?: string;
  DIGEST_URL?: string;
  MAX_DIGEST_AGE_HOURS?: string;
  GITHUB_TOKEN?: string;
  MANUAL_SEND_TOKEN?: string;
  RADAR_STATE?: KVNamespace;
}

interface LatestDigest {
  schemaVersion: 1;
  mode: 'daily' | 'weekly';
  targetDate: string;
  generatedAt: string;
  timezone: string;
  digestId: string;
  text: string;
}

interface SendResult {
  ok: true;
  skipped: boolean;
  reason?: string;
  digestId: string;
  targetDate?: string;
  generatedAt?: string;
}

const DEFAULT_DIGEST_URL =
  'https://raw.githubusercontent.com/Tsin418/ai-trend-radar/main/data/latest-daily-digest.json';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Digest missing required field: ${fieldName}`);
  }
  return value;
}

function validateDigest(value: unknown): LatestDigest {
  if (!value || typeof value !== 'object') {
    throw new Error('Digest response is not a JSON object');
  }

  const digest = value as Record<string, unknown>;
  if (digest.schemaVersion !== 1) {
    throw new Error('Invalid digest schemaVersion');
  }

  if (digest.mode !== 'daily') {
    throw new Error(`Expected daily digest, got ${String(digest.mode)}`);
  }

  const text = requireString(digest.text, 'text');
  if (text.trim().length < 20) {
    throw new Error('Digest text is too short');
  }

  return {
    schemaVersion: 1,
    mode: digest.mode,
    targetDate: requireString(digest.targetDate, 'targetDate'),
    generatedAt: requireString(digest.generatedAt, 'generatedAt'),
    timezone: requireString(digest.timezone, 'timezone'),
    digestId: requireString(digest.digestId, 'digestId'),
    text
  };
}

function parseMaxDigestAgeHours(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '36', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 36;
}

function assertFreshDigest(digest: LatestDigest, maxAgeHours: number): void {
  const generatedAt = Date.parse(digest.generatedAt);
  if (!Number.isFinite(generatedAt)) {
    throw new Error('Invalid generatedAt timestamp');
  }

  const ageMs = Date.now() - generatedAt;
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  if (ageMs > maxAgeMs) {
    throw new Error(
      `Digest is stale: generatedAt=${digest.generatedAt}, maxAgeHours=${maxAgeHours}`
    );
  }
}

async function signFeishu(timestamp: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${timestamp}\n${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new Uint8Array());
  const bytes = new Uint8Array(signature);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function fetchLatestDigest(env: Env): Promise<LatestDigest> {
  const headers = new Headers({
    'cache-control': 'no-cache'
  });

  if (env.GITHUB_TOKEN?.trim()) {
    headers.set('authorization', `Bearer ${env.GITHUB_TOKEN.trim()}`);
  }

  const response = await fetch(env.DIGEST_URL?.trim() || DEFAULT_DIGEST_URL, {
    headers,
    cf: {
      cacheTtl: 0,
      cacheEverything: false
    }
  } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });

  if (!response.ok) {
    throw new Error(`Failed to fetch digest: HTTP ${response.status}`);
  }

  return validateDigest(await response.json());
}

async function postToFeishu(env: Env, text: string): Promise<void> {
  const webhook = env.FEISHU_WEBHOOK_URL?.trim();
  if (!webhook) {
    throw new Error('Missing FEISHU_WEBHOOK_URL');
  }

  const payload: Record<string, unknown> = {
    msg_type: 'text',
    content: {
      text
    }
  };

  if (env.FEISHU_SECRET?.trim()) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    payload.timestamp = timestamp;
    payload.sign = await signFeishu(timestamp, env.FEISHU_SECRET.trim());
  }

  const response = await fetch(webhook, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const responseText = await response.text();
  let parsed: Record<string, unknown> = {};

  try {
    parsed = responseText ? JSON.parse(responseText) as Record<string, unknown> : {};
  } catch {
    throw new Error(`Feishu returned non-JSON response: ${responseText.slice(0, 200)}`);
  }

  const code =
    typeof parsed.code === 'number'
      ? parsed.code
      : typeof parsed.StatusCode === 'number'
        ? parsed.StatusCode
        : 0;

  if (!response.ok || code !== 0) {
    throw new Error(
      `Feishu webhook error: HTTP ${response.status}, body=${responseText.slice(0, 300)}`
    );
  }
}

async function sendLatestDigest(env: Env, force = false): Promise<SendResult> {
  const digest = await fetchLatestDigest(env);
  assertFreshDigest(digest, parseMaxDigestAgeHours(env.MAX_DIGEST_AGE_HOURS));

  const sentKey = `sent:${digest.digestId}`;
  if (env.RADAR_STATE) {
    const existing = await env.RADAR_STATE.get(sentKey);
    if (existing && !force) {
      return {
        ok: true,
        skipped: true,
        reason: 'Digest already sent',
        digestId: digest.digestId
      };
    }
  } else {
    console.warn('RADAR_STATE KV binding is not configured; idempotency is disabled.');
  }

  await postToFeishu(env, digest.text);

  if (env.RADAR_STATE) {
    await env.RADAR_STATE.put(
      sentKey,
      JSON.stringify({
        digestId: digest.digestId,
        sentAt: new Date().toISOString()
      }),
      {
        expirationTtl: 60 * 60 * 24 * 30
      }
    );
  }

  return {
    ok: true,
    skipped: false,
    digestId: digest.digestId,
    targetDate: digest.targetDate,
    generatedAt: digest.generatedAt
  };
}

function isAuthorizedManualRequest(request: Request, env: Env): boolean {
  const token = env.MANUAL_SEND_TOKEN?.trim();
  if (!token) return false;

  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${token}`;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      sendLatestDigest(env).then(
        (result) => console.log(JSON.stringify(result)),
        (error) => {
          console.error(errorMessage(error));
          throw error;
        }
      )
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        service: 'ai-trend-radar-feishu-pusher'
      });
    }

    if (url.pathname === '/send' && request.method === 'POST') {
      if (!isAuthorizedManualRequest(request, env)) {
        return jsonResponse({
          ok: false,
          error: 'Manual send is disabled or unauthorized'
        }, 401);
      }

      try {
        return jsonResponse(await sendLatestDigest(env, url.searchParams.get('force') === 'true'));
      } catch (error) {
        return jsonResponse({
          ok: false,
          error: errorMessage(error)
        }, 500);
      }
    }

    return jsonResponse({
      ok: false,
      error: 'Not found'
    }, 404);
  }
};
