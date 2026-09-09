import fs from 'node:fs';
import path from 'node:path';
import { getRetentionConfig } from '../radar/config.js';

interface CacheFileResult {
  filePath: string;
  prunedEntries: number;
  remainingEntries: number;
}

/**
 * Drop LLM cache entries older than the retention window. All three LLM cache
 * files share the shape `{ [key]: { ..., createdAt: string } }`, so a single
 * helper covers repo enrichment, trend enrichment and digest narrative caches.
 * Entries without a usable `createdAt` are kept so unknown data is never lost.
 */
export function pruneLlmCacheFile(filePath: string, retentionDays: number, now = new Date()): CacheFileResult {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  if (!fs.existsSync(filePath)) return { filePath, prunedEntries: 0, remainingEntries: 0 };

  const text = fs.readFileSync(filePath, 'utf8');
  if (!text.trim()) return { filePath, prunedEntries: 0, remainingEntries: 0 };

  const cache = JSON.parse(text) as Record<string, { createdAt?: string }>;
  const entries = Object.entries(cache);
  const retained = entries.filter(([, value]) => {
    const createdAt = value?.createdAt;
    if (!createdAt) return true;
    const timestamp = Date.parse(createdAt);
    return !Number.isFinite(timestamp) || timestamp >= cutoff;
  });
  const pruned = entries.length - retained.length;
  if (pruned === 0) return { filePath, prunedEntries: 0, remainingEntries: retained.length };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(Object.fromEntries(retained), null, 2)}\n`, 'utf8');
  return { filePath, prunedEntries: pruned, remainingEntries: retained.length };
}

export function pruneLlmCacheFiles(now = new Date()): CacheFileResult[] {
  const config = getRetentionConfig();
  const candidates = [
    'data/llm-enrichment-cache.json',
    'data/llm-trend-enrichment-cache.json',
    'data/llm-digest-narrative-cache.json'
  ];
  return candidates.map((filePath) => pruneLlmCacheFile(filePath, config.llmCacheDays, now));
}
