import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { buildLatestDailyDashboardData } from '../src/dashboard/build-dashboard-data.js';
import { getLocalDateLabel, getRadarTimeZone } from '../src/radar/date.js';
import { writeDigestArchive } from '../src/renderers/archive.js';
import { renderRadarDigestText } from '../src/renderers/radar-text.js';
import { renderRssXml } from '../src/renderers/rss-feed.js';
import { runAiDeveloperRadarDaily } from '../src/tasks/ai-developer-radar-daily.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

interface LatestRadarDigestFile {
  schemaVersion: 1;
  mode: 'daily';
  targetDate: string;
  generatedAt: string;
  timezone: string;
  digestId: string;
  source: {
    repo: string;
    branch: string;
    workflow: string;
    runId?: string;
  };
  text: string;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getSource(): LatestRadarDigestFile['source'] {
  return {
    repo: process.env.GITHUB_REPOSITORY || 'Tsin418/ai-trend-radar',
    branch: process.env.GITHUB_REF_NAME || process.env.GITHUB_HEAD_REF || 'main',
    workflow: process.env.GITHUB_WORKFLOW || 'radar-daily',
    runId: process.env.GITHUB_RUN_ID
  };
}

function getOutputPath(): string {
  return process.env.RADAR_DAILY_DIGEST_PATH || path.join('data', 'latest-daily-digest.json');
}

function getDashboardOutputPath(): string {
  return process.env.RADAR_DAILY_DASHBOARD_PATH || path.join('data', 'latest-daily-dashboard.json');
}

function getRssOutputPath(): string {
  return process.env.RADAR_RSS_PATH || path.join('data', 'rss.xml');
}

async function main(): Promise<void> {
  const send = hasFlag('send');
  const result = await runAiDeveloperRadarDaily({
    send,
    baselineOnly: hasFlag('baseline'),
    useSampleData: hasFlag('sample'),
    repoLimit: parseNumber(getArg('repo-limit')),
    recommendationLimit: parseNumber(getArg('recommendation-limit'))
  });

  if (!result.ok || !result.digest) {
    console.error(result.error ?? 'Failed to generate daily radar digest.');
    process.exit(1);
  }

  const text = renderRadarDigestText(result.digest);
  const timezone = getRadarTimeZone();
  const targetDate = result.digest.date || getLocalDateLabel(new Date(), timezone);
  const generatedAt = new Date().toISOString();
  const digestId = `daily-${targetDate}`;
  const source = getSource();
  const output: LatestRadarDigestFile = {
    schemaVersion: 1,
    mode: 'daily',
    targetDate,
    generatedAt,
    timezone,
    digestId,
    source,
    text
  };

  const outputPath = getOutputPath();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(output, null, 2)}\n`,
    'utf8'
  );

  const dashboard = buildLatestDailyDashboardData({
    digest: result.digest,
    scored: result.scored,
    store: result.store,
    targetDate,
    generatedAt,
    timezone,
    digestId,
    source
  });
  const dashboardOutputPath = getDashboardOutputPath();
  fs.mkdirSync(path.dirname(dashboardOutputPath), { recursive: true });
  fs.writeFileSync(
    dashboardOutputPath,
    `${JSON.stringify(dashboard, null, 2)}\n`,
    'utf8'
  );

  const rssOutputPath = getRssOutputPath();
  fs.mkdirSync(path.dirname(rssOutputPath), { recursive: true });
  fs.writeFileSync(
    rssOutputPath,
    renderRssXml(result.digest, {
      title: 'AI Trend Radar Daily',
      description: 'Daily AI open-source trend intelligence',
      link: `https://github.com/${source.repo}`
    }),
    'utf8'
  );

  const archive = writeDigestArchive(result.digest);

  console.log(text);
  console.log(`\nGenerated ${outputPath} for ${targetDate}`);
  console.log(`Generated ${dashboardOutputPath} for ${targetDate}`);
  console.log(`Generated ${rssOutputPath} for ${targetDate}`);
  console.log(`Archived ${archive.markdownPath}`);

  if (result.notify) {
    if (result.notify.skipped) {
      console.error(`\n通知已跳过: ${result.notify.reason ?? 'unknown reason'}`);
      process.exit(1);
    }

    if (!result.notify.success) {
      console.error(`\n通知发送失败: ${result.notify.error ?? result.notify.reason ?? 'unknown error'}`);
      process.exit(1);
    }

    console.log(`\n通知已发送: ${result.notify.channel}`);
  } else if (send) {
    console.error('\n通知发送失败: no notifier result returned.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
