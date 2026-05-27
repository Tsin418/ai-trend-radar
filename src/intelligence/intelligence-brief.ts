import { enrichTrendEntitiesWithLLM } from '../llm/trend-enricher.js';
import { getTrendLLMEnrichmentConfig } from '../radar/config.js';
import type { ScoredRadarRepository } from '../radar/types.js';
import { collectMultiSourceSignals } from '../tasks/multi-source-radar.js';
import type { SourceHealth } from '../trends/types.js';
import { buildIntelligenceHeadline } from './headline-builder.js';
import { buildTopicBriefs } from './topic-brief-builder.js';
import type { IntelligenceBrief } from './types.js';

export interface DailyIntelligenceBriefOptions {
  scored: ScoredRadarRepository[];
  recommendationLimit: number;
  date: string;
  sourceHealth?: SourceHealth[];
  topicLimit?: number;
  evidenceLimitPerTopic?: number;
}

export async function buildDailyIntelligenceBrief(options: DailyIntelligenceBriefOptions): Promise<IntelligenceBrief> {
  const multiSource = await collectMultiSourceSignals(
    options.scored,
    options.recommendationLimit
  );

  const enriched = await enrichTrendEntitiesWithLLM(
    multiSource.topicClusters,
    getTrendLLMEnrichmentConfig()
  );

  const topicBriefs = buildTopicBriefs(enriched.entities, {
    limit: options.topicLimit ?? 5,
    evidenceLimitPerTopic: options.evidenceLimitPerTopic ?? 6
  });
  const { headline, keyTakeaways } = buildIntelligenceHeadline(topicBriefs);

  return {
    date: options.date,
    headline,
    keyTakeaways,
    topicBriefs,
    sourceHealth: [
      ...(options.sourceHealth ?? []),
      ...multiSource.sourceHealth
    ],
    dataNotes: [
      ...multiSource.warnings.map((warning) => `Multi-source warning: ${warning}`),
      ...enriched.warnings.map((warning) => `Trend enrichment warning: ${warning}`)
    ]
  };
}
