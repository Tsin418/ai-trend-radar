/**
 * Composite Notifier
 * 组合多个 Notifier，同时发送到多个通道
 */

import type { Notifier, NotifyOptions, NotifyResult } from './types.js';
import { getEnv } from '../config/env.js';
import { createFeishuNotifier } from './feishu.js';
import { createTelegramNotifier } from './telegram.js';

export class CompositeNotifier implements Notifier {
  readonly name = 'composite';

  constructor(private notifiers: Notifier[]) {}

  async notify(options: NotifyOptions): Promise<NotifyResult> {
    const results = await Promise.allSettled(
      this.notifiers.map((notifier) => notifier.notify(options))
    );

    const channelResults: Record<string, NotifyResult> = {};
    const successful: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];

    results.forEach((result, index) => {
      const notifier = this.notifiers[index];
      if (result.status === 'fulfilled') {
        const value = result.value;
        channelResults[notifier.name] = value;
        if (value.success) {
          successful.push(value.destination || notifier.name);
        } else if (value.skipped) {
          skipped.push(notifier.name);
        } else {
          failed.push(`${notifier.name}: ${value.error || 'Unknown error'}`);
        }
      } else {
        channelResults[notifier.name] = {
          channel: notifier.name,
          success: false,
          skipped: false,
          error: String(result.reason)
        };
        failed.push(`${notifier.name}: ${result.reason}`);
      }
    });

    const allSuccessful = successful.length === this.notifiers.length;
    const allSkipped = skipped.length === this.notifiers.length;
    const partial = successful.length > 0 && !allSuccessful;

    return {
      channel: this.name,
      success: allSuccessful,
      skipped: allSkipped,
      partial,
      destination: successful.join(', '),
      reason:
        failed.length > 0
          ? `${partial ? 'Partial success' : 'Failed'}: ${failed.join('; ')}`
          : skipped.length > 0
            ? `Skipped: ${skipped.join(', ')}`
            : undefined,
      channelResults
    };
  }
}

export function createCompositeNotifier(notifiers: Notifier[]): Notifier {
  return new CompositeNotifier(notifiers);
}

export function createConfiguredRadarNotifier(): Notifier {
  const env = getEnv();
  const requested = new Set(
    (env.NOTIFIER_CHANNELS ?? 'feishu')
      .split(',')
      .map((channel) => channel.trim().toLowerCase())
      .filter(Boolean)
  );
  const notifiers: Notifier[] = [];

  if (requested.has('feishu') || env.FEISHU_WEBHOOK_URL?.trim()) {
    notifiers.push(createFeishuNotifier());
  }

  if (requested.has('telegram') || (env.TELEGRAM_BOT_TOKEN?.trim() && env.TELEGRAM_CHAT_ID?.trim())) {
    notifiers.push(createTelegramNotifier());
  }

  return notifiers.length === 1 ? notifiers[0] : new CompositeNotifier(notifiers);
}
