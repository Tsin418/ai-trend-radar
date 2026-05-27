import { getEnv } from '../config/env.js';
import { renderRadarDigestText } from '../renderers/radar-text.js';
import { isNetworkError, isRetryableHttpError, withRetry } from '../utils/retry.js';
import type { Notifier, NotifyOptions, NotifyResult } from './types.js';

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

interface TelegramResponse {
  ok: boolean;
  result?: {
    message_id?: number;
  };
  description?: string;
  parameters?: {
    retry_after?: number;
  };
}

interface TelegramPayload {
  chat_id: string;
  text: string;
  parse_mode: 'HTML';
  disable_web_page_preview?: boolean;
  reply_markup?: {
    inline_keyboard: Array<Array<{ text: string; url: string }>>;
  };
}

export function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function splitTelegramMessage(text: string, maxLength = TELEGRAM_MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const breakpoint = Math.max(
      remaining.lastIndexOf('\n\n', maxLength),
      remaining.lastIndexOf('\n', maxLength),
      remaining.lastIndexOf(' ', maxLength)
    );
    const end = breakpoint > maxLength * 0.5 ? breakpoint : maxLength;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function metricText(value: number | null): string {
  return value === null ? 'n/a' : `+${value.toLocaleString()}`;
}

function projectMessage(options: NotifyOptions, index: number): TelegramPayload | undefined {
  const item = options.radarDigest?.selectedProjects[index];
  if (!item) return undefined;
  const repo = item.repository;
  const summary = item.llmSummary;
  const text = [
    `<b>${escapeTelegramHtml(repo.repoFullName)}</b>`,
    `Stars: ${repo.stars.toLocaleString()} (${metricText(item.score.dailyStarDelta)} / 24h)`,
    `Category: ${escapeTelegramHtml(summary?.aiCategory ?? repo.category)}`,
    '',
    escapeTelegramHtml(summary?.whyNow ?? summary?.whyTrending ?? item.whyItMatters),
    '',
    escapeTelegramHtml(summary?.developerInsight ?? summary?.developerTakeaway ?? item.developerInsight),
    '',
    `Risk: ${escapeTelegramHtml(item.score.riskLevel)}`
  ].join('\n');

  return {
    chat_id: '',
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
    reply_markup: {
      inline_keyboard: [[{ text: 'View on GitHub', url: repo.repoUrl }]]
    }
  };
}

export class TelegramNotifier implements Notifier {
  readonly name = 'telegram';

  constructor(
    private botToken?: string,
    private chatId?: string
  ) {}

  private async send(payload: TelegramPayload): Promise<TelegramResponse> {
    const token = this.botToken?.trim();
    if (!token) throw new Error('Missing Telegram bot token');
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({})) as TelegramResponse;
    if (!response.ok || !body.ok) {
      const retryAfter = body.parameters?.retry_after ? ` retry_after=${body.parameters.retry_after}` : '';
      throw new Error(`Telegram API error: HTTP ${response.status}${retryAfter} ${body.description ?? ''}`.trim());
    }
    return body;
  }

  async notify(options: NotifyOptions): Promise<NotifyResult> {
    const env = getEnv();
    const token = this.botToken?.trim() || env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = this.chatId?.trim() || env.TELEGRAM_CHAT_ID?.trim();

    if (!token || !chatId) {
      return {
        channel: this.name,
        success: false,
        skipped: true,
        reason: '缺少 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID，已跳过 Telegram 推送'
      };
    }

    if (!options.radarDigest) {
      return {
        channel: this.name,
        success: false,
        skipped: true,
        reason: 'TelegramNotifier 需要 radarDigest'
      };
    }

    this.botToken = token;
    this.chatId = chatId;
    const sentMessageIds: string[] = [];
    const summaryText = escapeTelegramHtml(renderRadarDigestText(options.radarDigest, 'compact'));
    const payloads: TelegramPayload[] = splitTelegramMessage(summaryText).map((text) => ({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    }));

    try {
      for (const payload of payloads) {
        const result = await withRetry(
          () => this.send(payload),
          {
            maxRetries: 3,
            initialDelay: 1500,
            shouldRetry: (error) => {
              if (isNetworkError(error)) return true;
              if (!(error instanceof Error)) return false;
              const statusMatch = error.message.match(/HTTP (\d{3})/);
              return statusMatch ? isRetryableHttpError(Number.parseInt(statusMatch[1], 10)) : false;
            },
            onRetry: (error, attempt, delay) => {
              console.error(`[Telegram Notifier] retry ${attempt}/3 in ${delay}ms: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        );
        if (result.result?.message_id) sentMessageIds.push(String(result.result.message_id));
      }

      return {
        channel: this.name,
        success: true,
        skipped: false,
        destination: chatId,
        messageId: sentMessageIds.join(',')
      };
    } catch (error) {
      return {
        channel: this.name,
        success: false,
        skipped: false,
        error: error instanceof Error ? error.message : 'Unknown Telegram notifier error'
      };
    }
  }
}

export function createTelegramNotifier(): Notifier {
  return new TelegramNotifier();
}
