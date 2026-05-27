import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { latestDailyDashboardToRadarDigest } from '../src/dashboard/latest-digest-adapter.js';
import type { LatestDailyDashboardFile } from '../src/dashboard/build-dashboard-data.js';
import { writeDigestArchive } from '../src/renderers/archive.js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

function getInputPath(): string {
  return process.env.RADAR_DAILY_DASHBOARD_PATH || path.join('data', 'latest-daily-dashboard.json');
}

function main(): void {
  const inputPath = getInputPath();
  const dashboard = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as LatestDailyDashboardFile;
  const digest = latestDailyDashboardToRadarDigest(dashboard);
  const result = writeDigestArchive(digest);
  console.log(`Archived ${inputPath} to ${result.markdownPath}`);
}

main();
