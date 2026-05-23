import type { RadarProfile, RadarRepository, RepoDeltas, RepoScore, RepoSnapshot, ScoredRadarRepository } from '../radar/types.js';
import type { JsonRadarStore } from '../storage/json-store.js';
import { classifyAiCategory } from './ai-category.js';
import { calculateRisk } from './risk.js';

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function daysSince(value: string | null, now: Date): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor((now.getTime() - timestamp) / (24 * 60 * 60 * 1000));
}

function deltaFromSnapshot(current: RadarRepository, snapshot: RepoSnapshot | undefined): { delta: number | null; growthRate: number | null } {
  if (!snapshot) return { delta: null, growthRate: null };
  const delta = current.stars - snapshot.stars;
  const growthRate = snapshot.stars > 0 ? delta / snapshot.stars : null;
  return {
    delta,
    growthRate
  };
}

export function calculateRepoDeltas(repo: RadarRepository, store: JsonRadarStore, collectedAt: string): RepoDeltas {
  const daily = deltaFromSnapshot(repo, store.findSnapshotAtOrBefore(repo.repoFullName, collectedAt, 1));
  const weekly = deltaFromSnapshot(repo, store.findSnapshotAtOrBefore(repo.repoFullName, collectedAt, 7));
  const newlySeen = daily.delta === null;

  return {
    dailyStarDelta: daily.delta,
    weeklyStarDelta: weekly.delta,
    dailyGrowthRate: daily.growthRate,
    weeklyGrowthRate: weekly.growthRate,
    newlySeen,
    baselineOnly: daily.delta === null && weekly.delta === null
  };
}

function attentionScore(repo: RadarRepository, deltas: RepoDeltas): number {
  const daily = deltas.dailyStarDelta ?? 0;
  const weekly = deltas.weeklyStarDelta ?? 0;
  const dailyGrowth = deltas.dailyGrowthRate ?? 0;
  const weeklyGrowth = deltas.weeklyGrowthRate ?? 0;
  const absolute = Math.min(55, daily * 0.7 + weekly * 0.18);
  const relative = Math.min(35, dailyGrowth * 180 + weeklyGrowth * 80);
  const sourceBoost = repo.source.includes('github-trending') ? 10 : 0;
  return clamp(absolute + relative + sourceBoost);
}

function earlyPotentialScore(repo: RadarRepository, deltas: RepoDeltas, profile: RadarProfile, now: Date): number {
  let score = 0;
  const ageDays = daysSince(repo.createdAt, now);

  if (repo.stars >= profile.thresholds.earlyStageMinStars && repo.stars <= profile.thresholds.earlyStageMaxStars) score += 35;
  if (ageDays !== null && ageDays <= 180) score += 20;
  if ((deltas.weeklyStarDelta ?? 0) >= profile.thresholds.weeklyStarEarly) score += 25;
  if ((deltas.dailyStarDelta ?? 0) >= profile.thresholds.dailyStarEarly) score += 15;
  if (repo.stars < 30) score -= 20;
  if (!repo.description || repo.description.length < 25) score -= 10;
  if (daysSince(repo.pushedAt, now) !== null && (daysSince(repo.pushedAt, now) ?? 0) > 30) score -= 20;

  return clamp(score);
}

function developerActivityScore(repo: RadarRepository, now: Date): number {
  const pushedDays = daysSince(repo.pushedAt, now);
  const pushScore = pushedDays === null ? 10 : pushedDays <= 7 ? 45 : pushedDays <= 14 ? 35 : pushedDays <= 30 ? 20 : 5;
  const forkScore = Math.min(30, Math.log10(repo.forks + 1) * 12);
  const issueScore = repo.openIssues > 0 ? Math.min(15, Math.log10(repo.openIssues + 1) * 8) : 3;
  const topicScore = Math.min(10, repo.topics.length * 2);
  return clamp(pushScore + forkScore + issueScore + topicScore);
}

function usefulnessScore(repo: RadarRepository): number {
  const text = [repo.repoFullName, repo.description, ...repo.topics].join(' ').toLowerCase();
  let score = 25;
  for (const keyword of ['framework', 'sdk', 'tool', 'server', 'client', 'library', 'cli', 'workflow', 'agent', 'rag', 'mcp', 'inference']) {
    if (text.includes(keyword)) score += 8;
  }
  if (repo.language) score += 5;
  if (repo.topics.length >= 3) score += 8;
  return clamp(score);
}

export class PotentialScoreRanker {
  readonly name = 'potential-score';

  score(repositories: RadarRepository[], profile: RadarProfile, store: JsonRadarStore, collectedAt: string): ScoredRadarRepository[] {
    const now = new Date(collectedAt);

    return repositories.map((repo) => {
      const classification = classifyAiCategory(repo);
      const classifiedRepo: RadarRepository = {
        ...repo,
        category: classification.category
      };
      const deltas = calculateRepoDeltas(classifiedRepo, store, collectedAt);
      const risk = calculateRisk(classifiedRepo, deltas, now);
      const score: RepoScore = {
        repoFullName: classifiedRepo.repoFullName,
        dailyStarDelta: deltas.dailyStarDelta,
        weeklyStarDelta: deltas.weeklyStarDelta,
        dailyGrowthRate: deltas.dailyGrowthRate,
        weeklyGrowthRate: deltas.weeklyGrowthRate,
        attentionScore: attentionScore(classifiedRepo, deltas),
        earlyPotentialScore: earlyPotentialScore(classifiedRepo, deltas, profile, now),
        developerActivityScore: developerActivityScore(classifiedRepo, now),
        aiRelevanceScore: classification.aiRelevanceScore,
        usefulnessScore: usefulnessScore(classifiedRepo),
        riskScore: risk.riskScore,
        finalScore: 0,
        riskLevel: risk.riskLevel,
        scoreDate: collectedAt.slice(0, 10),
        signals: [...classification.matchedKeywords, ...risk.signals]
      };
      score.finalScore = clamp(
        score.attentionScore * 0.30 +
        score.earlyPotentialScore * 0.20 +
        score.developerActivityScore * 0.20 +
        score.aiRelevanceScore * 0.15 +
        score.usefulnessScore * 0.10 -
        score.riskScore * 0.05
      );

      return {
        repository: classifiedRepo,
        score,
        whyItMatters: buildWhyItMatters(classifiedRepo, score),
        developerInsight: buildDeveloperInsight(classifiedRepo, score)
      };
    }).sort((a, b) => b.score.finalScore - a.score.finalScore);
  }
}

function formatDelta(delta: number | null): string {
  return delta === null ? '暂无基线' : `+${delta}`;
}

function buildWhyItMatters(repo: RadarRepository, score: RepoScore): string {
  if (score.dailyStarDelta !== null && score.dailyStarDelta >= 50) {
    return `${repo.category} 方向出现明显关注度增长，24h stars ${formatDelta(score.dailyStarDelta)}，值得优先快速评估。`;
  }
  if (score.weeklyStarDelta !== null && score.weeklyStarDelta >= 80) {
    return `${repo.category} 方向一周增长 ${formatDelta(score.weeklyStarDelta)}，属于持续升温信号。`;
  }
  if (repo.isWatchlist) {
    return `这是 watchlist 项目，近期元数据变化值得跟踪，但当前增长信号仍需继续观察。`;
  }
  return `${repo.category} 相关性较高，当前分数主要来自项目定位、活跃度和开发者可用性。`;
}

function buildDeveloperInsight(repo: RadarRepository, score: RepoScore): string {
  if (repo.category === 'Coding Agent / SWE Agent') {
    return '关注它如何拆解代码任务、接入工具和处理仓库上下文，可作为 coding agent 产品能力参考。';
  }
  if (repo.category === 'MCP / Tool Calling') {
    return '重点看协议适配、工具注册和真实示例，判断它是否能降低 agent 接工具的成本。';
  }
  if (repo.category === 'RAG / Knowledge Base') {
    return '重点看数据接入、检索质量和 production workflow，而不是只看 demo 效果。';
  }
  if (repo.category === 'Local LLM / Inference') {
    return '重点看部署复杂度、性能边界和模型兼容性，判断是否能进入本地 AI 应用栈。';
  }
  if (score.riskLevel !== 'Low') {
    return '信号存在不确定性，建议先检查 README、最近 commit 和 issue 质量后再投入时间。';
  }
  return '可以用一个最小样例验证 API、文档和集成成本，再决定是否纳入长期技术观察。';
}

export function createPotentialScoreRanker(): PotentialScoreRanker {
  return new PotentialScoreRanker();
}
