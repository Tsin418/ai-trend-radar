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
export { ProductHuntCollector, createProductHuntCollector } from './producthunt.js';
export { AIHotCollector, createAIHotCollector } from './aihot.js';
export { HuggingFaceModelsCollector, createHuggingFaceModelsCollector } from './huggingface-models.js';
export { HuggingFaceSpacesCollector, createHuggingFaceSpacesCollector } from './huggingface-spaces.js';
export { HackerNewsCollector, createHackerNewsCollector } from './hackernews.js';
export type {
  ProductHuntCollectorOptions,
  ProductHuntPost,
  ProductHuntPostsOrder
} from './producthunt-types.js';

// 向后兼容的旧 API
export { fetchGitHubTrending } from './github-trending.js';
