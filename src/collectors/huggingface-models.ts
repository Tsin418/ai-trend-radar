import type { SourceConfig, TrendItem } from '../trends/types.js';

const HF_MODELS_ENDPOINT = 'https://huggingface.co/api/models';

interface HuggingFaceModel {
  id?: string;
  modelId?: string;
  author?: string;
  downloads?: number;
  likes?: number;
  pipeline_tag?: string;
  tags?: string[];
  lastModified?: string;
  createdAt?: string;
  cardData?: {
    license?: string;
    language?: string | string[];
  };
}

interface HuggingFaceModelsCollectorOptions extends SourceConfig {
  timeoutMs?: number;
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  return controller.signal;
}

function modelUrl(id: string): string {
  return `https://huggingface.co/${id}`;
}

export class HuggingFaceModelsCollector {
  readonly name = 'huggingface_models';
  private readonly limit: number;
  private readonly timeoutMs: number;

  constructor(options: HuggingFaceModelsCollectorOptions = {}) {
    this.limit = options.limit ?? 30;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async fetch(limit = this.limit): Promise<TrendItem[]> {
    const url = new URL(HF_MODELS_ENDPOINT);
    url.searchParams.set('sort', 'trending');
    url.searchParams.set('direction', '-1');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('full', 'true');

    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'ai-trend-radar/0.1 (+https://github.com/Tsin418/ai-trend-radar)'
      },
      signal: timeoutSignal(this.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`Hugging Face models request failed: HTTP ${response.status}`);
    }

    const models = await response.json() as HuggingFaceModel[];
    const collectedAt = new Date().toISOString();
    return models
      .filter((model) => model.modelId || model.id)
      .map((model) => {
        const id = (model.modelId ?? model.id) as string;
        return {
          id: `huggingface_models:${id}`,
          source: 'huggingface_models',
          sourceType: 'model_hub',
          title: id,
          url: modelUrl(id),
          author: model.author,
          tags: model.tags ?? [],
          category: model.pipeline_tag,
          metrics: {
            downloads: model.downloads,
            likes: model.likes
          },
          publishedAt: model.createdAt,
          updatedAt: model.lastModified,
          collectedAt,
          raw: {
            pipelineTag: model.pipeline_tag,
            license: model.cardData?.license,
            language: model.cardData?.language
          }
        } satisfies TrendItem;
      });
  }
}

export function createHuggingFaceModelsCollector(options?: HuggingFaceModelsCollectorOptions): HuggingFaceModelsCollector {
  return new HuggingFaceModelsCollector(options);
}
