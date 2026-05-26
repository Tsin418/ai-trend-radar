import dotenv from 'dotenv';
import { createProductHuntCollector } from '../src/collectors/producthunt.js';
import type { ProductHuntCollectorOptions } from '../src/collectors/producthunt-types.js';
import type { TrendingItem } from '../src/collectors/types.js';

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

function parseFormat(value: string | undefined): 'text' | 'json' {
  return value === 'json' ? 'json' : 'text';
}

function buildOptions(): ProductHuntCollectorOptions {
  const topic = getArg('topic');
  return {
    limit: parseNumber(getArg('limit')),
    daysBack: parseNumber(getArg('days-back')),
    topics: topic ? [topic] : undefined
  };
}

function renderText(items: TrendingItem[], scanned: number): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `Product Hunt AI Launch Radar｜${date}`,
    '',
    `Scanned: ${scanned} posts`,
    `Selected: ${items.length} AI/devtool-relevant posts`,
    ''
  ];

  for (const item of items) {
    const metadata = item.metadata;
    const website = typeof metadata.website === 'string' ? metadata.website : null;
    const votesCount = typeof metadata.votesCount === 'number' ? metadata.votesCount : 0;
    const commentsCount = typeof metadata.commentsCount === 'number' ? metadata.commentsCount : 0;

    lines.push(`${item.rank}. ${item.title}`);
    lines.push(`   Product Hunt: ${item.url}`);
    if (website) lines.push(`   Website: ${website}`);
    lines.push(`   Votes: ${votesCount} | Comments: ${commentsCount} | Heat: ${item.heatScore}`);
    if (item.tags.length > 0) lines.push(`   Topics: ${item.tags.join(', ')}`);
    if (item.description) lines.push(`   Tagline: ${item.description}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

async function main(): Promise<void> {
  const options = buildOptions();
  const format = parseFormat(getArg('format'));
  const collector = createProductHuntCollector(options);
  const limit = options.limit ?? parseNumber(process.env.PRODUCT_HUNT_POST_LIMIT) ?? 30;
  const items = await collector.fetch(limit);

  if (format === 'json') {
    console.log(JSON.stringify({
      source: 'producthunt',
      scanned: limit,
      selected: items.length,
      items
    }, null, 2));
    return;
  }

  console.log(renderText(items, limit));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
