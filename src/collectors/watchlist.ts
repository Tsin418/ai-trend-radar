import fs from 'node:fs';
import path from 'node:path';
import type { WatchlistEntry } from '../radar/types.js';

export function loadWatchlist(filePath = 'config/watchlist.yaml'): WatchlistEntry[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return [];

  const lines = fs.readFileSync(resolved, 'utf8').split(/\r?\n/);
  const entries: WatchlistEntry[] = [];
  let currentCategory = '';

  for (const line of lines) {
    const categoryMatch = line.match(/^\s{2}([a-zA-Z0-9_-]+):\s*$/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1];
      continue;
    }

    const repoMatch = line.match(/^\s{4}-\s+([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\s*$/);
    if (repoMatch && currentCategory) {
      entries.push({
        categoryKey: currentCategory,
        repoFullName: repoMatch[1]
      });
    }
  }

  return entries;
}
