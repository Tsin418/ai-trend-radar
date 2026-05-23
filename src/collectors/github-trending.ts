/**
 * @deprecated 此文件保留用于向后兼容
 * 请使用 ./github.ts 的 GitHubCollector 和统一的 Collector 接口
 */

import type { GitHubTrendingRepo } from '../trending/types.js';
import { createGitHubCollector } from './github.js';
import type { GitHubRepoMetadata } from './github.js';

/**
 * 获取 GitHub Trending 项目列表（向后兼容）
 * @deprecated 请使用 createGitHubCollector().fetch(limit)
 */
export async function fetchGitHubTrending(limit = 10): Promise<GitHubTrendingRepo[]> {
  const collector = createGitHubCollector();
  const items = await collector.fetch(limit);

  // 将通用的 TrendingItem 转换回旧的 GitHubTrendingRepo 格式
  return items.map((item) => {
    const metadata = item.metadata as unknown as GitHubRepoMetadata;
    return {
      rank: item.rank,
      owner: metadata.owner,
      name: metadata.name,
      fullName: metadata.fullName,
      url: item.url,
      description: item.description,
      language: item.primaryTag,
      starsToday: item.heatScore,
      totalStars: item.totalScore,
      forks: metadata.forks,
      contributors: metadata.contributors
    };
  });
}
