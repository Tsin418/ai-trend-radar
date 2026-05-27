import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { renderIntelligenceBriefText } from '../src/renderers/intelligence-text.js';
import { runLightweightIntelligenceUpdate } from '../src/tasks/lightweight-intelligence-update.js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function outputPath(): string {
  return process.env.INTELLIGENCE_LIGHTWEIGHT_OUTPUT_PATH || path.join('data', 'latest-intelligence-brief.json');
}

async function main(): Promise<void> {
  const result = await runLightweightIntelligenceUpdate({
    date: getArg('date'),
    recommendationLimit: parseNumber(getArg('recommendation-limit')),
    topicLimit: parseNumber(getArg('limit')),
    evidenceLimitPerTopic: parseNumber(getArg('evidence-limit'))
  });
  const output = {
    schemaVersion: 1,
    mode: 'lightweight',
    runId: result.runId,
    generatedAt: result.generatedAt,
    targetDate: result.brief.date,
    brief: result.brief,
    sections: result.sections
  };
  const target = outputPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  if (getArg('format') === 'text') {
    console.log(renderIntelligenceBriefText(result.brief));
  } else {
    console.log(`Generated ${target} (${result.runId})`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
