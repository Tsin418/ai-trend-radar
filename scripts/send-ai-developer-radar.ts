import dotenv from 'dotenv';
import { renderRadarDigestText } from '../src/renderers/radar-text.js';
import { runAiDeveloperRadarDaily } from '../src/tasks/ai-developer-radar-daily.js';
import { runAiDeveloperRadarWeekly } from '../src/tasks/ai-developer-radar-weekly.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

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
  const mode = getArg('mode') === 'weekly' ? 'weekly' : 'daily';
  const dryRun = hasFlag('dry-run') || !hasFlag('send');
  const useSampleData = hasFlag('sample');
  const options = {
    send: !dryRun,
    baselineOnly: hasFlag('baseline'),
    useSampleData,
    repoLimit: parseNumber(getArg('repo-limit')),
    recommendationLimit: parseNumber(getArg('recommendation-limit'))
  };
  const result = mode === 'weekly'
    ? await runAiDeveloperRadarWeekly(options)
    : await runAiDeveloperRadarDaily(options);

  if (!result.ok || !result.digest) {
    console.error(result.error ?? 'AI Developer Radar failed.');
    process.exit(1);
  }

  console.log(renderRadarDigestText(result.digest));

  if (result.notify) {
    if (result.notify.skipped) {
      console.log(`\n通知已跳过: ${result.notify.reason ?? 'unknown reason'}`);
    } else if (!result.notify.success) {
      console.error(`\n通知发送失败: ${result.notify.error ?? result.notify.reason ?? 'unknown error'}`);
      process.exit(1);
    } else {
      console.log(`\n通知已发送: ${result.notify.channel}`);
    }
  } else {
    console.log('\nDry run 完成，未发送通知。');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
