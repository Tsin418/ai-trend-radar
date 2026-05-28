import type { SourceConfig, TrendItem } from '../trends/types.js';
import { hasAiDeveloperKeyword } from './ai-dev-keywords.js';

const HF_MODELS_ENDPOINT = 'https://huggingface.co/api/models';
const HF_MODEL_SORT = 'createdAt';
const DEFAULT_MIN_FILTERED_ITEMS = 5;

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
  endpoint?: string;
  timeoutMs?: number;
  minFilteredItems?: number;
  fetchImpl?: typeof fetch;
}

function timeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer)
  };
}

function modelUrl(id: string): string {
  return `https://huggingface.co/${id}`;
}

export class HuggingFaceModelsCollector {
  readonly name = 'huggingface_models';
  private readonly endpoint: string;
  private readonly limit: number;
  private readonly timeoutMs: number;
  private readonly minFilteredItems: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HuggingFaceModelsCollectorOptions = {}) {
    this.endpoint = options.endpoint ?? HF_MODELS_ENDPOINT;
    this.limit = options.limit ?? 30;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.minFilteredItems = options.minFilteredItems ?? DEFAULT_MIN_FILTERED_ITEMS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetch(limit = this.limit): Promise<TrendItem[]> {
    const url = new URL(this.endpoint);
    url.searchParams.set('sort', HF_MODEL_SORT);
    url.searchParams.set('direction', '-1');
    url.searchParams.set('limit', String(limit));

    const timeout = timeoutSignal(this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'ai-trend-radar/0.1 (+https://github.com/Tsin418/ai-trend-radar)'
        },
        signal: timeout.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Hugging Face models request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      timeout.cleanup();
    }

    if (!response.ok) {
      throw new Error(`Hugging Face models request failed: HTTP ${response.status}`);
    }

    const models = await response.json() as HuggingFaceModel[];
    const filteredModels = models.filter((model) => hasAiDeveloperKeyword([
      model.modelId ?? model.id,
      model.pipeline_tag,
      model.tags
    ]));
    const relevantModels = filteredModels.length >= this.minFilteredItems ? filteredModels : models;
    const collectedAt = new Date().toISOString();
    return relevantModels
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
