import type { RadarRepository, RepoScore } from '../radar/types.js';

function daysSince(value: string | null, now: Date): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor((now.getTime() - timestamp) / (24 * 60 * 60 * 1000));
}

export function calculateRisk(repo: RadarRepository, partialScore: Pick<RepoScore, 'dailyStarDelta' | 'weeklyStarDelta'>, now = new Date()): { riskScore: number; riskLevel: RepoScore['riskLevel']; signals: string[] } {
  const signals: string[] = [];
  let riskScore = 0;
  const daysSincePush = daysSince(repo.pushedAt, now);

  if (repo.isArchived) {
    riskScore += 60;
    signals.push('仓库已归档');
  }

  if (repo.isFork) {
    riskScore += 20;
    signals.push('仓库是 fork，需确认原创活跃度');
  }

  if (!repo.description || repo.description.length < 25) {
    riskScore += 15;
    signals.push('描述信息较弱');
  }

  if (repo.topics.length < 2) {
    riskScore += 10;
    signals.push('topics 较少，分类信号较弱');
  }

  if (daysSincePush === null) {
    riskScore += 20;
    signals.push('缺少 pushed_at 数据');
  } else if (daysSincePush > 30) {
    riskScore += 25;
    signals.push('最近 30 天无 push');
  }

  const forkRatio = repo.stars > 0 ? repo.forks / repo.stars : 0;
  if (repo.stars >= 500 && forkRatio < 0.015) {
    riskScore += 10;
    signals.push('fork/star 比例偏低');
  }

  if ((partialScore.dailyStarDelta ?? 0) >= 100 && repo.forks < 5) {
    riskScore += 10;
    signals.push('星标增长较快但 fork 信号较弱');
  }

  const bounded = Math.min(100, riskScore);
  const riskLevel = bounded >= 55 ? 'High' : bounded >= 25 ? 'Medium' : 'Low';

  return {
    riskScore: bounded,
    riskLevel,
    signals
  };
}
