import { buildDailyIntelligenceBrief } from '../intelligence/intelligence-brief.js';
import type { IntelligenceBrief } from '../intelligence/types.js';
import { getRadarStorePath } from '../radar/config.js';
import { getLocalDateLabel } from '../radar/date.js';
import type { RadarRepository, RepoScore, ScoredRadarRepository } from '../radar/types.js';
import { JsonRadarStore } from '../storage/json-store.js';

export interface LightweightIntelligenceOptions {
  date?: string;
  recommendationLimit?: number;
  topicLimit?: number;
  evidenceLimitPerTopic?: number;
  storePath?: string;
}

export interface LightweightIntelligenceResult {
  runId: string;
  generatedAt: string;
  brief: IntelligenceBrief;
  contextRepoCount: number;
}

function latestScores(scores: RepoScore[]): RepoScore[] {
  const byRepo = new Map<string, RepoScore>();
  for (const score of scores) {
    const existing = byRepo.get(score.repoFullName);
    if (!existing || score.scoreDate.localeCompare(existing.scoreDate) > 0) {
      byRepo.set(score.repoFullName, score);
    }
  }
  return Array.from(byRepo.values()).sort((a, b) => b.finalScore - a.finalScore);
}

function toScoredRepository(repository: RadarRepository, score: RepoScore): ScoredRadarRepository {
  return {
    repository,
    score,
    whyItMatters: `${repository.category} signal with ${repository.stars.toLocaleString()} stars and final score ${score.finalScore}.`,
    developerInsight: `Track ${repository.repoFullName} as context for current multi-source AI trend signals.`
  };
}

function loadRecentScoredRepositories(storePath: string, limit: number): ScoredRadarRepository[] {
  const store = new JsonRadarStore(storePath);
  const data = store.load();
  return latestScores(data.scores)
    .slice(0, Math.max(limit, 20))
    .flatMap((score) => {
      const repository = data.repositories[score.repoFullName];
      return repository ? [toScoredRepository(repository, score)] : [];
    });
}

export async function runLightweightIntelligenceUpdate(options: LightweightIntelligenceOptions = {}): Promise<LightweightIntelligenceResult> {
  const generatedAt = new Date().toISOString();
  const date = options.date ?? getLocalDateLabel();
  const runId = `lightweight-${date}-${generatedAt.replace(/[:.]/g, '-')}`;
  const recommendationLimit = options.recommendationLimit ?? 10;
  const scored = loadRecentScoredRepositories(options.storePath ?? getRadarStorePath(), recommendationLimit);
  const brief = await buildDailyIntelligenceBrief({
    scored,
    recommendationLimit,
    date,
    topicLimit: options.topicLimit,
    evidenceLimitPerTopic: options.evidenceLimitPerTopic
  });

  return {
    runId,
    generatedAt,
    contextRepoCount: scored.length,
    brief: {
      ...brief,
      dataNotes: [
        ...brief.dataNotes,
        `Lightweight intelligence run ${runId}; GitHub collection skipped and ${scored.length} stored repo scores used as context.`
      ]
    }
  };
}
