import type { GitHubTrendingRepo, TrendingProfile, TrendingRecommendation } from '../trending/types.js';
import type { TrendingRanker } from './types.js';
import type { TrendType } from '../radar/types.js';

const KEYWORD_GROUPS: Array<{ label: string; keywords: string[] }> = [
  {
    label: 'AI / Agent 基础设施',
    keywords: ['ai', 'agent', 'agents', 'llm', 'mcp', 'model', 'prompt']
  },
  {
    label: '产品与 Web 技术栈',
    keywords: ['next.js', 'nextjs', 'react', 'typescript', 'javascript', 'web', 'saas']
  },
  {
    label: '自动化与工作流',
    keywords: ['automation', 'workflow', 'cron', 'cli', 'api', 'script', 'ops', 'pipeline']
  },
  {
    label: '内容与增长',
    keywords: ['content', 'growth', 'analytics', 'seo', 'marketing', 'social']
  }
];

const PROJECT_HINTS: Array<{ label: string; keywords: string[] }> = [
  { label: 'buildany / WebBuilder', keywords: ['next.js', 'nextjs', 'react', 'typescript', 'web', 'saas', 'builder'] },
  { label: 'signal-os / memory-os / ops-kit', keywords: ['agent', 'agents', 'workflow', 'automation', 'ops', 'cli', 'api', 'mcp'] },
  { label: 'seedance / MultiPost / threadsextractor / yixiao-skills', keywords: ['content', 'social', 'growth', 'analytics', 'creator', 'marketing', 'threads'] },
  { label: 'tarot-ai / AI 产品实验', keywords: ['ai', 'llm', 'prompt', 'rag', 'model'] }
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => text.includes(normalizeText(keyword)));
}

function clampScore(value: number): number {
  return Math.max(0, Math.round(value));
}

function buildPracticeIdeas(repo: GitHubTrendingRepo): string[] {
  const ideas: string[] = [];
  const language = repo.language ?? '';
  const normalized = normalizeText([repo.fullName, repo.description, language].join(' '));

  if (normalized.includes('ai') || normalized.includes('agent') || normalized.includes('llm')) {
    ideas.push('可以先 fork 一版，只保留最小可用 AI 流程，然后替换成你自己的数据源或业务场景。');
  }

  if (language === 'TypeScript' || language === 'JavaScript') {
    ideas.push('优先把核心能力改造成 Next.js 页面或 API 路由，这样更容易接进你现有产品，而不是停留在 demo。');
  } else if (language === 'Python') {
    ideas.push('可以先抽成一个 Python 脚本验证价值，再补 CLI 或定时任务，接进你现有自动化链路。');
  } else if (language === 'Shell' || language === 'Go') {
    ideas.push('把它当成自动化模板来用，先做成可重复执行、幂等、易接入你工作流的版本。');
  } else {
    ideas.push('先只抠出最关键的一层能力做原型，不要一开始就完整复刻整个项目。');
  }

  if (normalized.includes('workflow') || normalized.includes('automation') || normalized.includes('cli')) {
    ideas.push('如果它偏工作流或自动化，建议直接补一个每日触发器或 webhook，把它变成真正可复用的流程。');
  }

  return Array.from(new Set(ideas)).slice(0, 2);
}

function buildReasons(repo: GitHubTrendingRepo, profile: TrendingProfile, matchedKeywords: string[]): string[] {
  const reasons: string[] = [];
  const text = normalizeText([repo.fullName, repo.description, repo.language ?? ''].join(' '));
  const trendType = classifyTrendingTrendType(repo);
  const totalStars = repo.totalStars ?? 0;
  const dailyGrowthRate = totalStars > 0 ? repo.starsToday / totalStars : 0;

  if (trendType === 'sudden_breakout') {
    reasons.push(`突然爆火：今天新增约 ${repo.starsToday.toLocaleString()} 星${dailyGrowthRate > 0 ? `，约占总 stars 的 ${(dailyGrowthRate * 100).toFixed(1)}%` : ''}，更像被外部内容或社区讨论集中带动。`);
  } else if (trendType === 'early_signal') {
    reasons.push(`早期信号：总 stars ${totalStars.toLocaleString()}，但今天新增 ${repo.starsToday.toLocaleString()}，小体量项目已经出现明显关注度爬升。`);
  } else {
    reasons.push(`持续热门：总 stars ${totalStars > 0 ? totalStars.toLocaleString() : '未知'}，今天仍新增 ${repo.starsToday.toLocaleString()}，适合检查近期 release、commit 或社区讨论是否有新变化。`);
  }

  if (matchedKeywords.length > 0) {
    reasons.push(`和你的关键词 ${matchedKeywords.slice(0, 3).join('、')} 重合，说明这个热度和当前实战方向有关，不只是泛热门项目。`);
  }

  const matchedGroups = KEYWORD_GROUPS
    .filter((group) => includesAny(text, group.keywords).length > 0)
    .map((group) => group.label);

  if (matchedGroups.length > 0) {
    reasons.push(`它落在 ${matchedGroups.slice(0, 2).join('、')}，可以用来观察这个方向的工具形态和开发者工作流变化。`);
  }

  const relatedProjects = PROJECT_HINTS
    .filter((group) => includesAny(text, group.keywords).length > 0)
    .map((group) => group.label);

  if (relatedProjects.length > 0) {
    reasons.push(`最接近的落地方向是 ${relatedProjects.slice(0, 2).join('、')}，建议优先看它是否能复用到现有产品或自动化链路。`);
  }

  if (repo.language && profile.preferredLanguages.includes(repo.language)) {
    reasons.push(`技术栈是 ${repo.language}，验证成本低，可以快速判断它是可集成工具还是只适合围观。`);
  }

  if (repo.rank <= 3) {
    reasons.push('今天在 Trending 排名靠前，先看 README、最近提交和 issue 质量，判断热度是否能转化为长期价值。');
  }

  if (repo.starsToday >= 1000) {
    reasons.push(`今天增长势能很强：单日新增约 ${repo.starsToday.toLocaleString()} 星`);
  }

  return reasons.slice(0, 4);
}

function classifyTrendingTrendType(repo: GitHubTrendingRepo): TrendType {
  const totalStars = repo.totalStars ?? 0;
  const dailyGrowthRate = totalStars > 0 ? repo.starsToday / totalStars : 0;
  if (repo.starsToday >= 1000 || dailyGrowthRate >= 0.12) return 'sudden_breakout';
  if (totalStars > 0 && totalStars <= 3000 && repo.starsToday >= 40) return 'early_signal';
  return 'sustained_hot';
}

function scoreRepo(repo: GitHubTrendingRepo, profile: TrendingProfile): { score: number; matchedKeywords: string[] } {
  const text = normalizeText([repo.fullName, repo.description, repo.language ?? ''].join(' '));
  const matchedKeywords = profile.keywords.filter((keyword) => text.includes(normalizeText(keyword)));
  const keywordScore = matchedKeywords.length * 18;
  const languageScore = repo.language && profile.preferredLanguages.includes(repo.language) ? 10 : 0;
  const popularityScore = Math.log10((repo.starsToday || 0) + 1) * 14 + Math.log10((repo.totalStars || repo.starsToday || 0) + 1) * 2;
  const rankScore = Math.max(0, 18 - (repo.rank - 1) * 1.8);
  const clarityScore = repo.description ? 4 : 0;

  return {
    score: clampScore(keywordScore + languageScore + popularityScore + rankScore + clarityScore),
    matchedKeywords
  };
}

export class RuleBasedRanker implements TrendingRanker {
  readonly name = 'rule-based';

  rank(repositories: GitHubTrendingRepo[], profile: TrendingProfile, limit = 5): TrendingRecommendation[] {
    return repositories
      .map((repo) => {
        const scored = scoreRepo(repo, profile);
        return {
          repo,
          score: scored.score,
          matchedKeywords: scored.matchedKeywords
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.repo.starsToday !== a.repo.starsToday) return b.repo.starsToday - a.repo.starsToday;
        return a.repo.rank - b.repo.rank;
      })
      .slice(0, limit)
      .map((item) => ({
        repo: item.repo,
        score: item.score,
        reasons: buildReasons(item.repo, profile, item.matchedKeywords),
        practiceIdeas: buildPracticeIdeas(item.repo)
      }));
  }
}

export function createRuleBasedRanker(): TrendingRanker {
  return new RuleBasedRanker();
}
