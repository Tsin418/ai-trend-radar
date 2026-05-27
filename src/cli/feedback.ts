import fs from 'node:fs';
import path from 'node:path';
import type { FeedbackEntry } from '../radar/types.js';
import { buildFeedbackSummary, createFeedbackStore, getFeedbackStorePath } from '../feedback/summary.js';
import { getRadarStorePath } from '../radar/config.js';
import { JsonRadarStore } from '../storage/json-store.js';

type FeedbackAction = FeedbackEntry['action'];

interface FeedbackCommandArgs {
  useful?: string | boolean;
  'not-useful'?: string | boolean;
  seen?: string | boolean;
  stats?: boolean;
  source?: string;
}

interface LatestDashboardProject {
  repoFullName: string;
  category?: string;
  score?: {
    finalScore?: number;
  };
}

interface LatestDashboardFile {
  targetDate?: string;
  generatedAt?: string;
  projects?: LatestDashboardProject[];
}

function getLatestDashboardPath(): string {
  return process.env.RADAR_DAILY_DASHBOARD_PATH || path.join('data', 'latest-daily-dashboard.json');
}

function normalizeRepo(value: string | boolean | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.includes('/') ? trimmed : undefined;
}

function parseAction(args: FeedbackCommandArgs): { action: FeedbackAction; repoFullName: string } | undefined {
  const useful = normalizeRepo(args.useful);
  if (useful) return { action: 'useful', repoFullName: useful };
  const notUseful = normalizeRepo(args['not-useful']);
  if (notUseful) return { action: 'not_useful', repoFullName: notUseful };
  const seen = normalizeRepo(args.seen);
  if (seen) return { action: 'seen', repoFullName: seen };
  return undefined;
}

function loadLatestDashboard(): LatestDashboardFile | undefined {
  const filePath = getLatestDashboardPath();
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as LatestDashboardFile;
  } catch {
    return undefined;
  }
}

function findLatestContext(repoFullName: string): Partial<FeedbackEntry> {
  const dashboard = loadLatestDashboard();
  const projects = dashboard?.projects ?? [];
  const index = projects.findIndex((project) => project.repoFullName.toLowerCase() === repoFullName.toLowerCase());
  if (index >= 0) {
    const project = projects[index];
    return {
      source: 'daily-digest',
      scoredAt: dashboard?.generatedAt ?? dashboard?.targetDate,
      scoreAtTime: project.score?.finalScore,
      rankAtTime: index + 1,
      category: project.category
    };
  }

  try {
    const data = new JsonRadarStore(getRadarStorePath()).load();
    const latestScore = data.scores
      .filter((score) => score.repoFullName.toLowerCase() === repoFullName.toLowerCase())
      .sort((a, b) => Date.parse(b.scoreDate) - Date.parse(a.scoreDate))[0];

    if (latestScore) {
      return {
        source: 'daily-digest',
        scoredAt: latestScore.scoreDate,
        scoreAtTime: latestScore.finalScore
      };
    }
  } catch {
    return {};
  }

  return {};
}

function printSummary(entries: FeedbackEntry[]): void {
  const summary = buildFeedbackSummary(entries);
  const categories = summary.usefulCategories.map((item) => `${item.category}: ${item.count}`).join(', ') || 'n/a';
  const recentUseful = summary.recentUsefulRepos.join(', ') || 'n/a';

  console.log(`Feedback store: ${getFeedbackStorePath()}`);
  console.log(`Total entries: ${summary.totalEntries}`);
  console.log(`This week: ${summary.weekEntries} (${summary.usefulThisWeek} useful, ${summary.notUsefulThisWeek} not useful, ${summary.seenThisWeek} seen)`);
  console.log(`Useful categories: ${categories}`);
  console.log(`Recent useful repos: ${recentUseful}`);
}

export async function runFeedbackCommand(args: FeedbackCommandArgs): Promise<void> {
  const store = createFeedbackStore();
  const data = store.load();

  if (args.stats) {
    printSummary(data.entries);
    return;
  }

  const parsed = parseAction(args);
  if (!parsed) {
    console.error('Usage: npx gtr feedback --useful owner/repo | --not-useful owner/repo | --seen owner/repo | --stats');
    process.exit(1);
  }

  const latest = findLatestContext(parsed.repoFullName);
  const entry: FeedbackEntry = {
    repoFullName: parsed.repoFullName,
    action: parsed.action,
    source: args.source ?? latest.source ?? 'cli',
    feedbackAt: new Date().toISOString(),
    scoredAt: latest.scoredAt,
    scoreAtTime: latest.scoreAtTime,
    rankAtTime: latest.rankAtTime,
    category: latest.category
  };
  const next = store.addEntry(entry);

  console.log(`Recorded feedback: ${entry.action} ${entry.repoFullName}`);
  printSummary(next.entries);
}
