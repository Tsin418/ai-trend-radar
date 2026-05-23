import nodemailer from 'nodemailer';
import { getEnv } from '../config/env.js';
import type { TrendingDigest, TrendingRecommendation } from '../trending/types.js';

export interface SendTrendingEmailOptions {
  digest: TrendingDigest;
  to?: string;
}

export interface SendTrendingEmailResult {
  sent: boolean;
  skipped: boolean;
  messageId?: string;
  to?: string;
  reason?: string;
}

interface ResolvedSmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  from?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'n/a';
  return value.toLocaleString();
}

function buildRecommendationBlock(item: TrendingRecommendation): string {
  const reasons = item.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('');
  const ideas = item.practiceIdeas.map((idea) => `<li>${escapeHtml(idea)}</li>`).join('');

  return `
    <tr>
      <td style="padding:16px 0;border-top:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">匹配分 ${item.score.toLocaleString()}</div>
        <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:6px;">${escapeHtml(item.repo.fullName)}</div>
        <div style="font-size:14px;color:#4b5563;line-height:1.6;margin-bottom:10px;">${escapeHtml(item.repo.description || '暂无项目描述')}</div>
        <div style="font-size:13px;color:#374151;margin-bottom:10px;">
          <strong>语言：</strong> ${escapeHtml(item.repo.language ?? '未知')}
          <span style="margin-left:12px;"><strong>今日新增：</strong> ${formatNumber(item.repo.starsToday)} stars</span>
          <span style="margin-left:12px;"><strong>总星标：</strong> ${formatNumber(item.repo.totalStars)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:6px;">为什么值得你做</div>
            <ul style="margin:0;padding-left:18px;color:#374151;line-height:1.6;">${reasons}</ul>
          </div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:6px;">建议怎么实践</div>
            <ul style="margin:0;padding-left:18px;color:#374151;line-height:1.6;">${ideas}</ul>
          </div>
        </div>
      </td>
    </tr>
  `;
}

export function buildTrendingEmailHtml(digest: TrendingDigest): string {
  const recommendations = digest.recommendations.map(buildRecommendationBlock).join('');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:32px 0;color:#111827;">
    <div style="max-width:900px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;">
      <div style="padding:28px 32px;background:linear-gradient(135deg,#111827 0%,#1f2937 55%,#334155 100%);color:#f9fafb;">
        <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.75;">每日 GitHub Trending 推荐</div>
        <h1 style="margin:8px 0 10px;font-size:30px;line-height:1.2;">${escapeHtml(digest.date)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.7;max-width:760px;opacity:.92;">${escapeHtml(digest.summary)}</p>
      </div>
      <div style="padding:28px 32px;">
        <div style="margin-bottom:18px;">
          <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:6px;">你的当前实战背景</div>
          <div style="color:#4b5563;line-height:1.7;">${escapeHtml(digest.profile.summary)}</div>
        </div>
        <div style="margin-bottom:12px;">
          <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:6px;">当前重点方向</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${digest.profile.focusAreas.map((area) => `<span style="padding:6px 10px;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:12px;">${escapeHtml(area)}</span>`).join('')}
          </div>
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${recommendations}
        </table>
      </div>
    </div>
  </div>`;
}

export function buildTrendingEmailText(digest: TrendingDigest): string {
  const lines: string[] = [];
  lines.push(`每日 GitHub Trending 推荐 - ${digest.date}`);
  lines.push('');
  lines.push(digest.summary);
  lines.push('');
  lines.push(`你的当前实战背景：${digest.profile.summary}`);
  lines.push(`当前重点方向：${digest.profile.focusAreas.join('、')}`);
  lines.push('');

  digest.recommendations.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.repo.fullName}（匹配分 ${item.score}）`);
    lines.push(`   项目描述：${item.repo.description || '暂无项目描述'}`);
    lines.push(`   语言：${item.repo.language ?? '未知'}`);
    lines.push(`   今日新增：${item.repo.starsToday.toLocaleString()} stars`);
    lines.push(`   总星标：${formatNumber(item.repo.totalStars)}`);
    lines.push(`   推荐原因：${item.reasons.join('；')}`);
    lines.push(`   实践建议：${item.practiceIdeas.join('；')}`);
    lines.push('');
  });

  lines.push('本次扫描到的 Trending 项目：');
  digest.repositories.slice(0, 10).forEach((repo) => {
    lines.push(`- #${repo.rank} ${repo.fullName}（${repo.language ?? '未知'}）- 今日新增 ${repo.starsToday.toLocaleString()} stars`);
  });

  return lines.join('\n');
}

function parseBoolean(value?: string): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

function resolveSmtpConfig(): ResolvedSmtpConfig {
  const env = getEnv();
  const user = env.SMTP_USER?.trim() || env.GMAIL_USER?.trim();
  const password = env.SMTP_PASSWORD?.trim() || env.GMAIL_APP_PASSWORD?.trim();
  const explicitHost = env.SMTP_HOST?.trim();
  const explicitPort = env.SMTP_PORT ? Number.parseInt(env.SMTP_PORT, 10) : undefined;
  const explicitSecure = parseBoolean(env.SMTP_SECURE);
  const from = env.MAIL_FROM?.trim() || user;

  if (explicitHost) {
    return {
      host: explicitHost,
      port: explicitPort ?? 465,
      secure: explicitSecure ?? true,
      user,
      password,
      from
    };
  }

  if (user?.endsWith('@qq.com')) {
    return { host: 'smtp.qq.com', port: 465, secure: true, user, password, from };
  }

  if (user?.endsWith('@gmail.com')) {
    return { host: 'smtp.gmail.com', port: 465, secure: true, user, password, from };
  }

  return {
    host: explicitHost,
    port: explicitPort,
    secure: explicitSecure,
    user,
    password,
    from
  };
}

export async function sendTrendingEmail(options: SendTrendingEmailOptions): Promise<SendTrendingEmailResult> {
  const env = getEnv();
  const smtp = resolveSmtpConfig();
  const recipient = options.to?.trim() || env.TRENDING_EMAIL_TO?.trim() || smtp.user;

  if (!smtp.user || !smtp.password) {
    return { sent: false, skipped: true, reason: 'Missing SMTP_USER/SMTP_PASSWORD' };
  }

  if (!recipient) {
    return { sent: false, skipped: true, reason: 'Missing email recipient' };
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

  const subject = `GitHub Trending 中文推荐 - ${options.digest.date}`;
  const html = buildTrendingEmailHtml(options.digest);
  const text = buildTrendingEmailText(options.digest);
  const result = await transporter.sendMail({
    from: smtp.from,
    to: recipient,
    subject,
    text,
    html
  });

  return {
    sent: true,
    skipped: false,
    messageId: result.messageId,
    to: recipient
  };
}
