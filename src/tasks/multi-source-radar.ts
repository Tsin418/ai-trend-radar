import { createAIHotCollector } from '../collectors/aihot.js';
import { createHackerNewsCollector } from '../collectors/hackernews.js';
import { createHuggingFaceModelsCollector } from '../collectors/huggingface-models.js';
import { createHuggingFaceSpacesCollector } from '../collectors/huggingface-spaces.js';
import { createProductHuntCollector } from '../collectors/producthunt.js';
import type { ScoredRadarRepository } from '../radar/types.js';
import { productHuntTrendingItemToTrendItem, trendItemFromRadarRepository } from '../trends/adapters.js';
import { loadMultiSourceConfig } from '../trends/config.js';
import { buildTopicClusters, buildTrendEntities, mergeTrendItems } from '../trends/dedupe.js';
import { sortTrendItems } from '../trends/scoring.js';
import type { MultiSourceCollectionResult, MultiSourceDigestSections, SourceConfig, SourceHealth, SourceHealthName, TrendItem } from '../trends/types.js';

const EMPTY_SECTIONS: MultiSourceDigestSections = {
  productLaunches: [],
  modelDemoSignals: [],
  developerBuzz: [],
  aihotHighlights: [],
  crossSourceHighlights: []
};

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

export async function collectMultiSourceSignals(
  scored: ScoredRadarRepository[],
  recommendationLimit: number
): Promise<MultiSourceCollectionResult> {
  if (process.env.RADAR_USE_SAMPLE_DATA === 'true') {
    const now = new Date().toISOString();
    const skipped = (source: SourceHealthName): SourceHealth => ({
      source,
      enabled: false,
      success: true,
      itemCount: 0,
      startedAt: now,
      finishedAt: now,
      latencyMs: 0,
      warning: 'Sample data mode; live collection skipped.'
    });
    return {
      items: [],
      sections: EMPTY_SECTIONS,
      warnings: [],
      sourceHealth: [
        skipped('product-hunt'),
        skipped('aihot'),
        skipped('huggingface-models'),
        skipped('huggingface-spaces'),
        skipped('hackernews')
      ],
      trendEntities: [],
      topicClusters: []
    };
  }

  const config = loadMultiSourceConfig();
  const githubItems = scored.slice(0, Math.max(recommendationLimit, 10)).map(trendItemFromRadarRepository);

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
  const aihotCategories = new Set((config.aihot.categories ?? []).map((category) => category.toLowerCase()));
  if (aihotCategories.size > 0 && aihot.items.some((item) => !aihotCategories.has((item.category ?? 'other').toLowerCase()))) {
    aihot.health.warning = 'AIHot category filter was sparse; high-quality fallback items were retained.';
  }
  const items = [
    ...githubItems,
    ...productHunt.items,
    ...aihot.items,
    ...hfModels.items,
    ...hfSpaces.items,
    ...hackernews.items
  ];
  const warnings = results.flatMap((result) => result.warning ? [result.warning] : []);
  const sourceHealth = results.map((result) => result.health);
  const trendEntities = buildTrendEntities(items);
  const topicClusters = buildTopicClusters(items);
  const sections: MultiSourceDigestSections = {
    productLaunches: sortTrendItems(productHunt.items).slice(0, 3),
    modelDemoSignals: sortTrendItems([...hfModels.items, ...hfSpaces.items]).slice(0, 5),
    developerBuzz: sortTrendItems(hackernews.items).slice(0, 3),
    aihotHighlights: sortTrendItems(aihot.items).slice(0, 5),
    crossSourceHighlights: mergeTrendItems(items).slice(0, 3)
  };

  return {
    items,
    sections: Object.values(sections).some((section) => section.length > 0) ? sections : EMPTY_SECTIONS,
    warnings,
    sourceHealth,
    trendEntities,
    topicClusters
  };
}
