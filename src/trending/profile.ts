import { getEnv } from '../config/env.js';
import type { TrendingProfile } from './types.js';

const DEFAULT_KEYWORDS = [
  'ai',
  'agent',
  'agents',
  'llm',
  'mcp',
  'rag',
  'automation',
  'workflow',
  'next.js',
  'nextjs',
  'typescript',
  'javascript',
  'saas',
  'supabase',
  'open source',
  'devtool',
  'cli',
  'api',
  'content',
  'growth',
  'analytics',
  'chrome extension',
  'content pipeline',
  'multi-post',
  'threads',
  'webbuilder',
  'memory',
  'signal',
  'tarot',
  'creator'
];

const DEFAULT_PROFILE: TrendingProfile = {
  title: 'AI 产品、内容系统与自动化工作流实践者',
  summary:
    '结合你当前正在推进的项目推断：你在持续做 buildany、signal-os、memory-os、seedance、tarot-ai、ops-kit、yixiao-skills、WebBuilder、MultiPost、threadsextractor 这类产品。你的实战重心不是单点技术学习，而是把 AI、内容分发、自动化和 SaaS 工具真正做成可运行的产品。',
  keywords: DEFAULT_KEYWORDS,
  preferredLanguages: ['TypeScript', 'JavaScript', 'Python'],
  focusAreas: [
    'AI 工具',
    'Agent 工作流',
    '自动化编排',
    '内容与创作者系统',
    '增长工具',
    '产品化脚本'
  ]
};

function parseList(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export function getTrendingProfile(): TrendingProfile {
  const env = getEnv();
  const extraKeywords = parseList(env.TRENDING_PROFILE_KEYWORDS);
  const note = env.TRENDING_PROFILE_NOTE?.trim();

  return {
    title: DEFAULT_PROFILE.title,
    summary: note || DEFAULT_PROFILE.summary,
    keywords: dedupe([...DEFAULT_PROFILE.keywords, ...extraKeywords.map((item) => item.toLowerCase())]),
    preferredLanguages: DEFAULT_PROFILE.preferredLanguages,
    focusAreas: DEFAULT_PROFILE.focusAreas
  };
}

/**
 * 获取 Demo 模式的预设 profile
 * 用于零配置体验，展示产品价值
 */
export function getDemoProfile(): TrendingProfile {
  return {
    title: 'AI 产品开发者（Demo）',
    summary:
      '专注于 AI 工具、Agent 工作流、自动化产品开发。关注 TypeScript/Python 生态，重视实用性和可落地性。',
    keywords: [
      'ai',
      'agent',
      'agents',
      'llm',
      'rag',
      'mcp',
      'automation',
      'workflow',
      'typescript',
      'javascript',
      'python',
      'nextjs',
      'cli',
      'devtool',
      'saas',
      'productivity'
    ],
    preferredLanguages: ['TypeScript', 'JavaScript', 'Python'],
    focusAreas: ['AI 工具', 'Agent 工作流', '自动化编排', '开发者工具', '产品化脚本']
  };
}
