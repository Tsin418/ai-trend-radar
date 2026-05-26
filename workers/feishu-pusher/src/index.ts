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
  PRODUCT_HUNT_TOKEN?: string;
  PRODUCT_HUNT_ENABLED?: string;
  PRODUCT_HUNT_POST_LIMIT?: string;
  PRODUCT_HUNT_DAYS_BACK?: string;
  PRODUCT_HUNT_TOPICS?: string;
  PRODUCT_HUNT_KEYWORDS?: string;
  PRODUCT_HUNT_MIN_VOTES?: string;
  PRODUCT_HUNT_MIN_COMMENTS?: string;
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
const PRODUCT_HUNT_ENDPOINT = 'https://api.producthunt.com/v2/api/graphql';
const DEFAULT_PRODUCT_HUNT_TOPICS = [
  'artificial-intelligence',
  'developer-tools',
  'open-source',
  'productivity',
  'saas'
];
const DEFAULT_PRODUCT_HUNT_KEYWORDS = [
  'ai',
  'llm',
  'agent',
  'agents',
  'rag',
  'mcp',
  'model context protocol',
  'openai',
  'claude',
  'gemini',
  'cursor',
  'coding',
  'developer',
  'devtool',
  'workflow',
  'automation',
  'api',
  'sdk',
  'open source',
  'github',
  'productivity',
  'knowledge base',
  'chatbot'
];
const DEVELOPER_URL_SIGNALS = ['github.com', 'gitlab.com', 'npmjs.com', 'pypi.org', '/docs', '/developers', '/api', '/sdk'];
const PRODUCT_HUNT_RELEVANCE_MIN = 20;
const PRODUCT_HUNT_QUERY = `
query ProductHuntPosts(
  $first: Int!
  $postedAfter: DateTime
  $postedBefore: DateTime
  $topic: String
  $order: PostsOrder
) {
  posts(
    first: $first
    postedAfter: $postedAfter
    postedBefore: $postedBefore
    topic: $topic
    order: $order
    featured: true
  ) {
    edges {
      node {
        id
        name
        slug
        tagline
        description
        url
        website
        votesCount
        commentsCount
        dailyRank
        weeklyRank
        monthlyRank
        createdAt
        featuredAt
        makers {
          name
          username
          url
        }
        productLinks {
          type
          url
        }
        topics(first: 10) {
          edges {
            node {
              name
              slug
            }
          }
        }
      }
    }
  }
}
`;

interface ProductHuntPost {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description?: string | null;
  url: string;
  website?: string | null;
  votesCount: number;
  commentsCount: number;
  dailyRank?: number | null;
  weeklyRank?: number | null;
  monthlyRank?: number | null;
  createdAt: string;
  featuredAt?: string | null;
  topics?: {
    edges?: Array<{
      node?: {
        name?: string;
        slug?: string;
      } | null;
    } | null>;
  } | null;
  makers?: Array<{
    name?: string;
    username?: string;
    url?: string;
  } | null> | null;
  productLinks?: Array<{
    type?: string;
    url?: string;
  } | null> | null;
}

interface ProductHuntSignal {
  rank: number;
  name: string;
  tagline: string;
  url: string;
  website: string | null;
  votesCount: number;
  commentsCount: number;
  heatScore: number;
  topics: string[];
}

interface ProductHuntGraphQLResponse {
  data?: {
    posts?: {
      edges?: Array<{
        node?: ProductHuntPost | null;
      } | null>;
    } | null;
  } | null;
  errors?: Array<{
    message?: string;
  }>;
}

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

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return fallback;
}

function parseCsv(value: string | undefined, fallback: string[]): string[] {
  const parsed = value?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
  return parsed.length > 0 ? parsed : fallback;
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

function productHuntDateWindow(daysBack: number): { postedAfter: string; postedBefore: string } {
  const now = new Date();
  return {
    postedBefore: now.toISOString(),
    postedAfter: new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString()
  };
}

async function fetchProductHuntTopic(env: Env, topic: string | null, limit: number): Promise<ProductHuntPost[]> {
  const token = env.PRODUCT_HUNT_TOKEN?.trim();
  if (!token) return [];

  const daysBack = parsePositiveInteger(env.PRODUCT_HUNT_DAYS_BACK, 1);
  const { postedAfter, postedBefore } = productHuntDateWindow(daysBack);
  const response = await fetch(PRODUCT_HUNT_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({
      query: PRODUCT_HUNT_QUERY,
      variables: {
        first: limit,
        postedAfter,
        postedBefore,
        topic,
        order: 'VOTES'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Product Hunt API HTTP ${response.status}`);
  }

  let payload: ProductHuntGraphQLResponse;
  try {
    payload = await response.json() as ProductHuntGraphQLResponse;
  } catch {
    throw new Error('Product Hunt API returned non-JSON response');
  }

  if (payload.errors && payload.errors.length > 0) {
    const message = payload.errors.map((error) => error.message).filter(Boolean).join('; ');
    throw new Error(`Product Hunt GraphQL error: ${message || 'unknown error'}`);
  }

  return payload.data?.posts?.edges
    ?.map((edge) => edge?.node)
    .filter((post): post is ProductHuntPost => Boolean(post)) ?? [];
}

async function collectProductHuntSignals(env: Env): Promise<ProductHuntSignal[]> {
  if (!parseBoolean(env.PRODUCT_HUNT_ENABLED, true)) return [];
  if (!env.PRODUCT_HUNT_TOKEN?.trim()) return [];

  const limit = parsePositiveInteger(env.PRODUCT_HUNT_POST_LIMIT, 30);
  const topics = parseCsv(env.PRODUCT_HUNT_TOPICS, DEFAULT_PRODUCT_HUNT_TOPICS);
  const topicResults = await Promise.allSettled(
    topics.map((topic) => fetchProductHuntTopic(env, topic, Math.max(limit, 30)))
  );
  let posts = topicResults.flatMap((result) => result.status === 'fulfilled' ? result.value : []);

  if (posts.length === 0) {
    posts = await fetchProductHuntTopic(env, null, limit);
  }

  const deduped = dedupeProductHuntPosts(posts);
  const minVotes = parseNonNegativeInteger(env.PRODUCT_HUNT_MIN_VOTES, 10);
  const minComments = parseNonNegativeInteger(env.PRODUCT_HUNT_MIN_COMMENTS, 0);
  const keywords = parseCsv(env.PRODUCT_HUNT_KEYWORDS, DEFAULT_PRODUCT_HUNT_KEYWORDS)
    .map((keyword) => keyword.toLowerCase());

  return deduped
    .filter((post) => post.votesCount >= minVotes && post.commentsCount >= minComments)
    .filter((post) => calculateProductHuntRelevance(post, topics, keywords) >= PRODUCT_HUNT_RELEVANCE_MIN)
    .map((post) => ({
      rank: 0,
      name: post.name,
      tagline: compactWhitespace(post.tagline),
      url: post.url,
      website: post.website?.trim() || null,
      votesCount: post.votesCount,
      commentsCount: post.commentsCount,
      heatScore: post.votesCount + post.commentsCount * 3,
      topics: extractProductHuntTopicNames(post)
    }))
    .sort((left, right) => right.heatScore - left.heatScore)
    .slice(0, limit)
    .map((signal, index) => ({ ...signal, rank: index + 1 }));
}

function dedupeProductHuntPosts(posts: ProductHuntPost[]): ProductHuntPost[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

function calculateProductHuntRelevance(post: ProductHuntPost, configuredTopics: string[], keywords: string[]): number {
  const topicSet = new Set(configuredTopics.map(normalizeTopic));
  let score = 0;

  if (extractProductHuntTopics(post).some((topic) => topicSet.has(normalizeTopic(topic.slug ?? '')) || topicSet.has(normalizeTopic(topic.name ?? '')))) {
    score += 35;
  }
  if (containsAnyKeyword(post.name, keywords)) score += 25;
  if (containsAnyKeyword(post.tagline, keywords)) score += 25;
  if (containsAnyKeyword(post.description ?? '', keywords)) score += 15;
  if (hasDeveloperSignal(post)) score += 10;

  return Math.min(100, score);
}

function extractProductHuntTopicNames(post: ProductHuntPost): string[] {
  return extractProductHuntTopics(post)
    .map((topic) => topic.name)
    .filter((name): name is string => Boolean(name));
}

function extractProductHuntTopics(post: ProductHuntPost): Array<{ name?: string; slug?: string }> {
  const seen = new Set<string>();
  const topics = post.topics?.edges
    ?.map((edge) => edge?.node)
    .filter((topic): topic is { name?: string; slug?: string } => Boolean(topic?.name || topic?.slug)) ?? [];

  return topics.filter((topic) => {
    const key = normalizeTopic(topic.slug ?? topic.name ?? '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function containsAnyKeyword(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function hasDeveloperSignal(post: ProductHuntPost): boolean {
  const linkText = [
    post.website,
    ...(post.productLinks?.map((link) => link?.url) ?? [])
  ].filter(Boolean).join(' ').toLowerCase();

  return DEVELOPER_URL_SIGNALS.some((signal) => linkText.includes(signal));
}

function normalizeTopic(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function appendProductHuntSignals(text: string, signals: ProductHuntSignal[], warning?: string): string {
  if (signals.length === 0 && !warning) return text;

  const lines = ['', '', 'Product Hunt Launch Signals'];

  if (warning) {
    lines.push(`- Product Hunt collection warning: ${warning}`);
  } else {
    for (const signal of signals) {
      lines.push(`${signal.rank}. ${signal.name}`);
      lines.push(`   Product Hunt: ${signal.url}`);
      if (signal.website) lines.push(`   Website: ${signal.website}`);
      lines.push(`   Votes: ${signal.votesCount} | Comments: ${signal.commentsCount} | Heat: ${signal.heatScore}`);
      if (signal.topics.length > 0) lines.push(`   Topics: ${signal.topics.join(', ')}`);
      if (signal.tagline) lines.push(`   Tagline: ${signal.tagline}`);
    }
    lines.push('');
    lines.push('Data note: Product Hunt heat score = votes + comments * 3. It is a launch/product signal, not a GitHub code-quality signal.');
  }

  return `${text.trimEnd()}${lines.join('\n')}`;
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

  let productHuntWarning: string | undefined;
  let productHuntSignals: ProductHuntSignal[] = [];
  try {
    productHuntSignals = await collectProductHuntSignals(env);
  } catch (error) {
    productHuntWarning = errorMessage(error);
    console.warn(`Product Hunt collection failed: ${productHuntWarning}`);
  }

  await postToFeishu(env, appendProductHuntSignals(digest.text, productHuntSignals, productHuntWarning));

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
