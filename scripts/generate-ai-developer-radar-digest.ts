import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { getLocalDateLabel, getRadarTimeZone } from '../src/radar/date.js';
import { renderRadarDigestText } from '../src/renderers/radar-text.js';
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
    repo: process.env.GITHUB_REPOSITORY || 'Tsin418/repo-radar',
    branch: process.env.GITHUB_REF_NAME || process.env.GITHUB_HEAD_REF || 'main',
    workflow: process.env.GITHUB_WORKFLOW || 'radar-daily',
    runId: process.env.GITHUB_RUN_ID
  };
}

function getOutputPath(): string {
  return process.env.RADAR_DAILY_DIGEST_PATH || path.join('data', 'latest-daily-digest.json');
}

async function main(): Promise<void> {
  const result = await runAiDeveloperRadarDaily({
    send: false,
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
  const output: LatestRadarDigestFile = {
    schemaVersion: 1,
    mode: 'daily',
    targetDate,
    generatedAt: new Date().toISOString(),
    timezone,
    digestId: `daily-${targetDate}`,
    source: getSource(),
    text
  };

  const outputPath = getOutputPath();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(output, null, 2)}\n`,
    'utf8'
  );

  console.log(text);
  console.log(`\nGenerated ${outputPath} for ${targetDate}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
