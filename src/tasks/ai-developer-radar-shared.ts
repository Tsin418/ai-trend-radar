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
}

export interface RadarRunResult {
  ok: boolean;
  digest?: RadarDigest;
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

export async function collectAndScoreRadarCandidates(options: RadarRunOptions = {}): Promise<Omit<RadarRunContext, 'digest'>> {
  const collectedAt = new Date().toISOString();
  const profile = loadRadarProfile();
  const repoLimit = options.repoLimit ?? getRadarRepoLimit();
  const store = new JsonRadarStore(getRadarStorePath());
  const searchCollector = createGitHubSearchCollector();
  const watchlist = loadWatchlist();
  const errors: string[] = [];
  let repositories: RadarRepository[] = [];

  if (options.useSampleData || process.env.RADAR_USE_SAMPLE_DATA === 'true') {
    repositories = createSampleRepositories(new Date(collectedAt));
  } else {
    try {
      const trending = await fetchGitHubTrending(Math.min(25, repoLimit));
      const trendingFullNames = trending.map((repo) => repo.fullName);
      const metadata = await searchCollector.fetchByFullNames(trendingFullNames, collectedAt);
      repositories.push(...metadata.map((repo) => ({ ...repo, source: 'github-trending' })));
    } catch (error) {
      errors.push(`GitHub Trending collection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      repositories.push(...await searchCollector.search(profile, repoLimit, collectedAt));
    } catch (error) {
      errors.push(`GitHub Search collection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const watchlistRepos = await searchCollector.fetchByFullNames(watchlist.map((item) => item.repoFullName), collectedAt, watchlist);
      repositories.push(...watchlistRepos);
    } catch (error) {
      errors.push(`Watchlist collection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    errors
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
