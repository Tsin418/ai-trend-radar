import fs from 'node:fs';
import path from 'node:path';
import type {
  FeedbackEntry,
  FeedbackStoreData,
  RadarRepository,
  RadarRunMode,
  RadarStoreData,
  RepoScore,
  RepoSnapshot
} from '../radar/types.js';

function emptyStore(): RadarStoreData {
  return {
    repositories: {},
    snapshots: [],
    scores: [],
    digestRuns: []
  };
}

function emptyFeedbackStore(): FeedbackStoreData {
  return {
    entries: []
  };
}

function safeDate(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export class JsonRadarStore {
  constructor(private readonly filePath: string) {}

  load(): RadarStoreData {
    if (!fs.existsSync(this.filePath)) return emptyStore();
    const text = fs.readFileSync(this.filePath, 'utf8');
    if (!text.trim()) return emptyStore();
    const parsed = JSON.parse(text) as Partial<RadarStoreData>;

    return {
      repositories: parsed.repositories ?? {},
      snapshots: parsed.snapshots ?? [],
      scores: parsed.scores ?? [],
      digestRuns: parsed.digestRuns ?? []
    };
  }

  save(data: RadarStoreData): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }

  upsertRepositories(repositories: RadarRepository[], collectedAt: string): RadarStoreData {
    const data = this.load();

    for (const repo of repositories) {
      const existing = data.repositories[repo.repoFullName];
      data.repositories[repo.repoFullName] = {
        ...repo,
        firstSeenAt: existing?.firstSeenAt ?? repo.firstSeenAt ?? collectedAt,
        lastSeenAt: collectedAt,
        source: mergeSource(existing?.source, repo.source),
        isWatchlist: Boolean(existing?.isWatchlist || repo.isWatchlist)
      };
    }

    this.save(data);
    return data;
  }

  addSnapshots(snapshots: RepoSnapshot[]): RadarStoreData {
    const data = this.load();
    const existingKeys = new Set(data.snapshots.map((item) => `${item.repoFullName}:${item.collectedAt.slice(0, 10)}`));
    const nextSnapshots = snapshots.filter((item) => !existingKeys.has(`${item.repoFullName}:${item.collectedAt.slice(0, 10)}`));
    data.snapshots.push(...nextSnapshots);
    data.snapshots.sort((a, b) => safeDate(a.collectedAt) - safeDate(b.collectedAt));
    this.save(data);
    return data;
  }

  addScores(scores: RepoScore[]): RadarStoreData {
    const data = this.load();
    const scoreKeys = new Set(scores.map((item) => `${item.repoFullName}:${item.scoreDate}`));
    data.scores = data.scores.filter((item) => !scoreKeys.has(`${item.repoFullName}:${item.scoreDate}`));
    data.scores.push(...scores);
    data.scores.sort((a, b) => safeDate(a.scoreDate) - safeDate(b.scoreDate));
    this.save(data);
    return data;
  }

  recordDigestRun(runType: RadarRunMode, startedAt: string, status: 'success' | 'failed', selectedRepoCount: number, errorMessage?: string): void {
    const data = this.load();
    data.digestRuns.push({
      id: `${runType}-${startedAt}`,
      runType,
      startedAt,
      finishedAt: new Date().toISOString(),
      status,
      selectedRepoCount,
      errorMessage
    });
    this.save(data);
  }

  findSnapshotAtOrBefore(repoFullName: string, collectedAt: string, daysAgo: number): RepoSnapshot | undefined {
    const data = this.load();
    const target = Date.parse(collectedAt) - daysAgo * 24 * 60 * 60 * 1000;
    const sameRepo = data.snapshots
      .filter((item) => item.repoFullName === repoFullName && safeDate(item.collectedAt) <= target)
      .sort((a, b) => safeDate(b.collectedAt) - safeDate(a.collectedAt));

    return sameRepo[0];
  }

  findSnapshotsAtDailyOffsets(repoFullName: string, collectedAt: string, maxDaysAgo: number): Array<{ daysAgo: number; snapshot: RepoSnapshot }> {
    const data = this.load();
    const result: Array<{ daysAgo: number; snapshot: RepoSnapshot }> = [];

    for (let daysAgo = 1; daysAgo <= maxDaysAgo; daysAgo += 1) {
      const target = Date.parse(collectedAt) - daysAgo * 24 * 60 * 60 * 1000;
      const snapshot = data.snapshots
        .filter((item) => item.repoFullName === repoFullName && safeDate(item.collectedAt) <= target)
        .sort((a, b) => safeDate(b.collectedAt) - safeDate(a.collectedAt))[0];
      if (snapshot) {
        result.push({ daysAgo, snapshot });
      }
    }

    return result;
  }
}

export class JsonFeedbackStore {
  constructor(private readonly filePath: string) {}

  load(): FeedbackStoreData {
    if (!fs.existsSync(this.filePath)) return emptyFeedbackStore();
    const text = fs.readFileSync(this.filePath, 'utf8');
    if (!text.trim()) return emptyFeedbackStore();
    const parsed = JSON.parse(text) as Partial<FeedbackStoreData>;
    return {
      entries: parsed.entries ?? []
    };
  }

  save(data: FeedbackStoreData): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }

  addEntry(entry: FeedbackEntry): FeedbackStoreData {
    const data = this.load();
    data.entries.push(entry);
    data.entries.sort((a, b) => safeDate(a.feedbackAt) - safeDate(b.feedbackAt));
    this.save(data);
    return data;
  }
}

function mergeSource(a: string | undefined, b: string): string {
  const parts = new Set([...(a?.split(',') ?? []), ...b.split(',')].map((item) => item.trim()).filter(Boolean));
  return Array.from(parts).join(',');
}

export function createSnapshots(repositories: RadarRepository[], collectedAt: string): RepoSnapshot[] {
  return repositories.map((repo) => ({
    repoFullName: repo.repoFullName,
    stars: repo.stars,
    forks: repo.forks,
    openIssues: repo.openIssues,
    pushedAt: repo.pushedAt,
    collectedAt
  }));
}
