import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { LLMEnrichmentConfig } from '../radar/config.js';
import type { RadarDigest, WeeklyNarrative } from '../radar/types.js';
import { callDeepSeekJson } from './deepseek-client.js';
import {
  buildDigestNarrativePrompt,
  buildWeeklyAnalysisPrompt,
  DIGEST_NARRATIVE_SYSTEM_PROMPT,
  WEEKLY_ANALYST_SYSTEM_PROMPT
} from './prompts.js';

interface DailyNarrative {
  headline: string;
  narrative: string;
  categoryMomentum: string;
  notableAbsences: string;
}

interface NarrativeCacheEntry {
  value: DailyNarrative | WeeklyNarrative;
  createdAt: string;
  model: string;
}

type NarrativeCache = Record<string, NarrativeCacheEntry>;

export interface DigestNarrativeResult {
  digest: RadarDigest;
  warnings: string[];
}

function digestProjectHash(digest: RadarDigest): string {
  const payload = JSON.stringify({
    mode: digest.mode,
    date: digest.date,
    projects: digest.selectedProjects.slice(0, 10).map((item) => ({
      name: item.repository.repoFullName,
      pushedAt: item.repository.pushedAt,
      daily: item.score.dailyStarDelta,
      weekly: item.score.weeklyStarDelta,
      acceleration: item.score.acceleration
    })),
    changes: digest.changesFromYesterday ?? null
  });
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function cacheKey(digest: RadarDigest, kind: 'daily' | 'weekly'): string {
  return `${kind}:${digest.date}:${digestProjectHash(digest)}`;
}

function loadCache(cachePath: string): NarrativeCache {
  if (!fs.existsSync(cachePath)) return {};
  const text = fs.readFileSync(cachePath, 'utf8');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as NarrativeCache;
  } catch {
    return {};
  }
}

function saveCache(cachePath: string, cache: NarrativeCache): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function isDailyNarrative(value: unknown): value is DailyNarrative {
  const item = value as Partial<DailyNarrative>;
  return typeof item?.headline === 'string' && typeof item.narrative === 'string';
}

function isWeeklyNarrative(value: unknown): value is WeeklyNarrative {
  const item = value as Partial<WeeklyNarrative>;
  return typeof item?.weeklyOverview === 'string' &&
    typeof item.hottestDirection === 'string' &&
    Array.isArray(item.notableProjects) &&
    typeof item.earlySignals === 'string' &&
    typeof item.developerBuzz === 'string' &&
    typeof item.developerTakeaway === 'string';
}

function missingConfigResult(digest: RadarDigest, options: LLMEnrichmentConfig): DigestNarrativeResult | null {
  if (!options.enabled) return { digest, warnings: [] };
  if (!options.apiKey) return { digest, warnings: ['Digest narrative skipped: missing DEEPSEEK_API_KEY.'] };
  return null;
}

export async function enrichDailyDigestNarrative(
  digest: RadarDigest,
  options: LLMEnrichmentConfig
): Promise<DigestNarrativeResult> {
  const missing = missingConfigResult(digest, options);
  if (missing) return missing;

  const cache = loadCache(options.cachePath);
  const key = cacheKey(digest, 'daily');
  const cached = cache[key]?.value;
  if (isDailyNarrative(cached)) {
    return {
      digest: { ...digest, headline: cached.headline, summary: cached.narrative },
      warnings: []
    };
  }

  try {
    const narrative = await callDeepSeekJson<DailyNarrative>({
      systemPrompt: DIGEST_NARRATIVE_SYSTEM_PROMPT,
      userPrompt: buildDigestNarrativePrompt(digest),
      model: options.model,
      timeoutMs: options.timeoutMs
    }, {
      apiKey: options.apiKey as string,
      baseUrl: options.baseUrl,
      model: options.model,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      maxOutputTokens: Math.min(options.maxOutputTokens, 800)
    });
    if (!isDailyNarrative(narrative)) {
      throw new Error('Digest narrative response did not match expected shape');
    }
    cache[key] = { value: narrative, createdAt: new Date().toISOString(), model: options.model };
    saveCache(options.cachePath, cache);
    return {
      digest: { ...digest, headline: narrative.headline, summary: narrative.narrative },
      warnings: []
    };
  } catch (error) {
    return {
      digest,
      warnings: [`Digest narrative LLM failed, using template fallback: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

export async function enrichWeeklyDigestNarrative(
  digest: RadarDigest,
  options: LLMEnrichmentConfig
): Promise<DigestNarrativeResult> {
  const missing = missingConfigResult(digest, options);
  if (missing) return missing;

  const cache = loadCache(options.cachePath);
  const key = cacheKey(digest, 'weekly');
  const cached = cache[key]?.value;
  if (isWeeklyNarrative(cached)) {
    return {
      digest: { ...digest, weeklyNarrative: cached, summary: cached.weeklyOverview },
      warnings: []
    };
  }

  try {
    const narrative = await callDeepSeekJson<WeeklyNarrative>({
      systemPrompt: WEEKLY_ANALYST_SYSTEM_PROMPT,
      userPrompt: buildWeeklyAnalysisPrompt(digest),
      model: options.model,
      timeoutMs: options.timeoutMs
    }, {
      apiKey: options.apiKey as string,
      baseUrl: options.baseUrl,
      model: options.model,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      maxOutputTokens: Math.max(options.maxOutputTokens, 1000)
    });
    if (!isWeeklyNarrative(narrative)) {
      throw new Error('Weekly narrative response did not match expected shape');
    }
    cache[key] = { value: narrative, createdAt: new Date().toISOString(), model: options.model };
    saveCache(options.cachePath, cache);
    return {
      digest: { ...digest, weeklyNarrative: narrative, summary: narrative.weeklyOverview },
      warnings: []
    };
  } catch (error) {
    return {
      digest,
      warnings: [`Weekly narrative LLM failed, using template fallback: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}
