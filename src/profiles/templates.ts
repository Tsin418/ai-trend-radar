import type { TrendingProfile } from '../trending/types.js';

/**
 * 预设 Profile 模板
 * 用于快速配置和 init 向导
 */

export interface ProfileTemplate {
  id: string;
  name: string;
  description: string;
  profile: TrendingProfile;
}

export const PROFILE_TEMPLATES: ProfileTemplate[] = [
  {
    id: 'ai-builder',
    name: 'AI 产品开发者',
    description: '专注于 AI 工具、Agent 工作流、自动化产品',
    profile: {
      title: 'AI 产品开发者',
      summary: '专注于 AI 工具、Agent 工作流、自动化产品开发。关注 TypeScript/Python 生态，重视实用性和可落地性。',
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
    }
  },

  {
    id: 'fullstack-dev',
    name: '全栈工程师',
    description: '专注于 Web 开发、API 设计、全栈框架',
    profile: {
      title: '全栈工程师',
      summary: '专注于现代 Web 开发，使用 Next.js/React 构建产品，关注 API 设计和全栈架构。',
      keywords: [
        'nextjs',
        'react',
        'typescript',
        'javascript',
        'nodejs',
        'api',
        'rest',
        'graphql',
        'database',
        'postgres',
        'prisma',
        'tailwind',
        'web',
        'frontend',
        'backend'
      ],
      preferredLanguages: ['TypeScript', 'JavaScript'],
      focusAreas: ['Web 框架', 'API 设计', '全栈开发', '前端性能', '数据库优化']
    }
  },

  {
    id: 'devops-engineer',
    name: 'DevOps/云原生',
    description: '专注于容器化、CI/CD、云基础设施',
    profile: {
      title: 'DevOps/云原生工程师',
      summary: '专注于容器化、CI/CD、云原生技术。关注自动化、可观测性和基础设施即代码。',
      keywords: [
        'docker',
        'kubernetes',
        'k8s',
        'cicd',
        'terraform',
        'ansible',
        'monitoring',
        'prometheus',
        'grafana',
        'cloud',
        'aws',
        'gcp',
        'azure',
        'infrastructure',
        'deployment'
      ],
      preferredLanguages: ['Go', 'Python', 'Shell', 'YAML'],
      focusAreas: ['容器化', 'CI/CD', '云原生', '监控告警', 'IaC']
    }
  },

  {
    id: 'indie-hacker',
    name: '独立开发者',
    description: '专注于快速原型、SaaS 工具、变现',
    profile: {
      title: '独立开发者',
      summary: '专注于快速构建 SaaS 产品、MVP 验证和产品变现。关注开发效率和增长工具。',
      keywords: [
        'saas',
        'mvp',
        'nextjs',
        'supabase',
        'stripe',
        'vercel',
        'marketing',
        'analytics',
        'growth',
        'indie',
        'startup',
        'product',
        'monetization',
        'landing-page'
      ],
      preferredLanguages: ['TypeScript', 'JavaScript'],
      focusAreas: ['SaaS 工具', '快速开发', '增长工具', '变现', 'Landing Page']
    }
  },

  {
    id: 'data-engineer',
    name: '数据工程师',
    description: '专注于数据管道、分析、ML 工程',
    profile: {
      title: '数据工程师',
      summary: '专注于构建数据管道、数据分析和机器学习工程。关注数据质量和可扩展性。',
      keywords: [
        'etl',
        'data-pipeline',
        'analytics',
        'ml',
        'machine-learning',
        'airflow',
        'spark',
        'kafka',
        'python',
        'sql',
        'data-warehouse',
        'bigquery',
        'pandas',
        'numpy'
      ],
      preferredLanguages: ['Python', 'SQL', 'Scala'],
      focusAreas: ['数据工程', 'ETL', '数据分析', 'ML 工程', '数据仓库']
    }
  }
];

/**
 * 根据 ID 获取模板
 */
export function getTemplateById(id: string): ProfileTemplate | undefined {
  return PROFILE_TEMPLATES.find((t) => t.id === id);
}

/**
 * 获取所有模板
 */
export function getAllTemplates(): ProfileTemplate[] {
  return PROFILE_TEMPLATES;
}
