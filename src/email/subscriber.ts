import crypto from 'node:crypto';
import fs from 'node:fs';
import nodemailer from 'nodemailer';
import { getEnv } from '../config/env.js';

export interface Subscriber {
  email: string;
  frequency: Array<'daily' | 'weekly'>;
  categories: string[];
  source: 'github-issue' | 'mailchimp' | 'manual';
  sourceId?: string;
}

export interface GitHubIssueSubscriber {
  number: number;
  title: string;
  body: string;
}

export interface MailchimpSyncResult {
  email: string;
  status: 'synced' | 'skipped' | 'failed';
  error?: string;
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function readSection(body: string, heading: string): string {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `### ${heading.toLowerCase()}`);
  if (start < 0) return '';
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^###\s+/.test(lines[index])) break;
    collected.push(lines[index]);
  }
  return collected.join('\n').trim();
}

function checkedLabels(section: string): string[] {
  return section.split(/\r?\n/)
    .map((line) => line.match(/-\s+\[[xX]\]\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function normalizeFrequency(labels: string[]): Array<'daily' | 'weekly'> {
  const frequencies = labels.flatMap((label) => {
    const lower = label.toLowerCase();
    if (lower.includes('daily')) return ['daily' as const];
    if (lower.includes('weekly')) return ['weekly' as const];
    return [];
  });
  return unique(frequencies).length > 0 ? unique(frequencies) : ['daily'];
}

export function parseSubscriberIssue(issue: GitHubIssueSubscriber): Subscriber | undefined {
  const emailSection = readSection(issue.body, 'Email') || issue.body;
  const email = emailSection.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.trim().toLowerCase();
  if (!email || !validEmail(email)) return undefined;

  return {
    email,
    frequency: normalizeFrequency(checkedLabels(readSection(issue.body, 'Digest Frequency'))),
    categories: checkedLabels(readSection(issue.body, 'Topics of interest (optional)')),
    source: 'github-issue',
    sourceId: String(issue.number)
  };
}

export async function fetchGitHubIssueSubscribers(repo: string, token: string, label = 'subscriber'): Promise<Subscriber[]> {
  const response = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=100`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'user-agent': 'ai-trend-radar/0.1 (+https://github.com/Tsin418/ai-trend-radar)'
    }
  });
  if (!response.ok) throw new Error(`GitHub issues request failed: HTTP ${response.status}`);
  const issues = await response.json() as Array<{ number: number; title?: string; body?: string; pull_request?: unknown }>;
  return issues
    .filter((issue) => !issue.pull_request)
    .flatMap((issue) => {
      const subscriber = parseSubscriberIssue({
        number: issue.number,
        title: issue.title ?? '',
        body: issue.body ?? ''
      });
      return subscriber ? [subscriber] : [];
    });
}

function mailchimpSubscriberHash(email: string): string {
  return crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
}

export async function upsertMailchimpSubscriber(subscriber: Subscriber): Promise<MailchimpSyncResult> {
  const env = getEnv();
  const apiKey = env.MAILCHIMP_API_KEY?.trim();
  const serverPrefix = env.MAILCHIMP_SERVER_PREFIX?.trim();
  const listId = env.MAILCHIMP_LIST_ID?.trim();
  if (!apiKey || !serverPrefix || !listId) {
    return { email: subscriber.email, status: 'skipped', error: 'Mailchimp config missing' };
  }

  const response = await fetch(`https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members/${mailchimpSubscriberHash(subscriber.email)}`, {
    method: 'PUT',
    headers: {
      authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      email_address: subscriber.email,
      status_if_new: 'subscribed',
      status: 'subscribed',
      tags: subscriber.categories,
      merge_fields: {
        FREQ: subscriber.frequency.join(',')
      }
    })
  });

  if (!response.ok) {
    return {
      email: subscriber.email,
      status: 'failed',
      error: `Mailchimp request failed: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`
    };
  }

  return { email: subscriber.email, status: 'synced' };
}

export async function syncSubscribersToMailchimp(subscribers: Subscriber[]): Promise<MailchimpSyncResult[]> {
  const seen = new Set<string>();
  const deduped = subscribers.filter((subscriber) => {
    if (seen.has(subscriber.email)) return false;
    seen.add(subscriber.email);
    return true;
  });
  const results: MailchimpSyncResult[] = [];
  for (const subscriber of deduped) {
    results.push(await upsertMailchimpSubscriber(subscriber));
  }
  return results;
}

function resolveSmtpConfig() {
  const env = getEnv();
  const user = env.SMTP_USER?.trim() || env.GMAIL_USER?.trim();
  const password = env.SMTP_PASSWORD?.trim() || env.GMAIL_APP_PASSWORD?.trim();
  const host = env.SMTP_HOST?.trim() || (user?.endsWith('@gmail.com') ? 'smtp.gmail.com' : user?.endsWith('@qq.com') ? 'smtp.qq.com' : undefined);
  const port = env.SMTP_PORT ? Number.parseInt(env.SMTP_PORT, 10) : 465;
  return {
    host,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE.toLowerCase() === 'true' : true,
    user,
    password,
    from: env.MAIL_FROM?.trim() || user
  };
}

export async function sendDigestToSubscribers(subscribers: Subscriber[], digestPath: string, frequency: 'daily' | 'weekly', dryRun = false): Promise<MailchimpSyncResult[]> {
  const smtp = resolveSmtpConfig();
  const text = JSON.parse(fs.readFileSync(digestPath, 'utf8')) as { targetDate?: string; text?: string };
  const body = [
    text.text ?? fs.readFileSync(digestPath, 'utf8'),
    '',
    '---',
    'You are receiving this because you subscribed through the AI Trend Radar GitHub issue form. To unsubscribe, close your subscription issue or reply to the sender.'
  ].join('\n');
  const recipients = subscribers.filter((subscriber) => subscriber.frequency.includes(frequency));

  if (dryRun) {
    return recipients.map((subscriber) => ({ email: subscriber.email, status: 'skipped', error: 'dry-run' }));
  }

  if (!smtp.host || !smtp.user || !smtp.password) {
    throw new Error('SMTP config missing; set SMTP_USER/SMTP_PASSWORD and SMTP_HOST if auto-detection is unavailable.');
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.password
    }
  });

  const results: MailchimpSyncResult[] = [];
  for (const subscriber of recipients) {
    try {
      await transporter.sendMail({
        from: smtp.from,
        to: subscriber.email,
        subject: `AI Trend Radar ${frequency} digest${text.targetDate ? ` - ${text.targetDate}` : ''}`,
        text: body
      });
      results.push({ email: subscriber.email, status: 'synced' });
    } catch (error) {
      results.push({
        email: subscriber.email,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return results;
}
