import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { SourceConfig, TrendItem } from '../trends/types.js';

const ARXIV_API_URL = 'https://export.arxiv.org/api/query';
const DEFAULT_CATEGORIES = ['cs.AI', 'cs.CL', 'cs.LG', 'cs.MA'];
const DEFAULT_KEYWORDS = [
  'large language model',
  'llm',
  'agent',
  'multi-agent',
  'retrieval-augmented',
  'rag',
  'tool use',
  'tool calling',
  'function calling',
  'code generation',
  'coding agent',
  'software engineering',
  'program synthesis',
  'copilot',
  'model context protocol',
  'mcp',
  'inference optimization',
  'vector database',
  'embedding',
  'fine-tuning',
  'alignment',
  'safety',
  'guardrail',
  'prompt engineering',
  'benchmark',
  'evaluation',
  'agentic',
  'workflow'
];

export interface ArxivCollectorOptions extends SourceConfig {
  timeoutMs?: number;
}

export interface ArxivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  categories: string[];
  abstractUrl: string;
  pdfUrl: string;
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  return controller.signal;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function buildSearchQuery(categories: string[]): string {
  return categories.map((category) => `cat:${category}`).join('+OR+');
}

function isRecentEnough(value: string, daysBack: number): boolean {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return true;
  return timestamp >= Date.now() - daysBack * 24 * 60 * 60 * 1000;
}

function matchedKeywords(paper: ArxivPaper, keywords: string[]): string[] {
  const haystack = `${paper.title} ${paper.summary}`.toLowerCase();
  return keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
}

function firstText($: cheerio.CheerioAPI, element: Element, selector: string): string {
  return normalizeText($(element).find(selector).first().text());
}

function parseArxivXml(xml: string): ArxivPaper[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $('entry').toArray().map((entry) => {
    const id = firstText($, entry, 'id');
    const categories = $(entry).find('category').toArray()
      .map((category) => $(category).attr('term'))
      .filter((value): value is string => Boolean(value));
    const pdfUrl = $(entry).find('link[title="pdf"]').attr('href') ?? id.replace('/abs/', '/pdf/');

    return {
      id,
      title: firstText($, entry, 'title'),
      summary: firstText($, entry, 'summary'),
      authors: $(entry).find('author > name').toArray().map((author) => normalizeText($(author).text())),
      published: firstText($, entry, 'published'),
      updated: firstText($, entry, 'updated'),
      categories,
      abstractUrl: id,
      pdfUrl
    };
  }).filter((paper) => paper.id && paper.title);
}

export function arxivPaperToTrendItem(paper: ArxivPaper, collectedAt = new Date().toISOString()): TrendItem {
  return {
    id: paper.id,
    source: 'arxiv',
    sourceType: 'paper',
    title: paper.title,
    url: paper.pdfUrl,
    description: paper.summary.slice(0, 500),
    summary: paper.summary,
    author: paper.authors.join(', '),
    tags: paper.categories,
    category: paper.categories[0],
    language: 'en',
    publishedAt: paper.published,
    updatedAt: paper.updated,
    collectedAt,
    metrics: {},
    raw: {
      abstractUrl: paper.abstractUrl,
      authors: paper.authors
    }
  };
}

export class ArxivCollector {
  readonly name = 'arxiv';
  private readonly categories: string[];
  private readonly keywords: string[];
  private readonly daysBack: number;
  private readonly timeoutMs: number;

  constructor(private readonly options: ArxivCollectorOptions = {}) {
    this.categories = options.categories ?? DEFAULT_CATEGORIES;
    this.keywords = options.keywords?.length ? options.keywords : DEFAULT_KEYWORDS;
    this.daysBack = options.daysBack ?? 1;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async fetch(limit: number): Promise<TrendItem[]> {
    const maxResults = Math.max(limit, this.options.limit ?? limit);
    const url = `${ARXIV_API_URL}?search_query=${buildSearchQuery(this.categories)}&sortBy=submittedDate&sortOrder=descending&start=0&max_results=${maxResults}`;
    const response = await fetch(url, {
      headers: {
        accept: 'application/atom+xml, application/xml, text/xml',
        'user-agent': 'ai-trend-radar/0.1 (+https://github.com/Tsin418/ai-trend-radar)'
      },
      signal: timeoutSignal(this.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`arXiv request failed: HTTP ${response.status}`);
    }

    const collectedAt = new Date().toISOString();
    return parseArxivXml(await response.text())
      .filter((paper) => isRecentEnough(paper.published || paper.updated, this.daysBack))
      .map((paper) => ({ paper, matches: matchedKeywords(paper, this.keywords) }))
      .filter(({ matches }) => matches.length > 0)
      .map(({ paper, matches }) => ({
        ...arxivPaperToTrendItem(paper, collectedAt),
        tags: Array.from(new Set([...paper.categories, ...matches])),
        recommendedReason: `Matched AI developer keywords: ${matches.slice(0, 5).join(', ')}`
      }))
      .slice(0, limit);
  }
}

export function createArxivCollector(options?: ArxivCollectorOptions): ArxivCollector {
  return new ArxivCollector(options);
}

export const testInternals = {
  parseArxivXml,
  matchedKeywords
};
