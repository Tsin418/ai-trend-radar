import crypto from 'node:crypto';
import https from 'node:https';
import { getEnv } from '../config/env.js';
import { renderRadarDigestText } from '../renderers/radar-text.js';
import type { Notifier, NotifyOptions, NotifyResult } from './types.js';
import { withRetry, isRetryableHttpError } from '../utils/retry.js';

interface HttpResponsePayload {
  statusCode: number;
  body: string;
}

function sign(timestamp: string, secret: string): string {
  const stringToSign = `${timestamp}\n${secret}`;
  return crypto.createHmac('sha256', stringToSign).update('').digest('base64');
}

function postJson(urlString: string, payload: Record<string, unknown>): Promise<HttpResponsePayload> {
  const url = new URL(urlString);
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
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
      request.destroy(new Error('Feishu webhook request timed out'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function parseResponse(statusCode: number, text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Feishu returned non-JSON response (${statusCode}): ${text.slice(0, 200)}`);
  }
}

export class FeishuNotifier implements Notifier {
  readonly name = 'feishu';

  async notify(options: NotifyOptions): Promise<NotifyResult> {
    const env = getEnv();
    const webhook = env.FEISHU_WEBHOOK_URL?.trim();

    if (!webhook) {
      return {
        channel: this.name,
        success: false,
        skipped: true,
        reason: '缺少 FEISHU_WEBHOOK_URL，已跳过飞书推送'
      };
    }

    if (!options.radarDigest) {
      return {
        channel: this.name,
        success: false,
        skipped: true,
        reason: 'FeishuNotifier 需要 radarDigest'
      };
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload: Record<string, unknown> = {
      msg_type: 'text',
      content: {
        text: renderRadarDigestText(options.radarDigest)
      }
    };

    if (env.FEISHU_SECRET?.trim()) {
      payload.timestamp = timestamp;
      payload.sign = sign(timestamp, env.FEISHU_SECRET.trim());
    }

    try {
      const responsePayload = await withRetry(
        async () => {
          const response = await postJson(webhook, payload);
          const parsed = parseResponse(response.statusCode, response.body);
          const code = typeof parsed.code === 'number' ? parsed.code : typeof parsed.StatusCode === 'number' ? parsed.StatusCode : 0;

          if (response.statusCode < 200 || response.statusCode >= 300 || code !== 0) {
            const message = typeof parsed.msg === 'string'
              ? parsed.msg
              : typeof parsed.message === 'string'
                ? parsed.message
                : response.body.slice(0, 200);
            throw new Error(`Feishu webhook error: ${message || `HTTP ${response.statusCode}`}`);
          }

          return parsed;
        },
        {
          maxRetries: 3,
          initialDelay: 1500,
          shouldRetry: (error) => {
            if (!(error instanceof Error)) return false;
            const statusMatch = error.message.match(/HTTP (\d{3})/);
            return statusMatch ? isRetryableHttpError(Number.parseInt(statusMatch[1], 10)) : /timed out|ECONNRESET|ENOTFOUND|EAI_AGAIN/.test(error.message);
          },
          onRetry: (error, attempt, delay) => {
            console.error(`[Feishu Notifier] retry ${attempt}/3 in ${delay}ms: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      );

      return {
        channel: this.name,
        success: true,
        skipped: false,
        destination: webhook,
        messageId: typeof responsePayload.data === 'string' ? responsePayload.data : undefined
      };
    } catch (error) {
      return {
        channel: this.name,
        success: false,
        skipped: false,
        error: error instanceof Error ? error.message : 'Unknown Feishu webhook error'
      };
    }
  }
}

export function createFeishuNotifier(): Notifier {
  return new FeishuNotifier();
}
