import { createRuleBasedRanker } from '../rankers/index.js';
import type { TrendingRanker } from '../rankers/index.js';
import type {
  GitHubTrendingRepo,
  TrendingDigest,
  TrendingProfile,
  TrendingRecommendation
} from '../trending/types.js';

export function buildTrendingSummary(
  repositories: GitHubTrendingRepo[],
  recommendations: TrendingRecommendation[],
  profile: TrendingProfile,
  date: string
): string {
  const top = recommendations[0];
  const topLabel = top ? top.repo.fullName : '今天的 Trending 项目集合';
  return [
    `${date} 的 GitHub Trending 已扫描 ${repositories.length} 个项目。`,
    `你的当前画像是：${profile.title}。`,
    top
      ? `今天最值得你动手尝试的是 ${topLabel}，核心原因是它和你当前在做的项目方向高度贴合：${top.reasons[0] ?? '与你的当前工作重合度高'}。`
      : '今天没有特别强的高匹配项目，所以本次推荐更多按热度和技术相关性排序。'
  ].join(' ');
}

export function buildTrendingDigest(
  repositories: GitHubTrendingRepo[],
  profile: TrendingProfile,
  date: string,
  recommendationLimit = 5,
  ranker: TrendingRanker = createRuleBasedRanker()
): TrendingDigest {
  const recommendations = ranker.rank(repositories, profile, recommendationLimit);

  return {
    date,
    generatedAt: new Date().toISOString(),
    profile,
    repositories,
    recommendations,
    summary: buildTrendingSummary(repositories, recommendations, profile, date)
  };
}
