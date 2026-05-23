import type { GitHubTrendingRepo, TrendingProfile, TrendingRecommendation } from '../trending/types.js';
import type { TrendingRanker } from './types.js';

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

  if (matchedKeywords.length > 0) {
    reasons.push(`和你当前的实战关键词高度重合：${matchedKeywords.slice(0, 3).join('、')}`);
  }

  const matchedGroups = KEYWORD_GROUPS
    .filter((group) => includesAny(text, group.keywords).length > 0)
    .map((group) => group.label);

  if (matchedGroups.length > 0) {
    reasons.push(`项目类型贴近你正在做的方向：${matchedGroups.slice(0, 2).join('、')}`);
  }

  const relatedProjects = PROJECT_HINTS
    .filter((group) => includesAny(text, group.keywords).length > 0)
    .map((group) => group.label);

  if (relatedProjects.length > 0) {
    reasons.push(`和你当前项目最接近的落地方向是：${relatedProjects.slice(0, 2).join('、')}`);
  }

  if (repo.language && profile.preferredLanguages.includes(repo.language)) {
    reasons.push(`技术栈是 ${repo.language}，和你当前常用栈一致，落地成本更低`);
  }

  if (repo.rank <= 3) {
    reasons.push('今天在 Trending 排名靠前，值得你优先看一眼，避免错过短周期热点');
  }

  if (repo.starsToday >= 1000) {
    reasons.push(`今天增长势能很强：单日新增约 ${repo.starsToday.toLocaleString()} 星`);
  }

  return reasons.slice(0, 4);
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
