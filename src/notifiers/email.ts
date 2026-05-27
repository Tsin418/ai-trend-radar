/**
 * Email Notifier
 * 通过 SMTP 发送邮件
 */

import nodemailer from 'nodemailer';
import { getEnv } from '../config/env.js';
import { renderRadarDigestText } from '../renderers/radar-text.js';
import type { TrendingDigest, TrendingRecommendation } from '../trending/types.js';
import type { Notifier, NotifyOptions, NotifyResult } from './types.js';
import { withRetry, isNetworkError } from '../utils/retry.js';

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

function buildEmailHtml(digest: TrendingDigest): string {
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

function buildEmailText(digest: TrendingDigest): string {
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

function buildRadarEmailHtml(text: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px 0;color:#111827;">
    <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;margin:0;padding:24px;">${escapeHtml(text)}</pre>
    </div>
  </div>`;
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

export class EmailNotifier implements Notifier {
  readonly name = 'email';

  async notify(options: NotifyOptions): Promise<NotifyResult> {
    const env = getEnv();
    const smtp = resolveSmtpConfig();
    const recipient = options.emailTo?.trim() || options.to?.trim() || env.TRENDING_EMAIL_TO?.trim() || smtp.user;

    if (!smtp.user || !smtp.password) {
      return {
        channel: this.name,
        success: false,
        skipped: true,
        reason: '缺少 SMTP 配置：请设置 SMTP_USER 和 SMTP_PASSWORD 环境变量'
      };
    }

    if (!smtp.host) {
      return {
        channel: this.name,
        success: false,
        skipped: true,
        reason: '无法自动识别 SMTP 服务器：请设置 SMTP_HOST 环境变量'
      };
    }

    if (!recipient) {
      return {
        channel: this.name,
        success: false,
        skipped: true,
        reason: '缺少收件人：请设置 TRENDING_EMAIL_TO 环境变量或通过 --email-to 参数指定'
      };
    }

    try {
      // 使用重试机制发送邮件
      const result = await withRetry(
        async () => {
          const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure,
            auth: {
              user: smtp.user,
              pass: smtp.password
            }
          });

          const radarText = options.radarDigest ? renderRadarDigestText(options.radarDigest, 'compact') : undefined;
          const subject = options.radarDigest?.title ?? `GitHub Trending 中文推荐 - ${options.digest.date}`;
          const text = radarText ?? buildEmailText(options.digest);
          const html = radarText ? buildRadarEmailHtml(radarText) : buildEmailHtml(options.digest);

          return await transporter.sendMail({
            from: smtp.from,
            to: recipient,
            subject,
            text,
            html
          });
        },
        {
          maxRetries: 3,
          initialDelay: 2000,
          shouldRetry: (error) => {
            // 网络错误重试
            if (isNetworkError(error)) {
              return true;
            }

            // 临时性 SMTP 错误重试（4xx/5xx）
            if (error instanceof Error) {
              const message = error.message.toLowerCase();
              // SMTP 临时错误码
              if (message.includes('421') || message.includes('450') || message.includes('451')) {
                return true;
              }
              // SMTP 服务不可用
              if (message.includes('503') || message.includes('554')) {
                return true;
              }
            }

            return false;
          },
          onRetry: (error, attempt, delay) => {
            console.error(
              `[Email Notifier] 重试 ${attempt}/3（${delay}ms 后）: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );

      return {
        channel: this.name,
        success: true,
        skipped: false,
        messageId: result.messageId,
        destination: recipient
      };
    } catch (error) {
      // 优化错误消息
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (message.includes('invalid login') || message.includes('authentication failed')) {
          errorMessage = 'SMTP 认证失败：请检查 SMTP_USER 和 SMTP_PASSWORD 是否正确';
        } else if (message.includes('econnrefused')) {
          errorMessage = `无法连接到 SMTP 服务器 ${smtp.host}:${smtp.port}：请检查网络连接和 SMTP 配置`;
        } else if (message.includes('enotfound')) {
          errorMessage = `找不到 SMTP 服务器 ${smtp.host}：请检查 SMTP_HOST 配置`;
        } else if (message.includes('timeout')) {
          errorMessage = 'SMTP 连接超时：请检查网络连接或稍后重试';
        } else if (message.includes('550')) {
          errorMessage = '邮件被拒绝：收件人地址可能无效或不存在';
        }
      }

      return {
        channel: this.name,
        success: false,
        skipped: false,
        error: errorMessage
      };
    }
  }
}

export function createEmailNotifier(): Notifier {
  return new EmailNotifier();
}
