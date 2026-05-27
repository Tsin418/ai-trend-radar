import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runFeedbackCommand } from '../src/cli/feedback.js';
import { buildFeedbackSummary } from '../src/feedback/summary.js';
import type { FeedbackEntry } from '../src/radar/types.js';
import { JsonRadarStore } from '../src/storage/json-store.js';

test('feedback summary groups useful repos by category for the current week', () => {
  const now = new Date('2026-05-27T10:00:00.000Z');
  const entries: FeedbackEntry[] = [
    {
      repoFullName: 'example/coding-agent-lab',
      action: 'useful',
      source: 'daily-digest',
      feedbackAt: '2026-05-27T09:00:00.000Z',
      category: 'Coding Agent / SWE Agent'
    },
    {
      repoFullName: 'example/mcp-toolbox',
      action: 'not_useful',
      source: 'cli',
      feedbackAt: '2026-05-26T09:00:00.000Z',
      category: 'MCP / Tool Calling'
    },
    {
      repoFullName: 'example/old',
      action: 'useful',
      source: 'cli',
      feedbackAt: '2026-05-01T09:00:00.000Z',
      category: 'Old'
    }
  ];

  const summary = buildFeedbackSummary(entries, now);

  assert.equal(summary.totalEntries, 3);
  assert.equal(summary.weekEntries, 2);
  assert.equal(summary.usefulThisWeek, 1);
  assert.equal(summary.notUsefulThisWeek, 1);
  assert.deepEqual(summary.usefulCategories, [{ category: 'Coding Agent / SWE Agent', count: 1 }]);
});

test('feedback command falls back to radar store score context when dashboard is missing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-fallback-'));
  const previousDashboardPath = process.env.RADAR_DAILY_DASHBOARD_PATH;
  const previousStorePath = process.env.RADAR_STORE_PATH;
  const previousFeedbackPath = process.env.RADAR_FEEDBACK_PATH;
  const previousLog = console.log;

  try {
    process.env.RADAR_DAILY_DASHBOARD_PATH = path.join(dir, 'missing-dashboard.json');
    process.env.RADAR_STORE_PATH = path.join(dir, 'radar-store.json');
    process.env.RADAR_FEEDBACK_PATH = path.join(dir, 'feedback.json');
    console.log = () => {};

    new JsonRadarStore(process.env.RADAR_STORE_PATH).save({
      repositories: {},
      snapshots: [],
      digestRuns: [],
      scores: [
        {
          repoFullName: 'example/coding-agent-lab',
          dailyStarDelta: 10,
          weeklyStarDelta: 30,
          dailyGrowthRate: null,
          weeklyGrowthRate: null,
          yesterdayStarDelta: null,
          threeDayAverageDelta: null,
          sevenDayAverageDelta: null,
          acceleration: 1,
          accelerationConfidence: 'medium',
          trendType: 'sustained_hot',
          attentionScore: 10,
          accelerationScore: 10,
          earlyPotentialScore: 10,
          developerActivityScore: 10,
          aiRelevanceScore: 10,
          usefulnessScore: 10,
          riskScore: 10,
          finalScore: 42,
          riskLevel: 'Low',
          scoreDate: '2026-05-26T00:00:00.000Z',
          signals: []
        },
        {
          repoFullName: 'example/coding-agent-lab',
          dailyStarDelta: 12,
          weeklyStarDelta: 36,
          dailyGrowthRate: null,
          weeklyGrowthRate: null,
          yesterdayStarDelta: null,
          threeDayAverageDelta: null,
          sevenDayAverageDelta: null,
          acceleration: 1.2,
          accelerationConfidence: 'medium',
          trendType: 'sustained_hot',
          attentionScore: 12,
          accelerationScore: 12,
          earlyPotentialScore: 12,
          developerActivityScore: 12,
          aiRelevanceScore: 12,
          usefulnessScore: 12,
          riskScore: 12,
          finalScore: 55,
          riskLevel: 'Low',
          scoreDate: '2026-05-27T00:00:00.000Z',
          signals: []
        }
      ]
    });

    await runFeedbackCommand({ useful: 'example/coding-agent-lab' });

    const feedback = JSON.parse(fs.readFileSync(process.env.RADAR_FEEDBACK_PATH, 'utf8')) as { entries: FeedbackEntry[] };
    assert.equal(feedback.entries[0].source, 'daily-digest');
    assert.equal(feedback.entries[0].scoredAt, '2026-05-27T00:00:00.000Z');
    assert.equal(feedback.entries[0].scoreAtTime, 55);
    assert.equal(feedback.entries[0].rankAtTime, undefined);
  } finally {
    console.log = previousLog;
    process.env.RADAR_DAILY_DASHBOARD_PATH = previousDashboardPath;
    process.env.RADAR_STORE_PATH = previousStorePath;
    process.env.RADAR_FEEDBACK_PATH = previousFeedbackPath;
  }
});
