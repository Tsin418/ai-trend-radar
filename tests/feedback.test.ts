import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFeedbackSummary } from '../src/feedback/summary.js';
import type { FeedbackEntry } from '../src/radar/types.js';

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
