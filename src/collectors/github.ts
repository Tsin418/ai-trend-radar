import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { Collector, TrendingItem } from './types.js';
import { withRetry, defaultShouldRetry } from '../utils/retry.js';

const TRENDING_URL = 'https://github.com/trending?since=daily';
const USER_AGENT = 'Mozilla/5.0 (compatible; GitHub-Trending-Radar/1.0; +https://github.com/)';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

/**
 * GitHub 特有的贡献者类型
 */
export interface GitHubContributor {
  login: string;
  url: string;
}

/**
 * GitHub 特有的仓库元数据
 */
export interface GitHubRepoMetadata {
  owner: string;
  name: string;
  fullName: string;
  forks: number | null;
  contributors: GitHubContributor[];
}

function parseCount(value: string | undefined | null): number | null {
  if (!value) return null;
  const normalized = value.replace(/,/g, '').trim();
  if (!normalized) return null;

  const compactMatch = normalized.match(/^([\d.]+)([kKmM])?$/);
  if (compactMatch) {
    const numeric = Number.parseFloat(compactMatch[1]);
    if (Number.isNaN(numeric)) return null;
    const suffix = compactMatch[2]?.toLowerCase();
    if (suffix === 'k') return Math.round(numeric * 1_000);
    if (suffix === 'm') return Math.round(numeric * 1_000_000);
    return Math.round(numeric);
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function cleanText(text: string | undefined | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function extractFullName(href: string): { owner: string; name: string; fullName: string; url: string } | null {
  const match = href.match(/^\/([^/]+)\/([^/]+)$/);
  if (!match) return null;

  const owner = match[1];
  const name = match[2];
  return {
    owner,
    name,
    fullName: `${owner}/${name}`,
    url: `https://github.com${href}`
  };
}

function parseContributors(card: Cheerio<AnyNode>, root: CheerioAPI): GitHubContributor[] {
  const contributors: GitHubContributor[] = [];
  card.find('a[data-hovercard-type="user"]').each((_, element) => {
    const anchor = root(element);
    const href = anchor.attr('href');
    if (!href || !href.startsWith('/')) return;

    const login = href.replace(/^\//, '').trim();
    if (!login || contributors.some((item) => item.login === login)) return;

    contributors.push({
      login,
      url: `https://github.com${href}`
    });
  });

  return contributors;
}

/**
 * GitHub Trending Collector
 * 从 GitHub Trending 页面抓取每日热门项目
 */
export class GitHubCollector implements Collector<TrendingItem> {
  readonly name = 'github';

  async fetch(limit = 10): Promise<TrendingItem[]> {
    // 使用重试包装器获取 HTML
    const html = await withRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(TRENDING_URL, {
            headers: {
              'User-Agent': USER_AGENT,
              Accept: 'text/html,application/xhtml+xml'
            },
            signal: controller.signal
          });
          clearTimeout(timeout);

          if (!response.ok) {
            throw new Error(
              `GitHub Trending 请求失败: HTTP ${response.status}${
                response.status === 429 ? ' (请求过于频繁，请稍后再试)' :
                response.status >= 500 ? ' (GitHub 服务暂时不可用)' :
                ''
              }`
            );
          }

          return await response.text();
        } catch (error) {
          clearTimeout(timeout);

          // 优化错误消息
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              throw new Error(`GitHub Trending 请求超时（${REQUEST_TIMEOUT_MS}ms）`);
            }
            if (error.message.includes('fetch failed')) {
              throw new Error('GitHub Trending 网络请求失败，请检查网络连接');
            }
          }

          throw error;
        }
      },
      {
        maxRetries: MAX_RETRIES,
        initialDelay: 1000,
        shouldRetry: defaultShouldRetry,
        onRetry: (error, attempt, delay) => {
          console.error(
            `[GitHub Collector] 重试 ${attempt}/${MAX_RETRIES}（${delay}ms 后）: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    const $ = load(html);
    const items: TrendingItem[] = [];
    const cards = $('article.Box-row').slice(0, limit);

    cards.each((index, element) => {
      const card = $(element);
      const repoAnchor = card.find('h2 a[href^="/"]').first();
      const href = repoAnchor.attr('href');
      if (!href) return;

      const fullName = extractFullName(href);
      if (!fullName) return;

      const description = cleanText(card.find('p.col-9').first().text());
      const language = cleanText(card.find('span[itemprop="programmingLanguage"]').first().text()) || null;
      const starsTodayText = cleanText(card.find('span.d-inline-block.float-sm-right').first().text());
      const starsToday = parseCount(starsTodayText.match(/([\d,.kKmM]+)\s+stars?\s+today/i)?.[1] ?? starsTodayText) ?? 0;
      const totalStars = parseCount(cleanText(card.find('a[href$="/stargazers"]').first().text()));
      const forks = parseCount(cleanText(card.find('a[href$="/forks"]').first().text()));
      const contributors = parseContributors(card, $);

      items.push({
        rank: index + 1,
        id: fullName.fullName,
        title: fullName.fullName,
        description,
        url: fullName.url,
        primaryTag: language,
        tags: language ? [language] : [],
        heatScore: starsToday,
        totalScore: totalStars,
        metadata: {
          owner: fullName.owner,
          name: fullName.name,
          fullName: fullName.fullName,
          language,
          starsToday,
          totalStars,
          forks,
          contributors
        }
      });
    });

    return items;
  }
}

/**
 * 工厂函数：创建 GitHub Collector 实例
 */
export function createGitHubCollector(): Collector {
  return new GitHubCollector();
}
