import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { latestDailyDashboardToRadarDigest } from '../src/dashboard/latest-digest-adapter.js';
import { testInternals } from '../src/collectors/arxiv.js';
import { parseSubscriberIssue } from '../src/email/subscriber.js';
import { createPotentialScoreRanker } from '../src/rankers/potential-score.js';
import { loadRadarProfile } from '../src/radar/config.js';
import { createSampleRepositories } from '../src/radar/sample-data.js';
import type { RadarDigest, RadarRepository } from '../src/radar/types.js';
import { pruneDigestArchive, renderArchiveMarkdown, writeDigestArchive } from '../src/renderers/archive.js';
import { renderRssXml } from '../src/renderers/rss-feed.js';
import { splitTelegramMessage, escapeTelegramHtml } from '../src/notifiers/telegram.js';
import { JsonRadarStore, createSnapshots } from '../src/storage/json-store.js';

function withStars(repo: RadarRepository, stars: number): RadarRepository {
  return { ...repo, stars };
}

function createDigest(): RadarDigest {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-feature-store-'));
  const store = new JsonRadarStore(path.join(dir, 'store.json'));
  const profile = loadRadarProfile();
  const now = new Date('2026-05-27T01:00:00.000Z');
  const [repo] = createSampleRepositories(now);
  store.addSnapshots(createSnapshots([withStars(repo, repo.stars - 100)], new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()));
  store.addSnapshots(createSnapshots([repo], now.toISOString()));
  const [scored] = createPotentialScoreRanker().score([repo], profile, store, now.toISOString());
  return {
    mode: 'daily',
    title: 'AI Developer Radar｜Daily｜2026-05-27',
    date: '2026-05-27',
    generatedAt: now.toISOString(),
    summary: 'Summary with <special> & characters.',
    baselineCreated: false,
    dataNotes: ['note'],
    hotProjects: [scored],
    acceleratingProjects: [],
    earlySignals: [],
    watchlistMovements: [],
    selectedProjects: [{
      ...scored,
      whyItMatters: 'This matters <now> & later.',
      developerInsight: 'Use it carefully.'
    }]
  };
}

test('RSS renderer emits summary and project items with escaped XML and CDATA', () => {
  const xml = renderRssXml(createDigest(), {
    title: 'AI Trend Radar Daily',
    description: 'Daily AI open-source trend intelligence',
    link: 'https://github.com/Tsin418/ai-trend-radar'
  });

  assert.match(xml, /<rss version="2.0">/);
  assert.match(xml, /Today&apos;s Summary/);
  assert.match(xml, /<!\[CDATA\[/);
  assert.match(xml, /This matters <now> & later/);
  assert.match(xml, /https:\/\/github\.com\//);
});

test('archive writer creates markdown, index and README (no legacy JSON)', () => {
  const digest = createDigest();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-archive-'));
  const result = writeDigestArchive(digest, dir);

  assert.ok(fs.existsSync(result.markdownPath));
  assert.ok(!result.markdownPath.endsWith('.json'));
  assert.ok(fs.existsSync(result.indexPath));
  assert.ok(fs.existsSync(result.readmePath));
  assert.ok(!fs.existsSync(result.markdownPath.replace(/\.md$/, '.json')));
  assert.match(renderArchiveMarkdown(digest), /## Hot Projects/);
});

test('pruneDigestArchive enforces daily window and removes legacy JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-archive-prune-'));
  const digest = createDigest();
  writeDigestArchive(digest, dir);
  // Simulate an older entry plus its legacy JSON sibling.
  const oldDate = '2026-04-01';
  const monthDir = path.join(dir, '2026', '04');
  fs.mkdirSync(monthDir, { recursive: true });
  fs.writeFileSync(path.join(monthDir, `${oldDate}-daily.md`), '# old', 'utf8');
  fs.writeFileSync(path.join(monthDir, `${oldDate}-daily.json`), '{}', 'utf8');

  // Treat "now" as well after the created entry so only the old one falls out.
  const now = new Date('2026-06-01T00:00:00.000Z');
  const result = pruneDigestArchive(dir, now);

  assert.ok(!fs.existsSync(path.join(dir, '2026', '04', `${oldDate}-daily.md`)));
  assert.ok(!fs.existsSync(path.join(dir, '2026', '04', `${oldDate}-daily.json`)));
  assert.ok(result.removedFiles.includes(`2026${path.sep}04${path.sep}${oldDate}-daily.json`));
  // The fresh entry's own markdown survives and its (absent) JSON is not created.
  const freshMd = path.join(dir, '2026', '05', '2026-05-27-daily.md');
  assert.ok(fs.existsSync(freshMd));
  // Index is rebuilt without the pruned entry.
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')) as { entries: Array<{ id: string }> };
  assert.ok(!index.entries.some((entry) => entry.id === `${oldDate}-daily`));
});

test('JsonRadarStore.pruneHistory caps snapshots, scores and digest runs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-store-prune-'));
  const storePath = path.join(dir, 'store.json');
  const store = new JsonRadarStore(storePath);
  const profile = loadRadarProfile();
  const now = new Date('2026-05-27T01:00:00.000Z');
  const [repo] = createSampleRepositories(now);

  // Seed a daily snapshot/score for 35 consecutive days, plus digest runs at
  // the start of the window and one stale entry far in the past.
  for (let day = 40; day >= 1; day -= 1) {
    const stamp = new Date(now.getTime() - day * 24 * 60 * 60 * 1000).toISOString();
    store.addSnapshots(createSnapshots([repo], stamp));
    store.addScores(createPotentialScoreRanker().score([repo], profile, store, stamp).map((item) => item.score));
  }
  store.recordDigestRun('daily', new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(), 'success', 1);
  store.recordDigestRun('daily', now.toISOString(), 'success', 1);

  const result = store.pruneHistory(now);
  assert.ok(result.removedSnapshots > 0);
  assert.ok(result.removedScores > 0);

  const data = JSON.parse(fs.readFileSync(storePath, 'utf8')) as {
    snapshots: Array<{ collectedAt: string }>;
    scores: Array<{ scoreDate: string }>;
    digestRuns: Array<{ finishedAt: string }>;
  };
  const cutoff = '2026-04-27';
  assert.ok(data.snapshots.every((snapshot) => snapshot.collectedAt.slice(0, 10) >= cutoff));
  assert.ok(data.scores.every((score) => score.scoreDate.slice(0, 10) >= cutoff));
  assert.ok(data.digestRuns.every((run) => run.finishedAt.slice(0, 10) >= cutoff));
});

test('Telegram helpers escape HTML and split long messages', () => {
  assert.equal(escapeTelegramHtml('<b>A&B</b>'), '&lt;b&gt;A&amp;B&lt;/b&gt;');
  const chunks = splitTelegramMessage('x '.repeat(3000), 1000);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 1000));
});

test('subscriber issue parser extracts email, frequency and categories', () => {
  const subscriber = parseSubscriberIssue({
    number: 42,
    title: '[Subscribe]',
    body: [
      '### Email',
      'reader@example.com',
      '### Digest Frequency',
      '- [x] Daily Digest (every day)',
      '- [ ] Weekly Digest (every Monday)',
      '### Topics of interest (optional)',
      '- [x] AI Agent Framework'
    ].join('\n')
  });

  assert.equal(subscriber?.email, 'reader@example.com');
  assert.deepEqual(subscriber?.frequency, ['daily']);
  assert.deepEqual(subscriber?.categories, ['AI Agent Framework']);
});

test('arXiv parser maps relevant Atom entries to paper trend items', () => {
  const xml = `
    <feed>
      <entry>
        <id>http://arxiv.org/abs/2605.12345v1</id>
        <title>LLM Agents for Software Engineering Evaluation</title>
        <summary>We benchmark tool use and coding agent workflows.</summary>
        <published>2026-05-27T00:00:00Z</published>
        <updated>2026-05-27T00:00:00Z</updated>
        <author><name>Ada Lovelace</name></author>
        <category term="cs.SE"/>
        <link title="pdf" href="http://arxiv.org/pdf/2605.12345v1"/>
      </entry>
    </feed>`;
  const papers = testInternals.parseArxivXml(xml);
  const matches = testInternals.matchedKeywords(papers[0], ['llm', 'agent', 'rag']);

  assert.equal(papers[0].title, 'LLM Agents for Software Engineering Evaluation');
  assert.deepEqual(papers[0].authors, ['Ada Lovelace']);
  assert.deepEqual(matches, ['llm', 'agent']);
});

test('latest dashboard adapter rebuilds a daily radar digest', () => {
  const digest = createDigest();
  const project = digest.selectedProjects[0];
  const rebuilt = latestDailyDashboardToRadarDigest({
    schemaVersion: 1,
    mode: 'daily',
    targetDate: digest.date,
    generatedAt: digest.generatedAt,
    timezone: 'Asia/Shanghai',
    lastUpdatedLabel: 'Last updated',
    digestId: 'daily-2026-05-27',
    source: { repo: 'Tsin418/ai-trend-radar', branch: 'main', workflow: 'radar-daily' },
    summary: {
      text: digest.summary,
      scannedRepoCount: 1,
      aiCandidateCount: 1,
      selectedProjectCount: 1,
      topCategory: project.repository.category,
      baselineCreated: false
    },
    projects: [{
      repoFullName: project.repository.repoFullName,
      repoUrl: project.repository.repoUrl,
      owner: project.repository.owner,
      name: project.repository.name,
      description: project.repository.description,
      language: project.repository.language,
      topics: project.repository.topics,
      category: project.repository.category,
      source: project.repository.source,
      stars: project.repository.stars,
      forks: project.repository.forks,
      openIssues: project.repository.openIssues,
      dailyStarDelta: project.score.dailyStarDelta,
      weeklyStarDelta: project.score.weeklyStarDelta,
      dailyGrowthRate: project.score.dailyGrowthRate,
      weeklyGrowthRate: project.score.weeklyGrowthRate,
      yesterdayStarDelta: project.score.yesterdayStarDelta,
      threeDayAverageDelta: project.score.threeDayAverageDelta,
      sevenDayAverageDelta: project.score.sevenDayAverageDelta,
      acceleration: project.score.acceleration,
      accelerationConfidence: project.score.accelerationConfidence,
      trendType: project.score.trendType,
      score: {
        finalScore: project.score.finalScore,
        attentionScore: project.score.attentionScore,
        accelerationScore: project.score.accelerationScore,
        earlyPotentialScore: project.score.earlyPotentialScore,
        developerActivityScore: project.score.developerActivityScore,
        aiRelevanceScore: project.score.aiRelevanceScore,
        usefulnessScore: project.score.usefulnessScore,
        riskScore: project.score.riskScore,
        riskLevel: project.score.riskLevel,
        signals: project.score.signals
      },
      whyItMatters: project.whyItMatters,
      developerInsight: project.developerInsight,
      createdAt: project.repository.createdAt,
      pushedAt: project.repository.pushedAt,
      firstSeenAt: project.repository.firstSeenAt,
      lastSeenAt: project.repository.lastSeenAt,
      isWatchlist: false
    }],
    sections: {
      hotProjects: [],
      acceleratingProjects: [],
      earlySignals: [],
      watchlistMovements: [],
      productLaunches: [],
      modelDemoSignals: [],
      developerBuzz: [],
      aihotHighlights: [],
      crossSourceHighlights: []
    },
    homepageSections: {
      openSourceRadar: { id: 'open', title: 'Open', subtitle: '', description: '', items: [] },
      aiProductRadar: { id: 'products', title: 'Products', subtitle: '', description: '', items: [] },
      aiNewsRadar: { id: 'news', title: 'News', subtitle: '', description: '', items: [] },
      selfHostPush: { id: 'push', title: 'Push', subtitle: '', description: '', items: [] }
    },
    growthLinks: {
      githubRepoUrl: '',
      githubProfileUrl: '',
      personalHomepageUrl: '',
      linkedinUrl: '',
      xiaohongshuUrl: ''
    },
    sourceHealth: [],
    categoryStats: [],
    historyHighlights: {
      topStarDelta24h: [],
      topStarDelta7d: [],
      recurringProjects: [],
      risingCategories: []
    },
    trendEntities: [],
    topicClusters: [],
    dataNotes: []
  });

  assert.equal(rebuilt.selectedProjects[0].repository.repoFullName, project.repository.repoFullName);
});
