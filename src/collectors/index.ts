/**
 * Collectors 统一导出
 */

// 类型定义
export type { Collector, TrendingItem, CollectorFactory } from './types.js';

// GitHub Collector
export { GitHubCollector, createGitHubCollector } from './github.js';
export type { GitHubContributor, GitHubRepoMetadata } from './github.js';
export { GitHubSearchCollector, createGitHubSearchCollector } from './github-search.js';
export { loadWatchlist } from './watchlist.js';

// 向后兼容的旧 API
export { fetchGitHubTrending } from './github-trending.js';
