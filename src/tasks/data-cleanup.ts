import path from 'node:path';
import { pruneDigestArchive } from '../renderers/archive.js';
import { pruneLlmCacheFiles } from '../storage/cache-cleanup.js';
import type { JsonRadarStore } from '../storage/json-store.js';

export interface DataCleanupResult {
  archive: {
    removedFiles: string[];
    removedEntries: string[];
  };
  store: {
    removedSnapshots: number;
    removedScores: number;
    removedDigestRuns: number;
    removedRepositories: number;
  };
  llmCache: Array<{
    filePath: string;
    prunedEntries: number;
    remainingEntries: number;
  }>;
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Enforce data retention limits after a digest has been written:
 *  - cap archive markdown to a rolling daily/weekly window and drop legacy JSON;
 *  - cap radar-store snapshot/score/digest-run history (the score history must
 *    never shrink below the window the deltas are computed from);
 *  - drop stale LLM cache entries.
 *
 * `store` is optional so callers that only render offline products (RSS,
 * archive rebuild) can still prune the archive and LLM caches.
 */
export function runDataCleanup(store?: JsonRadarStore): DataCleanupResult {
  const archive = pruneDigestArchive();
  const storeResult = store?.pruneHistory() ?? {
    removedSnapshots: 0,
    removedScores: 0,
    removedDigestRuns: 0,
    removedRepositories: 0
  };
  const llmCache = pruneLlmCacheFiles();

  const summaryParts: string[] = [];
  if (archive.removedFiles.length > 0) {
    summaryParts.push(`archive: removed ${countLabel(archive.removedFiles.length, 'file')}`);
  }
  if (archive.removedEntries.length > 0) {
    summaryParts.push(`archive: dropped ${countLabel(archive.removedEntries.length, 'index entry')}`);
  }
  const storeTotals = [
    storeResult.removedSnapshots,
    storeResult.removedScores,
    storeResult.removedDigestRuns,
    storeResult.removedRepositories
  ].reduce((sum, value) => sum + value, 0);
  if (storeTotals > 0) {
    summaryParts.push(
      `store: pruned ${countLabel(storeResult.removedSnapshots, 'snapshot')}, ${countLabel(storeResult.removedScores, 'score')}, ` +
      `${countLabel(storeResult.removedDigestRuns, 'digest run')}, ${countLabel(storeResult.removedRepositories, 'repo entry')}`
    );
  }
  for (const cache of llmCache) {
    if (cache.prunedEntries > 0) {
      summaryParts.push(`${path.basename(cache.filePath)}: pruned ${countLabel(cache.prunedEntries, 'entry')}`);
    }
  }

  console.log(summaryParts.length > 0
    ? `[data cleanup] ${summaryParts.join('; ')}`
    : '[data cleanup] nothing to prune');

  return {
    archive,
    store: storeResult,
    llmCache
  };
}
