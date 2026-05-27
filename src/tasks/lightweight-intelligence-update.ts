import { createAIHotCollector } from '../collectors/aihot.js';
import { createHackerNewsCollector } from '../collectors/hackernews.js';
import { createHuggingFaceModelsCollector } from '../collectors/huggingface-models.js';
import { createHuggingFaceSpacesCollector } from '../collectors/huggingface-spaces.js';
import { createProductHuntCollector } from '../collectors/producthunt.js';
import { getLocalDateLabel } from '../radar/date.js';
import { buildIntelligenceHeadline } from '../intelligence/headline-builder.js';
import { buildTopicBriefs } from '../intelligence/topic-brief-builder.js';
import type { IntelligenceBrief } from '../intelligence/types.js';
import { productHuntTrendingItemToTrendItem } from '../trends/adapters.js';
import { loadMultiSourceConfig } from '../trends/config.js';
import { buildTopicClusters } from '../trends/dedupe.js';
import { sortTrendItems } from '../trends/scoring.js';
import type { SourceConfig, SourceHealth, SourceHealthName, TrendItem } from '../trends/types.js';

export interface LightweightIntelligenceOptions {
  date?: string;
  recommendationLimit?: number;
  topicLimit?: number;
  evidenceLimitPerTopic?: number;
}

export interface LightweightIntelligenceResult {
  runId: string;
  generatedAt: string;
  brief: IntelligenceBrief;
  sections: {
    productLaunches: TrendItem[];
    modelDemoSignals: TrendItem[];
    developerBuzz: TrendItem[];
    aihotHighlights: TrendItem[];
  };
}

async function safeCollect(
  source: SourceHealthName,
  label: string,
  enabled: boolean,
  collect: () => Promise<TrendItem[]>
): Promise<{ items: TrendItem[]; health: SourceHealth; warning?: string }> {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  if (!enabled) {
    return {
      items: [],
      health: {
        source,
        enabled: false,
        success: true,
        itemCount: 0,
        startedAt,
        finishedAt: startedAt,
        latencyMs: 0,
        warning: `${label} collection disabled.`
      }
    };
  }

  try {
    const items = await collect();
    return {
      items,
      health: {
        source,
        enabled: true,
        success: true,
        itemCount: items.length,
        startedAt,
        finishedAt: new Date().toISOString(),
        latencyMs: Date.now() - start
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      items: [],
      warning: `${label} collection failed: ${message}`,
      health: {
        source,
        enabled: true,
        success: false,
        itemCount: 0,
        startedAt,
        finishedAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
        error: message
      }
    };
  }
}

function enabled(config: SourceConfig | undefined): boolean {
  return config?.enabled ?? false;
}

function limit(config: SourceConfig | undefined, fallback: number): number {
  return config?.limit ?? fallback;
}

function productHuntEnabled(config: SourceConfig): boolean {
  return enabled(config) && Boolean(process.env.PRODUCT_HUNT_TOKEN?.trim());
}

export async function runLightweightIntelligenceUpdate(
  options: LightweightIntelligenceOptions = {}
): Promise<LightweightIntelligenceResult> {
  const generatedAt = new Date().toISOString();
  const date = options.date ?? getLocalDateLabel();
  const runId = `lightweight-${date}-${generatedAt.replace(/[:.]/g, '-')}`;
  const config = loadMultiSourceConfig();

  const results = await Promise.all([
    safeCollect('product-hunt', 'Product Hunt', productHuntEnabled(config.productHunt), async () => {
      const collector = createProductHuntCollector({ limit: limit(config.productHunt, 30) });
      const items = await collector.fetch(limit(config.productHunt, 30));
      return items.map(productHuntTrendingItemToTrendItem);
    }),
    safeCollect('aihot', 'AIHot', enabled(config.aihot), async () => {
      const collector = createAIHotCollector(config.aihot);
      return collector.fetch(limit(config.aihot, 30));
    }),
    safeCollect('huggingface-models', 'Hugging Face Models', enabled(config.huggingfaceModels), async () => {
      const collector = createHuggingFaceModelsCollector(config.huggingfaceModels);
      return collector.fetch(limit(config.huggingfaceModels, 30));
    }),
    safeCollect('huggingface-spaces', 'Hugging Face Spaces', enabled(config.huggingfaceSpaces), async () => {
      const collector = createHuggingFaceSpacesCollector(config.huggingfaceSpaces);
      return collector.fetch(limit(config.huggingfaceSpaces, 30));
    }),
    safeCollect('hackernews', 'Hacker News', enabled(config.hackernews), async () => {
      const collector = createHackerNewsCollector(config.hackernews);
      return collector.fetch();
    })
  ]);

  const [productHunt, aihot, hfModels, hfSpaces, hackernews] = results;
  const items = results.flatMap((result) => result.items);
  const topicBriefs = buildTopicBriefs(buildTopicClusters(items), {
    limit: options.topicLimit ?? options.recommendationLimit ?? 5,
    evidenceLimitPerTopic: options.evidenceLimitPerTopic ?? 6
  });
  const { headline, keyTakeaways } = buildIntelligenceHeadline(topicBriefs);
  const warnings = results.flatMap((result) => result.warning ? [result.warning] : []);

  return {
    runId,
    generatedAt,
    sections: {
      productLaunches: sortTrendItems(productHunt.items).slice(0, 5),
      modelDemoSignals: sortTrendItems([...hfModels.items, ...hfSpaces.items]).slice(0, 8),
      developerBuzz: sortTrendItems(hackernews.items).slice(0, 5),
      aihotHighlights: sortTrendItems(aihot.items).slice(0, 8)
    },
    brief: {
      date,
      headline,
      keyTakeaways,
      topicBriefs,
      sourceHealth: results.map((result) => result.health),
      dataNotes: [
        'Lightweight intelligence update: GitHub repository collection, GitHub scoring, and LLM enrichment were skipped.',
        ...warnings.map((warning) => `Multi-source warning: ${warning}`)
      ]
    }
  };
}
