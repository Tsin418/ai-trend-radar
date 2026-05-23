import { withRetry, defaultShouldRetry } from '../utils/retry.js';
import type { RadarProfile, RadarRepository, WatchlistEntry } from '../radar/types.js';

const GITHUB_API = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

interface GitHubApiRepository {
  full_name: string;
  html_url: string;
  owner: { login: string };
  name: string;
  description: string | null;
  language: string | null;
  topics?: string[];
  created_at: string | null;
  pushed_at: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  archived: boolean;
  fork: boolean;
}

interface GitHubSearchResponse {
  items?: GitHubApiRepository[];
}

export interface GitHubSearchCollectorOptions {
  token?: string;
  perQueryLimit?: number;
}

function requestHeaders(token?: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'AI-Developer-Radar-Bot/0.1',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function assertGitHubResponse(response: Response, bodyText: string): void {
  if (response.ok) return;
  const rateRemaining = response.headers.get('x-ratelimit-remaining');
  const rateReset = response.headers.get('x-ratelimit-reset');
  const resetMessage = rateReset ? ` reset=${new Date(Number(rateReset) * 1000).toISOString()}` : '';
  const rateMessage = rateRemaining === '0' ? ` GitHub API rate limit reached.${resetMessage}` : '';
  throw new Error(`GitHub API request failed: HTTP ${response.status}.${rateMessage} ${bodyText.slice(0, 300)}`.trim());
}

async function fetchJson<T>(url: string, token?: string): Promise<T> {
  return withRetry(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          headers: requestHeaders(token),
          signal: controller.signal
        });
        const bodyText = await response.text();
        assertGitHubResponse(response, bodyText);
        return bodyText ? JSON.parse(bodyText) as T : {} as T;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`GitHub API request timed out: ${url}`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
    {
      maxRetries: MAX_RETRIES,
      initialDelay: 1200,
      shouldRetry: defaultShouldRetry,
      onRetry: (error, attempt, delay) => {
        console.error(`[GitHub Search] retry ${attempt}/${MAX_RETRIES} in ${delay}ms: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}

function mapRepository(repo: GitHubApiRepository, source: string, collectedAt: string, isWatchlist = false): RadarRepository {
  const [owner, name] = repo.full_name.split('/');
  return {
    repoFullName: repo.full_name,
    repoUrl: repo.html_url,
    owner: owner || repo.owner.login,
    name: name || repo.name,
    description: repo.description ?? '',
    language: repo.language,
    topics: repo.topics ?? [],
    category: 'Other AI',
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
    firstSeenAt: collectedAt,
    lastSeenAt: collectedAt,
    source,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    isArchived: repo.archived,
    isFork: repo.fork,
    isWatchlist
  };
}

export class GitHubSearchCollector {
  readonly name = 'github-search';
  private readonly token?: string;
  private readonly perQueryLimit: number;

  constructor(options: GitHubSearchCollectorOptions = {}) {
    this.token = options.token ?? process.env.GITHUB_TOKEN;
    this.perQueryLimit = options.perQueryLimit ?? 10;
  }

  async search(profile: RadarProfile, limit: number, collectedAt: string): Promise<RadarRepository[]> {
    const queries = [
      ...profile.searchTopics.map((topic) => `topic:${topic}`),
      ...profile.searchKeywords
    ];
    const repositories = new Map<string, RadarRepository>();

    for (const query of queries) {
      if (repositories.size >= limit) break;
      const perPage = Math.min(this.perQueryLimit, Math.max(1, limit - repositories.size));
      const url = new URL(`${GITHUB_API}/search/repositories`);
      url.searchParams.set('q', `${query} fork:false archived:false`);
      url.searchParams.set('sort', 'stars');
      url.searchParams.set('order', 'desc');
      url.searchParams.set('per_page', String(perPage));

      const payload = await fetchJson<GitHubSearchResponse>(url.toString(), this.token);
      for (const item of payload.items ?? []) {
        if (!repositories.has(item.full_name)) {
          repositories.set(item.full_name, mapRepository(item, 'github-search', collectedAt));
        }
      }
    }

    return Array.from(repositories.values()).slice(0, limit);
  }

  async fetchByFullNames(fullNames: string[], collectedAt: string, watchlist: WatchlistEntry[] = []): Promise<RadarRepository[]> {
    const watchlistNames = new Set(watchlist.map((item) => item.repoFullName.toLowerCase()));
    const repositories: RadarRepository[] = [];

    for (const fullName of Array.from(new Set(fullNames)).filter(Boolean)) {
      const url = `${GITHUB_API}/repos/${fullName}`;
      const repo = await fetchJson<GitHubApiRepository>(url, this.token);
      repositories.push(mapRepository(repo, watchlistNames.has(fullName.toLowerCase()) ? 'watchlist' : 'github-rest', collectedAt, watchlistNames.has(fullName.toLowerCase())));
    }

    return repositories;
  }
}

export function createGitHubSearchCollector(options: GitHubSearchCollectorOptions = {}): GitHubSearchCollector {
  return new GitHubSearchCollector(options);
}
