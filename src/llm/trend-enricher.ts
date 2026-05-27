import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { LLMEnrichmentConfig } from '../radar/config.js';
import type { TrendEntity, TrendLLMSummary } from '../trends/types.js';
import { callDeepSeekJson } from './deepseek-client.js';
import { TrendLLMSummarySchema } from './schema.js';

interface TrendLLMCacheEntry {
  summary: TrendLLMSummary;
  createdAt: string;
  model: string;
}

type TrendLLMCache = Record<string, TrendLLMCacheEntry>;

export interface TrendEnrichmentResult {
  entities: TrendEntity[];
  warnings: string[];
}

export interface TrendEnrichmentDependencies {
  callJson?: (params: { systemPrompt: string; userPrompt: string; model?: string; timeoutMs?: number }) => Promise<unknown>;
  now?: () => string;
}

const TREND_ANALYST_SYSTEM_PROMPT = [
  'You are an AI trend analyst for a developer-facing dashboard.',
  'Return strict JSON only, with no markdown.',
  'Explain topic-level momentum only. Do not claim any single item caused any repo growth.',
  'Do not overstate adoption or quality. Product Hunt votes are launch attention, not code quality.',
  'HN discussion is developer interest, not commercial adoption.',
  'GitHub stars are attention signals, not proof of production adoption.',
  'If evidence is thin, set confidence to low.'
].join('\n');

function loadCache(cachePath: string): TrendLLMCache {
  if (!fs.existsSync(cachePath)) return {};
  const text = fs.readFileSync(cachePath, 'utf8');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as TrendLLMCache;
  } catch {
    return {};
  }
}

function saveCache(cachePath: string, cache: TrendLLMCache): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function cacheKey(entity: TrendEntity): string {
  return `${entity.id}:${entity.lastSeenAt}:${hash(entity.items.map((item) => item.id).sort().join(','))}`;
}

function buildTrendAnalysisPrompt(entity: TrendEntity): string {
  return JSON.stringify({
    title: entity.title,
    entityType: entity.entityType,
    sources: entity.sources,
    sourceCount: entity.sourceCount,
    category: entity.category,
    metrics: entity.metrics,
    firstSeenAt: entity.firstSeenAt,
    lastSeenAt: entity.lastSeenAt,
    items: entity.items.slice(0, 8).map((item) => ({
      source: item.source,
      type: item.sourceType,
      title: item.title,
      url: item.url,
      summary: item.summary ?? item.description,
      category: item.category,
      metrics: item.metrics,
      publishedAt: item.publishedAt,
      collectedAt: item.collectedAt
    })),
    outputSchema: {
      whatItIs: 'short factual explanation',
      whyNow: 'why this deserves attention now',
      whoShouldCare: 'specific developer/product roles',
      technicalKeywords: ['keyword'],
      businessRelevance: 'business/product relevance without hype',
      developerRelevance: 'actionable developer takeaway',
      watchDecision: 'track | deep_dive | ignore | wait',
      riskNotes: 'uncertainties and caveats',
      confidence: 'low | medium | high'
    },
    instruction: 'Explain topic-level momentum only. Do not claim any single item caused any repo growth.'
  }, null, 2);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function enrichTrendEntitiesWithLLM(
  entities: TrendEntity[],
  options: LLMEnrichmentConfig,
  dependencies: TrendEnrichmentDependencies = {}
): Promise<TrendEnrichmentResult> {
  if (!options.enabled) return { entities, warnings: [] };
  if (!options.apiKey) {
    return {
      entities,
      warnings: ['Trend LLM enrichment skipped: missing DEEPSEEK_API_KEY.']
    };
  }

  const candidates = entities.slice(0, options.limit);
  if (candidates.length === 0) return { entities, warnings: [] };

  const cache = loadCache(options.cachePath);
  const warnings: string[] = [];
  const createdAt = dependencies.now ?? (() => new Date().toISOString());
  const callJson = dependencies.callJson ?? ((params) => callDeepSeekJson(params, {
    apiKey: options.apiKey as string,
    baseUrl: options.baseUrl,
    model: options.model,
    timeoutMs: options.timeoutMs,
    maxRetries: options.maxRetries,
    maxOutputTokens: options.maxOutputTokens
  }));

  const enrichedPairs = await mapWithConcurrency(candidates, 2, async (entity) => {
    const key = cacheKey(entity);
    const cached = cache[key];
    if (cached) {
      const parsed = TrendLLMSummarySchema.safeParse(cached.summary);
      if (parsed.success) return [entity.id, { ...entity, llmSummary: parsed.data }] as const;
    }

    try {
      const rawSummary = await callJson({
        systemPrompt: TREND_ANALYST_SYSTEM_PROMPT,
        userPrompt: buildTrendAnalysisPrompt(entity),
        model: options.model,
        timeoutMs: options.timeoutMs
      });
      const summary = TrendLLMSummarySchema.parse(rawSummary);
      cache[key] = {
        summary,
        createdAt: createdAt(),
        model: options.model
      };
      return [entity.id, { ...entity, llmSummary: summary }] as const;
    } catch (error) {
      warnings.push(`Trend LLM enrichment failed for ${entity.title}: ${error instanceof Error ? error.message : String(error)}`);
      return [entity.id, entity] as const;
    }
  });

  saveCache(options.cachePath, cache);
  const enrichedMap = new Map(enrichedPairs);
  return {
    entities: entities.map((entity) => enrichedMap.get(entity.id) ?? entity),
    warnings
  };
}
