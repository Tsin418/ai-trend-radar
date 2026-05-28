import fs from 'node:fs';
import path from 'node:path';
import type { MultiSourceConfig, SourceConfig } from './types.js';

const DEFAULT_CONFIG: MultiSourceConfig = {
  productHunt: { enabled: true, limit: 3 },
  aihot: {
    enabled: true,
    limit: 30,
    categories: ['models', 'products', 'papers', 'industry', 'tools']
  },
  huggingfaceModels: { enabled: true, limit: 30 },
  huggingfaceSpaces: { enabled: true, limit: 30 },
  hackernews: {
    enabled: true,
    lists: ['topstories', 'newstories', 'beststories'],
    limitPerList: 30
  },
  arxiv: {
    enabled: true,
    limit: 20,
    daysBack: 1,
    categories: ['cs.AI', 'cs.CL', 'cs.LG', 'cs.MA']
  }
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return fallback;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envCsv(name: string, fallback: string[]): string[] {
  const parsed = process.env[name]?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
  return parsed.length > 0 ? parsed : fallback;
}

function readSourceBlock(text: string, sourceKey: string): string {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^\\s{2}${sourceKey}:\\s*$`).test(line));
  if (start < 0) return '';

  const block: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s{2}[a-zA-Z0-9_]+:\s*$/.test(line)) break;
    block.push(line);
  }
  return block.join('\n');
}

function readBool(block: string, key: string): boolean | undefined {
  const match = block.match(new RegExp(`^\\s{4}${key}:\\s*(true|false)\\s*$`, 'mi'));
  return match ? match[1].toLowerCase() === 'true' : undefined;
}

function readNumber(block: string, key: string): number | undefined {
  const match = block.match(new RegExp(`^\\s{4}${key}:\\s*(\\d+)\\s*$`, 'm'));
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readString(block: string, key: string): string | undefined {
  const match = block.match(new RegExp(`^\\s{4}${key}:\\s*(.+?)\\s*$`, 'm'));
  return match ? match[1].replace(/^["']|["']$/g, '').trim() : undefined;
}

function readList(block: string, key: string): string[] | undefined {
  const lines = block.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^\\s{4}${key}:\\s*$`).test(line));
  if (start < 0) return undefined;

  const values: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s{4}[a-zA-Z0-9_]+:/.test(line)) break;
    const match = line.match(/^\s*-\s+(.+?)\s*$/);
    if (match) values.push(match[1].replace(/^["']|["']$/g, '').trim());
  }
  return values.length > 0 ? values : undefined;
}

function mergeYamlSource(fileText: string, sourceKey: string, fallback: SourceConfig): SourceConfig {
  const block = readSourceBlock(fileText, sourceKey);
  if (!block) return fallback;

  return {
    ...fallback,
    enabled: readBool(block, 'enabled') ?? fallback.enabled,
    limit: readNumber(block, 'limit') ?? fallback.limit,
    endpoint: readString(block, 'endpoint') ?? fallback.endpoint,
    timeoutMs: readNumber(block, 'timeout_ms') ?? fallback.timeoutMs,
    maxRetries: readNumber(block, 'max_retries') ?? fallback.maxRetries,
    categories: readList(block, 'categories') ?? fallback.categories,
    lists: readList(block, 'lists') ?? fallback.lists,
    limitPerList: readNumber(block, 'limit_per_list') ?? fallback.limitPerList,
    daysBack: readNumber(block, 'days_back') ?? fallback.daysBack,
    keywords: readList(block, 'keywords') ?? fallback.keywords
  };
}

export function loadMultiSourceConfig(configPath = 'config/sources.yaml'): MultiSourceConfig {
  const resolved = path.resolve(configPath);
  const fileText = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : '';
  const yamlConfig: MultiSourceConfig = {
    productHunt: mergeYamlSource(fileText, 'product_hunt', DEFAULT_CONFIG.productHunt),
    aihot: mergeYamlSource(fileText, 'aihot', DEFAULT_CONFIG.aihot),
    huggingfaceModels: mergeYamlSource(fileText, 'huggingface_models', DEFAULT_CONFIG.huggingfaceModels),
    huggingfaceSpaces: mergeYamlSource(fileText, 'huggingface_spaces', DEFAULT_CONFIG.huggingfaceSpaces),
    hackernews: mergeYamlSource(fileText, 'hackernews', DEFAULT_CONFIG.hackernews),
    arxiv: mergeYamlSource(fileText, 'arxiv', DEFAULT_CONFIG.arxiv)
  };

  return {
    productHunt: {
      ...yamlConfig.productHunt,
      enabled: parseBoolean(process.env.PRODUCT_HUNT_ENABLED, yamlConfig.productHunt.enabled ?? true),
      limit: parsePositiveInteger(process.env.PRODUCT_HUNT_POST_LIMIT, yamlConfig.productHunt.limit ?? 3)
    },
    aihot: {
      ...yamlConfig.aihot,
      enabled: parseBoolean(process.env.AIHOT_ENABLED, yamlConfig.aihot.enabled ?? true),
      limit: parsePositiveInteger(process.env.AIHOT_LIMIT, yamlConfig.aihot.limit ?? 30),
      endpoint: process.env.AIHOT_ENDPOINT?.trim() || yamlConfig.aihot.endpoint,
      timeoutMs: parsePositiveInteger(process.env.AIHOT_TIMEOUT_MS, yamlConfig.aihot.timeoutMs ?? 20_000),
      maxRetries: parsePositiveInteger(process.env.AIHOT_MAX_RETRIES, yamlConfig.aihot.maxRetries ?? 2),
      daysBack: parsePositiveInteger(process.env.AIHOT_DAYS_BACK, yamlConfig.aihot.daysBack ?? 3),
      categories: envCsv('AIHOT_CATEGORIES', yamlConfig.aihot.categories ?? [])
    },
    huggingfaceModels: {
      ...yamlConfig.huggingfaceModels,
      enabled: parseBoolean(process.env.HUGGINGFACE_MODELS_ENABLED, yamlConfig.huggingfaceModels.enabled ?? true),
      limit: parsePositiveInteger(process.env.HUGGINGFACE_MODELS_LIMIT, yamlConfig.huggingfaceModels.limit ?? 30),
      endpoint: process.env.HUGGINGFACE_MODELS_ENDPOINT?.trim() || yamlConfig.huggingfaceModels.endpoint,
      timeoutMs: parsePositiveInteger(
        process.env.HUGGINGFACE_MODELS_TIMEOUT_MS,
        yamlConfig.huggingfaceModels.timeoutMs ?? 10_000
      )
    },
    huggingfaceSpaces: {
      ...yamlConfig.huggingfaceSpaces,
      enabled: parseBoolean(process.env.HUGGINGFACE_SPACES_ENABLED, yamlConfig.huggingfaceSpaces.enabled ?? true),
      limit: parsePositiveInteger(process.env.HUGGINGFACE_SPACES_LIMIT, yamlConfig.huggingfaceSpaces.limit ?? 30)
    },
    hackernews: {
      ...yamlConfig.hackernews,
      enabled: parseBoolean(process.env.HACKERNEWS_ENABLED, yamlConfig.hackernews.enabled ?? true),
      lists: envCsv('HACKERNEWS_LISTS', yamlConfig.hackernews.lists ?? ['topstories']),
      limitPerList: parsePositiveInteger(process.env.HACKERNEWS_LIMIT_PER_LIST, yamlConfig.hackernews.limitPerList ?? 30)
    },
    arxiv: {
      ...yamlConfig.arxiv,
      enabled: parseBoolean(process.env.ARXIV_ENABLED, yamlConfig.arxiv.enabled ?? true),
      limit: parsePositiveInteger(process.env.ARXIV_LIMIT, yamlConfig.arxiv.limit ?? 20),
      daysBack: parsePositiveInteger(process.env.ARXIV_DAYS_BACK, yamlConfig.arxiv.daysBack ?? 1),
      categories: envCsv('ARXIV_CATEGORIES', yamlConfig.arxiv.categories ?? ['cs.AI', 'cs.CL', 'cs.LG']),
      keywords: envCsv('ARXIV_KEYWORDS', yamlConfig.arxiv.keywords ?? [])
    }
  };
}
