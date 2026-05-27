import fs from 'node:fs';
import path from 'node:path';
import { fetchGitHubReadme, fetchLatestReleaseDate } from '../collectors/github-readme.js';
import type { LLMEnrichmentConfig } from '../radar/config.js';
import type { RadarDigest, RepoLLMSummary, ScoredRadarRepository } from '../radar/types.js';
import type { TrendItem } from '../trends/types.js';
import { callDeepSeekJson } from './deepseek-client.js';
import { buildRepoAnalysisPrompt, type RepoExternalBuzz, REPO_ANALYST_SYSTEM_PROMPT } from './prompts.js';
import { RepoLLMSummarySchema } from './schema.js';

interface LLMCacheEntry {
  summary: RepoLLMSummary;
  createdAt: string;
  model: string;
}

type LLMCache = Record<string, LLMCacheEntry>;

export interface LLMEnrichmentDependencies {
  callJson?: (params: { systemPrompt: string; userPrompt: string; model?: string; timeoutMs?: number }) => Promise<unknown>;
  fetchReadme?: (repoFullName: string) => Promise<{ content: string }>;
  fetchLatestReleaseDate?: (repoFullName: string) => Promise<string | null>;
  now?: () => string;
  externalBuzzByRepoFullName?: Map<string, RepoExternalBuzz[]>;
}

export interface LLMEnrichmentResult {
  repos: ScoredRadarRepository[];
  warnings: string[];
}

export interface RadarDigestEnrichmentResult {
  digest: RadarDigest;
  warnings: string[];
}

function cacheKey(item: ScoredRadarRepository): string {
  return `${item.repository.repoFullName}:${item.repository.pushedAt ?? 'unknown'}`;
}

function loadCache(cachePath: string): LLMCache {
  if (!fs.existsSync(cachePath)) return {};
  const text = fs.readFileSync(cachePath, 'utf8');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as LLMCache;
  } catch {
    return {};
  }
}

function saveCache(cachePath: string, cache: LLMCache): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function uniqueRepos(repos: ScoredRadarRepository[]): ScoredRadarRepository[] {
  const seen = new Set<string>();
  const result: ScoredRadarRepository[] = [];
  for (const item of repos) {
    if (seen.has(item.repository.repoFullName)) continue;
    seen.add(item.repository.repoFullName);
    result.push(item);
  }
  return result;
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

function withReadmeFallback(summary: RepoLLMSummary, readmeUnavailable: boolean): RepoLLMSummary {
  if (!readmeUnavailable) return summary;
  const riskNote = summary.riskNotes.toLowerCase().includes('readme unavailable')
    ? summary.riskNotes
    : `${summary.riskNotes} README unavailable; this summary relies on repository metadata only.`;

  return {
    ...summary,
    riskNotes: riskNote,
    confidence: 'low'
  };
}

function normalizeSummary(summary: RepoLLMSummary): RepoLLMSummary {
  return {
    ...summary,
    whyTrending: summary.whyTrending || summary.whyNow,
    developerTakeaway: summary.developerTakeaway || summary.developerInsight,
    developerInsight: summary.developerInsight || summary.developerTakeaway
  };
}

export async function enrichReposWithLLM(
  repos: ScoredRadarRepository[],
  options: LLMEnrichmentConfig,
  dependencies: LLMEnrichmentDependencies = {}
): Promise<LLMEnrichmentResult> {
  if (!options.enabled) {
    return { repos, warnings: [] };
  }

  if (!options.apiKey) {
    return {
      repos,
      warnings: ['LLM enrichment skipped: missing DEEPSEEK_API_KEY.']
    };
  }

  const limitedRepos = uniqueRepos(repos).slice(0, options.limit);
  if (limitedRepos.length === 0) {
    return { repos, warnings: [] };
  }

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
  const fetchReadme = dependencies.fetchReadme ?? ((repoFullName: string) => fetchGitHubReadme(repoFullName, process.env.GITHUB_TOKEN));
  const fetchReleaseDate = dependencies.fetchLatestReleaseDate ?? ((repoFullName: string) => fetchLatestReleaseDate(repoFullName, process.env.GITHUB_TOKEN));

  const enrichedPairs = await mapWithConcurrency(limitedRepos, 2, async (item) => {
    const key = cacheKey(item);
    const cached = cache[key];
    if (cached) {
      const parsed = RepoLLMSummarySchema.safeParse(cached.summary);
      if (parsed.success) {
        return [item.repository.repoFullName, { ...item, llmSummary: parsed.data }] as const;
      }
    }

    let readmeExcerpt = '';
    let readmeUnavailable = false;
    try {
      const readme = await fetchReadme(item.repository.repoFullName);
      readmeExcerpt = readme.content.slice(0, options.readmeMaxChars);
    } catch (error) {
      readmeUnavailable = true;
      readmeExcerpt = `README unavailable. Analyze using metadata only. Fetch error: ${error instanceof Error ? error.message : String(error)}`;
    }

    let hasRecentRelease: boolean | null = null;
    try {
      const latestReleaseDate = await fetchReleaseDate(item.repository.repoFullName);
      if (latestReleaseDate) {
        const releaseAgeMs = Date.parse(createdAt()) - Date.parse(latestReleaseDate);
        hasRecentRelease = Number.isFinite(releaseAgeMs) ? releaseAgeMs <= 30 * 24 * 60 * 60 * 1000 : null;
      } else {
        hasRecentRelease = false;
      }
    } catch {
      hasRecentRelease = null;
    }

    try {
      const rawSummary = await callJson({
        systemPrompt: REPO_ANALYST_SYSTEM_PROMPT,
        userPrompt: buildRepoAnalysisPrompt(
          item,
          readmeExcerpt,
          dependencies.externalBuzzByRepoFullName?.get(item.repository.repoFullName) ?? [],
          hasRecentRelease
        ),
        model: options.model,
        timeoutMs: options.timeoutMs
      });
      const parsed = normalizeSummary(RepoLLMSummarySchema.parse(rawSummary));
      const summary = withReadmeFallback(parsed, readmeUnavailable);
      cache[key] = {
        summary,
        createdAt: createdAt(),
        model: options.model
      };
      return [item.repository.repoFullName, { ...item, llmSummary: summary }] as const;
    } catch (error) {
      warnings.push(`LLM enrichment failed for ${item.repository.repoFullName}: ${error instanceof Error ? error.message : String(error)}`);
      return [item.repository.repoFullName, item] as const;
    }
  });

  saveCache(options.cachePath, cache);
  const enrichedMap = new Map(enrichedPairs);
  return {
    repos: repos.map((item) => enrichedMap.get(item.repository.repoFullName) ?? item),
    warnings
  };
}

function replaceRepos(items: ScoredRadarRepository[], enriched: Map<string, ScoredRadarRepository>): ScoredRadarRepository[] {
  return items.map((item) => enriched.get(item.repository.repoFullName) ?? item);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWordBoundaryMatch(text: string, needle: string): boolean {
  const regex = new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`, 'i');
  return regex.test(text);
}

function buildHackerNewsBuzzByRepo(items: TrendItem[] | undefined, repos: ScoredRadarRepository[]): Map<string, RepoExternalBuzz[]> {
  const result = new Map<string, RepoExternalBuzz[]>();
  if (!items?.length) return result;
  const hnItems = items.filter((item) => item.source === 'hackernews' || item.sourceType === 'developer_discussion');

  for (const repo of repos) {
    const fullName = repo.repository.repoFullName.toLowerCase();
    const name = repo.repository.name.toLowerCase();
    const allowNameMatch = name.length >= 5;
    const matches = hnItems.filter((item) => {
      const text = [item.title, item.url, item.summary, item.description, item.originalUrl]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(fullName) || (allowNameMatch && hasWordBoundaryMatch(text, name));
    });
    if (matches.length === 0) continue;
    const top = [...matches].sort((a, b) => (b.metrics?.upvotes ?? 0) - (a.metrics?.upvotes ?? 0))[0];
    result.set(repo.repository.repoFullName, [{
      source: 'hackernews',
      discussionCount: matches.length,
      topPostTitle: top.title,
      topPostUrl: top.url
    }]);
  }

  return result;
}

export async function enrichRadarDigestWithLLM(
  digest: RadarDigest,
  options: LLMEnrichmentConfig,
  dependencies: LLMEnrichmentDependencies = {}
): Promise<RadarDigestEnrichmentResult> {
  const candidates = uniqueRepos([
    ...digest.selectedProjects,
    ...digest.hotProjects,
    ...digest.earlySignals,
    ...digest.watchlistMovements,
    ...(digest.researchPicks ?? [])
  ]);
  const externalBuzzByRepoFullName = dependencies.externalBuzzByRepoFullName ?? buildHackerNewsBuzzByRepo(digest.multiSourceItems, candidates);
  const result = await enrichReposWithLLM(candidates, options, {
    ...dependencies,
    externalBuzzByRepoFullName
  });
  const enriched = new Map(result.repos.map((item) => [item.repository.repoFullName, item]));

  return {
    warnings: result.warnings,
    digest: {
      ...digest,
      hotProjects: replaceRepos(digest.hotProjects, enriched),
      earlySignals: replaceRepos(digest.earlySignals, enriched),
      watchlistMovements: replaceRepos(digest.watchlistMovements, enriched),
      selectedProjects: replaceRepos(digest.selectedProjects, enriched),
      researchPicks: digest.researchPicks ? replaceRepos(digest.researchPicks, enriched) : digest.researchPicks
    }
  };
}
