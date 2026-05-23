/**
 * WeChat Notifier
 * 通过本地 WeClaw HTTP API 发送到个人微信
 */

import http from 'node:http';
import https from 'node:https';
import { getEnv } from '../config/env.js';
import type { TrendingDigest } from '../trending/types.js';
import type { Notifier, NotifyOptions, NotifyResult } from './types.js';
import { withRetry, isRetryableHttpError } from '../utils/retry.js';

const DEFAULT_WECLAW_API_URL = 'http://127.0.0.1:18011/api/send';

function resolveWeClawSendUrl(raw?: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_WECLAW_API_URL;

  if (trimmed.endsWith('/api/send')) {
    return trimmed;
  }

  return `${trimmed.replace(/\/$/, '')}/api/send`;
}

function buildTextContent(digest: TrendingDigest): string {
  const lines: string[] = [];

  lines.push(`GitHub Trending 推荐 - ${digest.date}`);
  lines.push('');
  lines.push(digest.summary);
  lines.push('');
  lines.push(`你的当前实战背景：${digest.profile.summary}`);
  lines.push(`当前重点方向：${digest.profile.focusAreas.join('、')}`);
  lines.push('');
  lines.push('今日推荐：');
  lines.push('');

  digest.recommendations.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.repo.fullName}`);
    lines.push(`匹配分：${item.score}`);
    lines.push(`链接：${item.repo.url}`);
    lines.push(`描述：${item.repo.description || '暂无项目描述'}`);
    lines.push(`语言：${item.repo.language ?? '未知'} | 今日新增：${item.repo.starsToday} | 总星标：${item.repo.totalStars ?? 'n/a'}`);

    if (item.reasons.length > 0) {
      lines.push(`推荐原因：${item.reasons.join('；')}`);
    }

    if (item.practiceIdeas.length > 0) {
      lines.push(`实践建议：${item.practiceIdeas.join('；')}`);
    }

    lines.push('');
  });

  return lines.join('\n').trim();
}

interface HttpResponsePayload {
  statusCode: number;
  body: string;
}

async function postJson(urlString: string, payload: Record<string, unknown>): Promise<HttpResponsePayload> {
  const url = new URL(urlString);
  const transport = url.protocol === 'https:' ? https : http;
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 15000
      },
      (response) => {
        let responseBody = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          responseBody += chunk;
        });
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: responseBody
          });
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('WeClaw API request timed out'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function parseResponse(statusCode: number, text: string): Record<string, unknown> | undefined {
  if (!text.trim()) return undefined;

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`WeClaw API returned non-JSON response (${statusCode}): ${text.slice(0, 200)}`);
  }
}

export class WeChatNotifier implements Notifier {
  readonly name = 'wechat';

  async notify(options: NotifyOptions): Promise<NotifyResult> {
    const env = getEnv();
    const recipient = options.wechatTo?.trim() || env.WECHAT_TO?.trim();

    if (!recipient) {
      return {
        channel: this.name,
        success: false,
        skipped: true,
        reason: '缺少微信接收方：请设置 WECHAT_TO 环境变量或通过 --wechat-to 参数指定'
      };
    }

    const endpoint = resolveWeClawSendUrl(env.WECLAW_API_URL);

    try {
      // 使用重试机制发送微信消息
      await withRetry(
        async () => {
          const response = await postJson(endpoint, {
            to: recipient,
            text: buildTextContent(options.digest)
          });

          const payload = parseResponse(response.statusCode, response.body);

          if (response.statusCode < 200 || response.statusCode >= 300) {
            const message =
              typeof payload?.error === 'string'
                ? payload.error
                : typeof payload?.message === 'string'
                  ? payload.message
                  : `HTTP ${response.statusCode}`;

            throw new Error(`WeClaw API 错误: ${message} (HTTP ${response.statusCode})`);
          }

          return payload;
        },
        {
          maxRetries: 3,
          initialDelay: 1500,
          shouldRetry: (error) => {
            if (error instanceof Error) {
              const message = error.message;

              // 网络连接错误
              if (
                message.includes('ECONNREFUSED') ||
                message.includes('ENOTFOUND') ||
                message.includes('ETIMEDOUT') ||
                message.includes('timed out')
              ) {
                return true;
              }

              // 检查 HTTP 状态码
              const statusMatch = message.match(/HTTP (\d{3})/);
              if (statusMatch) {
                const statusCode = Number.parseInt(statusMatch[1], 10);
                return isRetryableHttpError(statusCode);
              }
            }

            return false;
          },
          onRetry: (error, attempt, delay) => {
            console.error(
              `[WeChat Notifier] 重试 ${attempt}/3（${delay}ms 后）: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );

      return {
        channel: this.name,
        success: true,
        skipped: false,
        destination: recipient
      };
    } catch (error) {
      // 优化错误消息
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (error instanceof Error) {
        const message = error.message;

        if (message.includes('ECONNREFUSED')) {
          errorMessage = `无法连接到 WeClaw 服务 (${endpoint})：请确保 WeClaw 已启动（运行 'weclaw start'）`;
        } else if (message.includes('ENOTFOUND')) {
          errorMessage = `找不到 WeClaw 服务：请检查 WECLAW_API_URL 配置 (${endpoint})`;
        } else if (message.includes('timed out')) {
          errorMessage = 'WeClaw API 请求超时：请检查 WeClaw 服务状态';
        } else if (message.includes('not logged in') || message.includes('未登录')) {
          errorMessage = 'WeClaw 未登录：请运行 \'weclaw login\' 扫码登录微信';
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

export function createWeChatNotifier(): Notifier {
  return new WeChatNotifier();
}
