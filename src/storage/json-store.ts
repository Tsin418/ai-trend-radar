import fs from 'node:fs';
import path from 'node:path';
import type {
  FeedbackEntry,
  FeedbackStoreData,
  RadarRepository,
  RadarRunMode,
  RadarStoreData,
  RepoScore,
  RepoSnapshot,
  WatchlistState
} from '../radar/types.js';
import { getWatchlistLifecycleConfig } from '../radar/config.js';
import type { WatchlistEntry } from '../radar/types.js';

function emptyStore(): RadarStoreData {
  return {
    repositories: {},
    snapshots: [],
    scores: [],
    hotProjectAppearances: {},
    digestRuns: [],
    watchlist: {}
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

function dayTimestamp(date: string): number {
  return safeDate(`${date.slice(0, 10)}T00:00:00.000Z`);
}

function daysBetween(from: string | undefined, to: string): number | null {
  if (!from) return null;
  const start = dayTimestamp(from);
  const end = dayTimestamp(to);
  if (!start || !end) return null;
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

function pruneDates(dates: string[], date: string, windowDays: number): string[] {
  const cutoff = dayTimestamp(date) - (windowDays - 1) * 24 * 60 * 60 * 1000;
  return Array.from(new Set(dates.map((item) => item.slice(0, 10))))
    .filter((item) => dayTimestamp(item) >= cutoff)
    .sort();
}

function watchlistMeta(state: WatchlistState | undefined): Pick<RadarRepository, 'isWatchlist' | 'watchlistSource' | 'watchlistStatus' | 'watchlistPromotedAt' | 'watchlistLastMovementAt' | 'watchlistPromotedReason'> {
  return {
    isWatchlist: Boolean(state && state.status !== 'archived'),
    watchlistSource: state?.source,
    watchlistStatus: state?.status,
    watchlistPromotedAt: state?.promotedAt,
    watchlistLastMovementAt: state?.lastMovementAt,
    watchlistPromotedReason: state?.promotedReason
  };
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
      hotProjectAppearances: parsed.hotProjectAppearances ?? {},
      digestRuns: parsed.digestRuns ?? [],
      watchlist: parsed.watchlist ?? {}
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
      const state = data.watchlist[repo.repoFullName];
      data.repositories[repo.repoFullName] = {
        ...repo,
        firstSeenAt: existing?.firstSeenAt ?? repo.firstSeenAt ?? collectedAt,
        lastSeenAt: collectedAt,
        source: mergeSource(existing?.source, repo.source),
        ...watchlistMeta(state ?? (repo.isWatchlist ? {
          repoFullName: repo.repoFullName,
          source: 'manual',
          status: 'manual_active',
          hotAppearanceDates: []
        } : undefined))
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

  getWatchlistState(repoFullName: string): WatchlistState | undefined {
    return this.load().watchlist[repoFullName];
  }

  upsertWatchlistState(state: WatchlistState): RadarStoreData {
    const data = this.load();
    data.watchlist[state.repoFullName] = state;
    const repo = data.repositories[state.repoFullName];
    if (repo) {
      data.repositories[state.repoFullName] = {
        ...repo,
        ...watchlistMeta(state)
      };
    }
    this.save(data);
    return data;
  }

  syncManualWatchlist(entries: WatchlistEntry[], date: string): RadarStoreData {
    const data = this.load();
    const names = new Set(entries.map((item) => item.repoFullName));

    for (const repoFullName of names) {
      const existing = data.watchlist[repoFullName];
      const state: WatchlistState = {
        repoFullName,
        source: 'manual',
        status: 'manual_active',
        hotAppearanceDates: existing?.hotAppearanceDates ?? [],
        promotedAt: existing?.promotedAt,
        promotedReason: existing?.promotedReason,
        lastMovementAt: existing?.lastMovementAt,
        reactivatedAt: existing?.status === 'archived' ? date : existing?.reactivatedAt,
        reactivatedReason: existing?.status === 'archived' ? 'Manual watchlist entry is active again.' : existing?.reactivatedReason
      };
      data.watchlist[repoFullName] = state;
      if (data.repositories[repoFullName]) {
        data.repositories[repoFullName] = {
          ...data.repositories[repoFullName],
          ...watchlistMeta(state)
        };
      }
    }

    this.save(data);
    return data;
  }

  getActiveWatchlistNames(): Set<string> {
    const data = this.load();
    return new Set(Object.values(data.watchlist)
      .filter((item) => item.status === 'manual_active' || item.status === 'auto_active' || item.status === 'cooling')
      .map((item) => item.repoFullName));
  }

  getAutoWatchlistNamesToFetch(): string[] {
    const data = this.load();
    return Object.values(data.watchlist)
      .filter((item) => item.source === 'auto' && (item.status === 'auto_active' || item.status === 'cooling'))
      .map((item) => item.repoFullName);
  }

  recordHotAppearance(repoFullName: string, date: string): WatchlistState {
    const config = getWatchlistLifecycleConfig();
    const data = this.load();
    const existing = data.watchlist[repoFullName];
    const hotAppearanceDates = pruneDates([...(existing?.hotAppearanceDates ?? data.hotProjectAppearances[repoFullName] ?? []), date], date, config.hotWindowDays);
    data.hotProjectAppearances[repoFullName] = hotAppearanceDates;
    const state: WatchlistState = existing
      ? {
          ...existing,
          hotAppearanceDates
        }
      : {
          repoFullName,
          source: 'auto',
          status: 'archived',
          hotAppearanceDates
        };

    if (existing?.status === 'archived') {
      state.status = 'auto_active';
      state.reactivatedAt = date;
      state.reactivatedReason = `Archived project met Hot Projects criteria again on ${date}.`;
      state.archivedAt = existing.archivedAt;
      state.archivedReason = existing.archivedReason;
      state.coolingStartedAt = undefined;
    }

    if (existing) data.watchlist[repoFullName] = state;
    if (existing && data.repositories[repoFullName]) {
      data.repositories[repoFullName] = {
        ...data.repositories[repoFullName],
        ...watchlistMeta(state)
      };
    }
    this.save(data);
    return state;
  }

  promoteToAutoWatchlist(repoFullName: string, date: string, reason: string): WatchlistState {
    const data = this.load();
    const existing = data.watchlist[repoFullName];
    const state: WatchlistState = {
      repoFullName,
      source: 'auto',
      status: 'auto_active',
      promotedAt: existing?.promotedAt ?? date,
      promotedReason: existing?.promotedReason ?? reason,
      hotAppearanceDates: existing?.hotAppearanceDates ?? data.hotProjectAppearances[repoFullName] ?? [date],
      lastMovementAt: existing?.lastMovementAt,
      reactivatedAt: existing?.reactivatedAt,
      reactivatedReason: existing?.reactivatedReason
    };
    data.watchlist[repoFullName] = state;
    if (data.repositories[repoFullName]) {
      data.repositories[repoFullName] = {
        ...data.repositories[repoFullName],
        ...watchlistMeta(state)
      };
    }
    this.save(data);
    return state;
  }

  recordWatchlistMovement(repoFullName: string, date: string): WatchlistState {
    const data = this.load();
    const existing = data.watchlist[repoFullName];
    const state: WatchlistState = {
      repoFullName,
      source: existing?.source ?? 'auto',
      status: existing?.source === 'manual' || existing?.status === 'manual_active' ? 'manual_active' : 'auto_active',
      promotedAt: existing?.promotedAt,
      promotedReason: existing?.promotedReason,
      hotAppearanceDates: existing?.hotAppearanceDates ?? [],
      lastMovementAt: date,
      reactivatedAt: existing?.reactivatedAt,
      reactivatedReason: existing?.reactivatedReason
    };
    data.watchlist[repoFullName] = state;
    if (data.repositories[repoFullName]) {
      data.repositories[repoFullName] = {
        ...data.repositories[repoFullName],
        ...watchlistMeta(state)
      };
    }
    this.save(data);
    return state;
  }

  updateWatchlistLifecycle(date: string): void {
    const config = getWatchlistLifecycleConfig();
    const data = this.load();
    let changed = false;

    for (const state of Object.values(data.watchlist)) {
      if (state.source === 'manual' || state.status === 'manual_active' || state.status === 'archived') continue;

      if (state.status === 'auto_active') {
        const anchor = state.lastMovementAt ?? state.promotedAt;
        const inactiveDays = daysBetween(anchor, date);
        if (inactiveDays !== null && inactiveDays >= config.inactiveDays) {
          state.status = 'cooling';
          state.coolingStartedAt = date;
          changed = true;
        }
      } else if (state.status === 'cooling') {
        const coolingDays = daysBetween(state.coolingStartedAt, date);
        if (coolingDays !== null && coolingDays >= config.coolingDays) {
          state.status = 'archived';
          state.archivedAt = date;
          state.archivedReason = `No watchlist movement for ${config.inactiveDays + config.coolingDays} days.`;
          changed = true;
        }
      }

      const repo = data.repositories[state.repoFullName];
      if (repo) {
        data.repositories[state.repoFullName] = {
          ...repo,
          ...watchlistMeta(state)
        };
      }
    }

    if (changed) this.save(data);
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
