import type { TrendingItem } from './types.js';
import type { ProductHuntPost, ProductHuntTopicNode } from './producthunt-types.js';

export const DEFAULT_PRODUCT_HUNT_TOPICS = [
  'artificial-intelligence',
  'developer-tools',
  'open-source',
  'productivity',
  'saas'
];

export const DEFAULT_PRODUCT_HUNT_KEYWORDS = [
  'ai',
  'artificial intelligence',
  'llm',
  'large language model',
  'gpt',
  'machine learning',
  'deep learning',
  'neural',
  'transformer',
  'diffusion',
  'agent',
  'agents',
  'agentic',
  'multi-agent',
  'autonomous',
  'coding agent',
  'swe agent',
  'ai agent',
  'rag',
  'retrieval',
  'knowledge base',
  'knowledge graph',
  'vector database',
  'embeddings',
  'semantic search',
  'mcp',
  'model context protocol',
  'tool calling',
  'function calling',
  'tool use',
  'plugin',
  'extension',
  'openai',
  'claude',
  'gemini',
  'deepseek',
  'llama',
  'mistral',
  'anthropic',
  'inference',
  'fine-tuning',
  'fine tuning',
  'local llm',
  'on-device',
  'open source model',
  'developer',
  'devtool',
  'developer tool',
  'sdk',
  'api',
  'cli',
  'terminal',
  'ide',
  'code',
  'cursor',
  'copilot',
  'codex',
  'vibe coding',
  'coding',
  'github',
  'git',
  'open source',
  'workflow',
  'automation',
  'no-code',
  'low-code',
  'nocode',
  'pipeline',
  'orchestration',
  'mlops',
  'monitoring',
  'observability',
  'evaluation',
  'guardrail',
  'safety',
  'prompt',
  'prompt engineering',
  'ai app',
  'ai tool',
  'ai assistant',
  'copilot',
  'chatbot',
  'chat',
  'conversational',
  'design',
  'ui',
  'frontend',
  'react',
  'nextjs',
  'data',
  'analytics',
  'dashboard',
  'visualization',
  'productivity',
  'collaboration',
  'docs',
  'documentation',
  'hackathon',
  'launch'
];

const REQUIRED_AI_SIGNAL_KEYWORDS = [
  'ai',
  'llm',
  'agent',
  'rag',
  'mcp',
  'gpt',
  'claude',
  'openai',
  'coding',
  'developer',
  'devtool',
  'inference',
  'model',
  'copilot',
  'workflow',
  'automation',
  'chatbot',
  'assistant',
  'prompt'
];

const RELEVANCE_THRESHOLD = 20;
const DEVELOPER_URL_SIGNALS = [
  'github.com',
  'gitlab.com',
  'npmjs.com',
  'pypi.org',
  '/docs',
  '/developers',
  '/api',
  '/sdk'
];

export interface ProductHuntFilterOptions {
  topics?: string[];
  keywords?: string[];
  minVotes?: number;
  minComments?: number;
}

export function mapProductHuntPostToTrendingItem(post: ProductHuntPost, rank: number): TrendingItem {
  const topics = extractProductHuntTopics(post);
  const description = cleanDescription(post.tagline, post.description);
  const heatScore = calculateProductHuntHeatScore(post);

  return {
    rank,
    id: `producthunt:${post.id}`,
    title: post.name,
    description,
    url: post.url,
    primaryTag: topics[0]?.name ?? null,
    tags: topics.map((topic) => topic.name).filter((name): name is string => Boolean(name)),
    heatScore,
    totalScore: post.votesCount,
    metadata: {
      source: 'producthunt',
      slug: post.slug,
      website: post.website ?? null,
      votesCount: post.votesCount,
      commentsCount: post.commentsCount,
      reviewsCount: post.reviewsCount ?? null,
      reviewsRating: post.reviewsRating ?? null,
      dailyRank: post.dailyRank ?? null,
      weeklyRank: post.weeklyRank ?? null,
      monthlyRank: post.monthlyRank ?? null,
      createdAt: post.createdAt,
      featuredAt: post.featuredAt ?? null,
      makers: post.makers?.filter(Boolean) ?? [],
      thumbnailUrl: post.thumbnail?.url ?? null,
      productLinks: post.productLinks?.filter(Boolean) ?? [],
      relevanceScore: calculateProductHuntRelevance(post)
    }
  };
}

export function calculateProductHuntHeatScore(post: ProductHuntPost): number {
  return post.votesCount + post.commentsCount * 3;
}

export function isRelevantProductHuntPost(
  post: ProductHuntPost,
  options: ProductHuntFilterOptions = {}
): boolean {
  const minVotes = options.minVotes ?? 0;
  const minComments = options.minComments ?? 0;
  if (post.votesCount < minVotes || post.commentsCount < minComments) {
    return false;
  }

  return hasProductHuntAiSignal(post) && calculateProductHuntRelevance(post, options) >= RELEVANCE_THRESHOLD;
}

export function hasProductHuntAiSignal(post: ProductHuntPost): boolean {
  const text = [post.name, post.tagline, post.description ?? ''].join(' ').toLowerCase();
  return REQUIRED_AI_SIGNAL_KEYWORDS.some((keyword) => keywordMatches(text, keyword));
}

export function calculateProductHuntRelevance(
  post: ProductHuntPost,
  options: ProductHuntFilterOptions = {}
): number {
  const configuredTopics = normalizeSet(options.topics ?? DEFAULT_PRODUCT_HUNT_TOPICS);
  const configuredKeywords = (options.keywords ?? DEFAULT_PRODUCT_HUNT_KEYWORDS)
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
  let score = 0;

  if (topicMatches(post, configuredTopics)) score += 35;
  if (containsAnyKeyword(post.name, configuredKeywords)) score += 25;
  if (containsAnyKeyword(post.tagline, configuredKeywords)) score += 25;
  if (containsAnyKeyword(post.description ?? '', configuredKeywords)) score += 15;
  if (hasDeveloperSignal(post)) score += 10;

  return Math.min(100, score);
}

export function extractProductHuntTopics(post: ProductHuntPost): ProductHuntTopicNode[] {
  const topics = post.topics?.edges
    ?.map((edge) => edge?.node)
    .filter((topic): topic is ProductHuntTopicNode => Boolean(topic?.name || topic?.slug)) ?? [];

  const seen = new Set<string>();
  return topics.filter((topic) => {
    const key = normalizeTopicValue(topic.slug ?? topic.name ?? '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function topicMatches(post: ProductHuntPost, configuredTopics: Set<string>): boolean {
  return extractProductHuntTopics(post).some((topic) => (
    configuredTopics.has(normalizeTopicValue(topic.slug ?? '')) ||
    configuredTopics.has(normalizeTopicValue(topic.name ?? ''))
  ));
}

function hasDeveloperSignal(post: ProductHuntPost): boolean {
  const linkText = [
    post.website,
    ...(post.productLinks?.map((link) => link?.url) ?? [])
  ].filter(Boolean).join(' ').toLowerCase();

  return DEVELOPER_URL_SIGNALS.some((signal) => linkText.includes(signal));
}

function containsAnyKeyword(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => keywordMatches(normalized, keyword));
}

function keywordMatches(text: string, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return false;
  const pattern = normalizedKeyword
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '[\\s_-]+');
  return new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, 'i').test(text);
}

function cleanDescription(tagline: string, description?: string | null): string {
  const cleanTagline = normalizeWhitespace(tagline);
  const cleanBody = normalizeWhitespace(description ?? '');
  if (!cleanBody) return cleanTagline;
  if (!cleanTagline) return cleanBody;
  return `${cleanTagline} - ${cleanBody}`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeSet(values: string[]): Set<string> {
  return new Set(values.map(normalizeTopicValue).filter(Boolean));
}

function normalizeTopicValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-');
}
