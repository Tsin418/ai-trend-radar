import { getEnv } from '../config/env.js';
import { fetchGitHubTrending } from '../collectors/github-trending.js';
import type { SendTrendingEmailResult } from '../email/smtp.js';
import { createRuleBasedRanker, type TrendingRanker } from '../rankers/index.js';
import { buildTrendingDigest } from '../reports/github-trending-digest.js';
import { getTrendingProfile, getDemoProfile } from '../trending/profile.js';
import type { TrendingDigest } from '../trending/types.js';
import { createEmailNotifier, createWeChatNotifier, createCompositeNotifier, type Notifier, type NotifyResult } from '../notifiers/index.js';

type SupportedNotifierChannel = 'email' | 'wechat';

export interface RunGithubTrendingDigestOptions {
  sendEmail?: boolean;
  emailTo?: string;
  wechatTo?: string;
  repoLimit?: number;
  recommendationLimit?: number;
  useDemoProfile?: boolean;
}

export interface RunGithubTrendingDigestResult {
  ok: boolean;
  digest?: TrendingDigest;
  email?: SendTrendingEmailResult;
  notify?: NotifyResult;
  error?: string;
}

function parseLimit(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createRanker(): TrendingRanker {
  return createRuleBasedRanker();
}

function getConfiguredChannels(): SupportedNotifierChannel[] {
  const env = getEnv();
  const rawChannels = env.NOTIFIER_CHANNELS?.split(',').map((channel) => channel.trim()).filter(Boolean) ?? ['email'];
  const validChannels: SupportedNotifierChannel[] = ['email', 'wechat'];
  const invalidChannels = rawChannels.filter((channel) => !validChannels.includes(channel as SupportedNotifierChannel));

  if (invalidChannels.length > 0) {
    throw new Error(`Unsupported NOTIFIER_CHANNELS: ${invalidChannels.join(', ')}`);
  }

  if (rawChannels.length === 0) {
    return ['email'];
  }

  return rawChannels as SupportedNotifierChannel[];
}

export async function generateGithubTrendingDigest(options: RunGithubTrendingDigestOptions = {}): Promise<TrendingDigest> {
  const env = getEnv();
  const profile = options.useDemoProfile ? getDemoProfile() : getTrendingProfile();
  const ranker = createRanker();
  const repoLimit = options.repoLimit ?? parseLimit(env.TRENDING_REPO_LIMIT, 10);
  const recommendationLimit = options.recommendationLimit ?? parseLimit(env.TRENDING_RECOMMENDATION_LIMIT, 5);
  const repositories = await fetchGitHubTrending(repoLimit);

  return buildTrendingDigest(
    repositories,
    profile,
    new Date().toISOString().slice(0, 10),
    recommendationLimit,
    ranker
  );
}

function createNotifier(): Notifier {
  const channels = getConfiguredChannels();
  const notifiers: Notifier[] = [];

  for (const channel of channels) {
    if (channel === 'email') {
      notifiers.push(createEmailNotifier());
    } else if (channel === 'wechat') {
      notifiers.push(createWeChatNotifier());
    }
  }

  if (notifiers.length === 0) {
    return createEmailNotifier();
  }

  if (notifiers.length === 1) {
    return notifiers[0];
  }

  return createCompositeNotifier(notifiers);
}

export async function runGithubTrendingDigest(options: RunGithubTrendingDigestOptions = {}): Promise<RunGithubTrendingDigestResult> {
  try {
    const digest = await generateGithubTrendingDigest(options);
    const shouldSendNotification = options.sendEmail ?? true;

    if (!shouldSendNotification) {
      return { ok: true, digest };
    }

    const channels = getConfiguredChannels();
    const notifier = createNotifier();
    const notify = await notifier.notify({
      digest,
      emailTo: options.emailTo,
      wechatTo: options.wechatTo
    });

    const emailNotifyResult = channels.includes('email')
      ? (notify.channelResults?.email ?? (notify.channel === 'email' ? notify : undefined))
      : undefined;

    const email: SendTrendingEmailResult | undefined = emailNotifyResult
      ? {
          sent: emailNotifyResult.success,
          skipped: emailNotifyResult.skipped,
          messageId: emailNotifyResult.messageId,
          to: emailNotifyResult.destination,
          reason: emailNotifyResult.reason ?? emailNotifyResult.error
        }
      : undefined;

    return {
      ok: true,
      digest,
      email,
      notify
    };
  } catch (error) {
    console.error('Failed to run GitHub Trending digest', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
