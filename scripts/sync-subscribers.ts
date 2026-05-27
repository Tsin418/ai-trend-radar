import path from 'node:path';
import dotenv from 'dotenv';
import {
  fetchGitHubIssueSubscribers,
  sendDigestToSubscribers,
  syncSubscribersToMailchimp
} from '../src/email/subscriber.js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function loadSubscribers() {
  const repo = process.env.SUBSCRIBER_GITHUB_REPO || process.env.GITHUB_REPOSITORY || 'Tsin418/ai-trend-radar';
  const token = process.env.GITHUB_TOKEN;
  const label = process.env.SUBSCRIBER_ISSUE_LABEL || 'subscriber';
  if (!token) throw new Error('GITHUB_TOKEN is required to read subscriber issues.');
  return fetchGitHubIssueSubscribers(repo, token, label);
}

async function main(): Promise<void> {
  const subscribers = await loadSubscribers();
  if (hasFlag('send')) {
    const digestPath = getArg('digest') ?? path.join('data', 'latest-daily-digest.json');
    const frequency = getArg('frequency') === 'weekly' ? 'weekly' : 'daily';
    const results = await sendDigestToSubscribers(subscribers, digestPath, frequency, hasFlag('dry-run'));
    console.log(JSON.stringify({ subscriberCount: subscribers.length, results }, null, 2));
    return;
  }

  const results = await syncSubscribersToMailchimp(subscribers);
  console.log(JSON.stringify({ subscriberCount: subscribers.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
