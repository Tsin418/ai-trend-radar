import type { GitHubTrendingRepo, TrendingProfile, TrendingRecommendation } from '../trending/types.js';

/**
 * 通用的排名器接口
 * 将候选项目按画像和策略转成推荐列表
 */
export interface Ranker<TItem = GitHubTrendingRepo, TProfile = TrendingProfile, TResult = TrendingRecommendation> {
  /**
   * 排名器名称（如 'rule-based', 'llm', 'hybrid'）
   */
  readonly name: string;

  /**
   * 生成推荐结果
   */
  rank(items: TItem[], profile: TProfile, limit: number): TResult[];
}

export type RankerFactory<
  TItem = GitHubTrendingRepo,
  TProfile = TrendingProfile,
  TResult = TrendingRecommendation
> = () => Ranker<TItem, TProfile, TResult>;

export type TrendingRanker = Ranker<GitHubTrendingRepo, TrendingProfile, TrendingRecommendation>;
