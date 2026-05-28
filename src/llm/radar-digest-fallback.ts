import type { LatestDailyDashboardFile } from '../dashboard/build-dashboard-data.js';
import type { LlmDigest, LlmDigestInputStats, LlmTrendCluster, SuggestedAction, TodayPulse } from './radar-digest-types.js';

function actionFromJudgment(judgment: LlmTrendCluster['judgment']): SuggestedAction {
  if (judgment === '升温中') return '值得了解';
  if (judgment === '值得观察') return '持续观察';
  return '暂时忽略';
}

function buildFallbackTodayPulse(dashboard: LatestDailyDashboardFile): TodayPulse {
  const topHot = dashboard.sections.hotProjects.slice(0, 2);
  const topEarly = dashboard.sections.earlySignals.slice(0, 1);
  const topChanges = [
    ...topHot.map((item) => ({
      title: item.repoFullName,
      summary: `开发者关注度继续上升，今日新增关注 ${item.dailyStarDelta ?? 0}。`,
      perspective: 'developer' as const,
      whyItMatters: item.whyItMatters,
      suggestedAction: '值得了解' as const,
      confidence: item.dailyStarDelta != null && item.dailyStarDelta > 0 ? 'high' as const : 'medium' as const,
      sourceRefs: [item.repoFullName]
    })),
    ...topEarly.map((item) => ({
      title: item.repoFullName,
      summary: '出现早期升温信号，仍需继续观察持续性。',
      perspective: 'cross_source' as const,
      whyItMatters: item.whyItMatters,
      suggestedAction: '持续观察' as const,
      confidence: 'medium' as const,
      sourceRefs: [item.repoFullName]
    }))
  ].slice(0, 3);

  const topProduct = dashboard.sections.productLaunches.slice(0, 2);
  const topInfo = dashboard.sections.aihotHighlights.slice(0, 2);
  const infoBuzz = dashboard.sections.developerBuzz.slice(0, 2);

  return {
    title: "Today's AI Pulse",
    date: dashboard.targetDate,
    executiveSummary: '今天的信号主要集中在开发者工具与多来源共振主题。部分方向热度上升较快，但短期信号仍需结合后续 2-3 天变化来判断是否持续。',
    topChanges,
    developerView: {
      headline: '开发者侧仍由开源项目热度主导',
      summary: topHot.length > 0
        ? `最热项目是 ${topHot[0].repoFullName}，可优先理解它解决的问题和使用门槛。`
        : '今天开发者侧没有明显集中升温方向。',
      keyItems: topHot.map((item) => item.repoFullName),
      suggestedAction: topHot.length > 0 ? '值得了解' : '持续观察',
      sourceRefs: topHot.map((item) => item.repoFullName)
    },
    productView: {
      headline: '产品侧出现新尝试',
      summary: topProduct.length > 0
        ? '可结合产品发布信号判断技术趋势是否正在走向真实应用。'
        : '今天产品发布信号较少，先观察后续是否补量。',
      keyItems: topProduct.map((item) => item.title),
      suggestedAction: topProduct.length > 0 ? '值得了解' : '持续观察',
      sourceRefs: topProduct.map((item) => item.id)
    },
    informationView: {
      headline: '资讯侧可用作趋势补充',
      summary: topInfo.length > 0 || infoBuzz.length > 0
        ? '资讯与社区讨论可帮助确认哪些方向不只是单点热度。'
        : '今天资讯侧高置信信号不足。',
      keyItems: [...topInfo.map((item) => item.title), ...infoBuzz.map((item) => item.title)].slice(0, 4),
      suggestedAction: topInfo.length > 0 || infoBuzz.length > 0 ? '值得了解' : '持续观察',
      sourceRefs: [...topInfo.map((item) => item.id), ...infoBuzz.map((item) => item.id)].slice(0, 6)
    },
    noiseWarning: '部分结论来自短周期信号，建议结合连续几天变化判断。',
    suggestedReadingOrder: ['developerView', 'productView', 'informationView']
  };
}

function judgmentFromEntity(entity: LatestDailyDashboardFile['trendEntities'][number]): LlmTrendCluster['judgment'] {
  const heatScore = entity.metrics.heatScore ?? 0;
  if (entity.sourceCount >= 3 || heatScore >= 75) return '升温中';
  if (entity.sourceCount >= 2 || heatScore >= 55) return '值得观察';
  return '可能是噪音';
}

function typeFromEntityType(entityType: string): LlmTrendCluster['relatedItems'][number]['itemType'] {
  if (entityType === 'repo') return 'repo';
  if (entityType === 'product') return 'product';
  if (entityType === 'model' || entityType === 'space') return 'model';
  if (entityType === 'paper') return 'paper';
  if (entityType === 'news') return 'news';
  return 'unknown';
}

function buildFallbackTrendClusters(dashboard: LatestDailyDashboardFile): LlmTrendCluster[] {
  const fromEntities = (dashboard.topicClusters.length > 0 ? dashboard.topicClusters : dashboard.sections.crossSourceHighlights)
    .slice(0, 6)
    .map((entity) => {
      const judgment = judgmentFromEntity(entity);
      return {
        name: entity.title,
        oneLiner: entity.summary ?? '多个来源都出现了该主题，值得持续跟踪。',
        whyNow: entity.whyItMatters ?? '该主题在今日数据中多次出现，形成了可追踪信号。',
        audience: ['developer', 'general'] as Array<'developer' | 'product' | 'general'>,
        judgment,
        confidence: judgment === '升温中' ? 'high' as const : 'medium' as const,
        relatedSources: entity.sources.slice(0, 6),
        relatedItems: [
          {
            title: entity.title,
            source: entity.sources[0] ?? 'unknown',
            url: entity.canonicalUrl,
            itemType: typeFromEntityType(entity.entityType)
          }
        ]
      };
    });
  return fromEntities;
}

export function buildFallbackLlmDigest(
  dashboard: LatestDailyDashboardFile,
  inputStats: LlmDigestInputStats,
  warning: string,
  model?: string
): LlmDigest {
  return {
    status: 'fallback',
    generatedAt: new Date().toISOString(),
    model,
    language: 'zh-CN',
    inputStats,
    todayPulse: buildFallbackTodayPulse(dashboard),
    trendClusters: buildFallbackTrendClusters(dashboard),
    warnings: [warning]
  };
}

export function buildFailedLlmDigest(
  inputStats: LlmDigestInputStats,
  errorMessage: string,
  model?: string
): LlmDigest {
  return {
    status: 'failed',
    generatedAt: new Date().toISOString(),
    model,
    language: 'zh-CN',
    inputStats,
    warnings: ['LLM failed; used fallback digest content.'],
    errorMessage
  };
}
