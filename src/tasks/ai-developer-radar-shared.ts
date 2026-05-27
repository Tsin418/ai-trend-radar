import type { TrendingDigest } from '../trending/types.js';
import { fetchGitHubTrending } from '../collectors/github-trending.js';
import { createGitHubSearchCollector } from '../collectors/github-search.js';
import { loadWatchlist } from '../collectors/watchlist.js';
import { loadRadarProfile, getRadarRepoLimit, getRadarRecommendationLimit, getRadarStorePath } from '../radar/config.js';
import { createSampleRepositories } from '../radar/sample-data.js';
import type { RadarDigest, RadarRepository, ScoredRadarRepository } from '../radar/types.js';
import { JsonRadarStore, createSnapshots } from '../storage/json-store.js';
import { createPotentialScoreRanker } from '../rankers/potential-score.js';
import { createFeishuNotifier } from '../notifiers/feishu.js';
import type { NotifyResult } from '../notifiers/types.js';
import type { SourceHealth, SourceHealthName } from '../trends/types.js';

export interface RadarRunOptions {
  send?: boolean;
  repoLimit?: number;
  recommendationLimit?: number;
  baselineOnly?: boolean;
  useSampleData?: boolean;
}

export interface RadarRunContext {
  digest: RadarDigest;
  scored: ScoredRadarRepository[];
  store: JsonRadarStore;
  errors: string[];
  sourceHealth: SourceHealth[];
}

export interface RadarRunResult {
  ok: boolean;
  digest?: RadarDigest;
  scored?: ScoredRadarRepository[];
  store?: JsonRadarStore;
  notify?: NotifyResult;
  error?: string;
}

function dedupeRepositories(repositories: RadarRepository[]): RadarRepository[] {
  const map = new Map<string, RadarRepository>();

  for (const repo of repositories) {
    const existing = map.get(repo.repoFullName);
    if (!existing) {
      map.set(repo.repoFullName, repo);
      continue;
    }
    map.set(repo.repoFullName, {
      ...existing,
      ...repo,
      source: Array.from(new Set([...existing.source.split(','), ...repo.source.split(',')])).join(','),
      isWatchlist: existing.isWatchlist || repo.isWatchlist,
      topics: Array.from(new Set([...existing.topics, ...repo.topics]))
    });
  }

  return Array.from(map.values());
}

function createSkippedHealth(source: SourceHealthName, startedAt: string, warning: string): SourceHealth {
  return {
    source,
    enabled: false,
    success: true,
    itemCount: 0,
    startedAt,
    finishedAt: startedAt,
    latencyMs: 0,
    warning
  };
}

async function collectWithHealth(
  source: SourceHealthName,
  collect: () => Promise<RadarRepository[]>
): Promise<{ repositories: RadarRepository[]; health: SourceHealth; error?: string }> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  try {
    const repositories = await collect();
    const finishedAt = new Date().toISOString();
    return {
      repositories,
      health: {
        source,
        enabled: true,
        success: true,
        itemCount: repositories.length,
        startedAt,
        finishedAt,
        latencyMs: Date.now() - start
      }
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    return {
      repositories: [],
      error: `${source} collection failed: ${message}`,
      health: {
        source,
        enabled: true,
        success: false,
        itemCount: 0,
        startedAt,
        finishedAt,
        latencyMs: Date.now() - start,
        error: message
      }
    };
  }
}

export async function collectAndScoreRadarCandidates(options: RadarRunOptions = {}): Promise<Omit<RadarRunContext, 'digest'>> {
  const collectedAt = new Date().toISOString();
  const profile = loadRadarProfile();
  const repoLimit = options.repoLimit ?? getRadarRepoLimit();
  const store = new JsonRadarStore(getRadarStorePath());
  const searchCollector = createGitHubSearchCollector();
  const watchlist = loadWatchlist();
  const errors: string[] = [];
  const sourceHealth: SourceHealth[] = [];
  let repositories: RadarRepository[] = [];
  const useSampleData = options.useSampleData || process.env.RADAR_USE_SAMPLE_DATA === 'true';

  if (useSampleData) {
    repositories = createSampleRepositories(new Date(collectedAt));
    const warning = 'Sample data mode; live collection skipped.';
    sourceHealth.push(
      createSkippedHealth('github-trending', collectedAt, warning),
      {
        ...createSkippedHealth('github-search', collectedAt, warning),
        itemCount: repositories.length
      },
      createSkippedHealth('watchlist', collectedAt, warning)
    );
  } else {
    const trending = await collectWithHealth('github-trending', async () => {
      const trending = await fetchGitHubTrending(Math.min(25, repoLimit));
      const trendingFullNames = trending.map((repo) => repo.fullName);
      const metadata = await searchCollector.fetchByFullNames(trendingFullNames, collectedAt);
      return metadata.map((repo) => ({ ...repo, source: 'github-trending' }));
    });
    repositories.push(...trending.repositories);
    sourceHealth.push(trending.health);
    if (trending.error) errors.push(`GitHub Trending collection failed: ${trending.health.error}`);

    const search = await collectWithHealth('github-search', () => searchCollector.search(profile, repoLimit, collectedAt));
    repositories.push(...search.repositories);
    sourceHealth.push(search.health);
    if (search.error) errors.push(`GitHub Search collection failed: ${search.health.error}`);

    const watchlistResult = await collectWithHealth('watchlist', () => searchCollector.fetchByFullNames(watchlist.map((item) => item.repoFullName), collectedAt, watchlist));
    repositories.push(...watchlistResult.repositories);
    sourceHealth.push(watchlistResult.health);
    if (watchlistResult.error) errors.push(`Watchlist collection failed: ${watchlistResult.health.error}`);
  }

  const deduped = dedupeRepositories(repositories).slice(0, repoLimit);
  store.upsertRepositories(deduped, collectedAt);
  store.addSnapshots(createSnapshots(deduped, collectedAt));

  const ranker = createPotentialScoreRanker();
  const scored = ranker.score(deduped, profile, store, collectedAt);
  store.upsertRepositories(scored.map((item) => item.repository), collectedAt);
  store.addScores(scored.map((item) => item.score));

  return {
    scored,
    store,
    errors,
    sourceHealth
  };
}

export async function maybeSendRadarDigest(digest: RadarDigest, send = false): Promise<NotifyResult | undefined> {
  if (!send) return undefined;
  const notifier = createFeishuNotifier();
  return notifier.notify({
    digest: digest as unknown as TrendingDigest,
    radarDigest: digest
  });
}

export function getRadarLimits(options: RadarRunOptions): { repoLimit: number; recommendationLimit: number } {
  return {
    repoLimit: options.repoLimit ?? getRadarRepoLimit(),
    recommendationLimit: options.recommendationLimit ?? getRadarRecommendationLimit()
  };
}

export function appendErrorsToDigest(digest: RadarDigest, errors: string[]): RadarDigest {
  if (errors.length === 0) return digest;
  return {
    ...digest,
    dataNotes: [...digest.dataNotes, ...errors.map((error) => `Collector warning: ${error}`)]
  };
}
