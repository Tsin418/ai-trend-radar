import fs from 'node:fs';
import path from 'node:path';
import type { RadarProfile } from './types.js';

const DEFAULT_PROFILE: RadarProfile = {
  name: 'AI Developer Radar',
  description: 'Track AI open-source projects from a developer/product builder perspective.',
  categories: [
    'AI Agent Framework',
    'Coding Agent / SWE Agent',
    'RAG / Knowledge Base',
    'MCP / Tool Calling',
    'Local LLM / Inference',
    'AI App Builder',
    'AI Workflow Automation',
    'Vector Database / Embedding',
    'AI Browser / Computer Use',
    'AI DevTool / Observability'
  ],
  keywords: [
    'ai',
    'llm',
    'agent',
    'agents',
    'ai-agent',
    'rag',
    'retrieval',
    'mcp',
    'model-context-protocol',
    'tool-calling',
    'function-calling',
    'coding-agent',
    'swe-agent',
    'copilot',
    'cursor',
    'cline',
    'computer-use',
    'browser-agent',
    'workflow',
    'automation',
    'inference',
    'local-llm',
    'embedding',
    'vector-database',
    'vector-db',
    'knowledge-base',
    'openai',
    'anthropic',
    'claude',
    'gemini',
    'llama',
    'transformer',
    'diffusion'
  ],
  searchTopics: [
    'llm',
    'ai-agent',
    'agents',
    'rag',
    'mcp',
    'generative-ai',
    'openai',
    'claude',
    'cursor',
    'ai-coding',
    'inference',
    'vector-database',
    'workflow-automation',
    'computer-use',
    'browser-agent'
  ],
  searchKeywords: [
    'llm stars:>30',
    'agent stars:>30',
    'rag stars:>30',
    'mcp stars:>30',
    'coding agent stars:>30'
  ],
  thresholds: {
    dailyStarHot: 50,
    dailyStarEarly: 20,
    weeklyStarEarly: 80,
    earlyStageMinStars: 50,
    earlyStageMaxStars: 3000,
    aiRelevanceMin: 20
  }
};

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return ['true', '1', 'yes', 'on'].includes(normalized);
}

function parseCsv(value: string | undefined): string[] {
  return value?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
}

function parseYamlList(text: string, key: string): string[] {
  const lines = text.split(/\r?\n/);
  const result: string[] = [];
  let active = false;
  const keyPattern = new RegExp(`^\\s*${key}:\\s*$`);

  for (const line of lines) {
    if (keyPattern.test(line)) {
      active = true;
      continue;
    }
    if (active && /^\s{2,}[a-zA-Z0-9_-]+:/.test(line) && !line.trim().startsWith('-')) {
      break;
    }
    if (!active) continue;
    const match = line.match(/^\s*-\s+"?([^"]+?)"?\s*$/);
    if (match) result.push(match[1].trim());
  }

  return result;
}

function parseYamlString(text: string, key: string, fallback: string): string {
  const match = text.match(new RegExp(`^\\s*${key}:\\s+"?([^"\\n]+)"?\\s*$`, 'm'));
  return match?.[1]?.trim() || fallback;
}

function parseYamlThreshold(text: string, key: string, fallback: number): number {
  const match = text.match(new RegExp(`^\\s*${key}:\\s*(\\d+)\\s*$`, 'm'));
  return match ? parseNumber(match[1], fallback) : fallback;
}

export function loadRadarProfile(profilePath = 'config/radar-profile.yaml'): RadarProfile {
  const resolved = path.resolve(profilePath);
  const fileText = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : '';
  const envKeywords = parseCsv(process.env.RADAR_PROFILE_KEYWORDS);

  const profile: RadarProfile = {
    ...DEFAULT_PROFILE,
    name: parseYamlString(fileText, 'name', DEFAULT_PROFILE.name),
    description: parseYamlString(fileText, 'description', DEFAULT_PROFILE.description),
    categories: parseYamlList(fileText, 'categories').length > 0 ? parseYamlList(fileText, 'categories') : DEFAULT_PROFILE.categories,
    keywords: parseYamlList(fileText, 'keywords').length > 0 ? parseYamlList(fileText, 'keywords') : DEFAULT_PROFILE.keywords,
    searchTopics: parseYamlList(fileText, 'search_topics').length > 0 ? parseYamlList(fileText, 'search_topics') : DEFAULT_PROFILE.searchTopics,
    searchKeywords: parseYamlList(fileText, 'search_keywords').length > 0 ? parseYamlList(fileText, 'search_keywords') : DEFAULT_PROFILE.searchKeywords,
    thresholds: {
      dailyStarHot: parseNumber(process.env.RADAR_DAILY_STAR_THRESHOLD, parseYamlThreshold(fileText, 'daily_star_hot', DEFAULT_PROFILE.thresholds.dailyStarHot)),
      dailyStarEarly: parseNumber(process.env.RADAR_EARLY_SIGNAL_DAILY_THRESHOLD, parseYamlThreshold(fileText, 'daily_star_early', DEFAULT_PROFILE.thresholds.dailyStarEarly)),
      weeklyStarEarly: parseNumber(process.env.RADAR_EARLY_SIGNAL_WEEKLY_THRESHOLD, parseYamlThreshold(fileText, 'weekly_star_early', DEFAULT_PROFILE.thresholds.weeklyStarEarly)),
      earlyStageMinStars: parseYamlThreshold(fileText, 'early_stage_min_stars', DEFAULT_PROFILE.thresholds.earlyStageMinStars),
      earlyStageMaxStars: parseYamlThreshold(fileText, 'early_stage_max_stars', DEFAULT_PROFILE.thresholds.earlyStageMaxStars),
      aiRelevanceMin: parseYamlThreshold(fileText, 'ai_relevance_min', DEFAULT_PROFILE.thresholds.aiRelevanceMin)
    }
  };

  if (envKeywords.length > 0) {
    profile.keywords = Array.from(new Set([...profile.keywords, ...envKeywords]));
  }

  return profile;
}

export function getRadarRepoLimit(): number {
  return parseNumber(process.env.RADAR_REPO_LIMIT, 100);
}

export function getRadarRecommendationLimit(): number {
  return parseNumber(process.env.RADAR_RECOMMENDATION_LIMIT, 10);
}

export function getRadarStorePath(): string {
  return process.env.RADAR_STORE_PATH || 'data/radar-store.json';
}

export interface LLMEnrichmentConfig {
  enabled: boolean;
  apiKey?: string;
  baseUrl: string;
  model: string;
  limit: number;
  readmeMaxChars: number;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
  cachePath: string;
}

export function getLLMEnrichmentConfig(): LLMEnrichmentConfig {
  return {
    enabled: parseBoolean(process.env.LLM_ENRICHMENT_ENABLED, true),
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    limit: parseNumber(process.env.LLM_ENRICHMENT_LIMIT, 10),
    readmeMaxChars: parseNumber(process.env.LLM_README_MAX_CHARS, 12_000),
    timeoutMs: parseNumber(process.env.LLM_TIMEOUT_MS, 30_000),
    maxRetries: parseNumber(process.env.LLM_MAX_RETRIES, 2),
    maxOutputTokens: parseNumber(process.env.LLM_MAX_OUTPUT_TOKENS, 1200),
    cachePath: 'data/llm-enrichment-cache.json'
  };
}
