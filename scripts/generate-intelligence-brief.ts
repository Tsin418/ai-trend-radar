import dotenv from 'dotenv';
import { buildDailyIntelligenceBrief } from '../src/intelligence/intelligence-brief.js';
import { getLocalDateLabel } from '../src/radar/date.js';
import { renderIntelligenceBriefText } from '../src/renderers/intelligence-text.js';
import { collectAndScoreRadarCandidates, getRadarLimits } from '../src/tasks/ai-developer-radar-shared.js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function main(): Promise<void> {
  const runOptions = {
    baselineOnly: hasFlag('baseline'),
    useSampleData: hasFlag('sample'),
    repoLimit: parseNumber(getArg('repo-limit')),
    recommendationLimit: parseNumber(getArg('recommendation-limit'))
  };
  const { recommendationLimit } = getRadarLimits(runOptions);
  const context = await collectAndScoreRadarCandidates(runOptions);
  const brief = await buildDailyIntelligenceBrief({
    scored: context.scored,
    recommendationLimit,
    date: getArg('date') ?? getLocalDateLabel(),
    sourceHealth: context.sourceHealth,
    topicLimit: parseNumber(getArg('limit')),
    evidenceLimitPerTopic: parseNumber(getArg('evidence-limit'))
  });
  const finalBrief = {
    ...brief,
    dataNotes: [
      ...brief.dataNotes,
      ...context.errors.map((error) => `Collector warning: ${error}`)
    ]
  };

  if (getArg('format') === 'text') {
    console.log(renderIntelligenceBriefText(finalBrief));
    return;
  }

  console.log(JSON.stringify(finalBrief, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
