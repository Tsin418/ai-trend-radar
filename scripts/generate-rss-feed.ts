import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { latestDailyDashboardToRadarDigest } from '../src/dashboard/latest-digest-adapter.js';
import type { LatestDailyDashboardFile } from '../src/dashboard/build-dashboard-data.js';
import { renderRssXml } from '../src/renderers/rss-feed.js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

function getInputPath(): string {
  return process.env.RADAR_DAILY_DASHBOARD_PATH || path.join('data', 'latest-daily-dashboard.json');
}

function getOutputPath(): string {
  return process.env.RADAR_RSS_PATH || path.join('data', 'rss.xml');
}

function main(): void {
  const inputPath = getInputPath();
  const outputPath = getOutputPath();
  const dashboard = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as LatestDailyDashboardFile;
  const digest = latestDailyDashboardToRadarDigest(dashboard);
  const repo = dashboard.source.repo || 'Tsin418/ai-trend-radar';
  const xml = renderRssXml(digest, {
    title: 'AI Trend Radar Daily',
    description: 'Daily AI open-source trend intelligence',
    link: `https://github.com/${repo}`
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, xml, 'utf8');
  console.log(`Generated ${outputPath} from ${inputPath}`);
}

main();
