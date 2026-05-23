/**
 * 通用的通知通道接口
 * 支持邮件、微信、Telegram 等多种通知方式
 */

import type { TrendingDigest } from '../trending/types.js';
import type { RadarDigest } from '../radar/types.js';

export interface NotifyOptions {
  digest: TrendingDigest;
  radarDigest?: RadarDigest;
  to?: string;
  emailTo?: string;
  wechatTo?: string;
}

export interface NotifyResult {
  channel?: string;
  success: boolean;
  skipped: boolean;
  partial?: boolean;
  messageId?: string;
  destination?: string;
  reason?: string;
  error?: string;
  channelResults?: Record<string, NotifyResult>;
}

export interface Notifier {
  /**
   * 通知通道名称（如 'email', 'wechat', 'telegram'）
   */
  readonly name: string;

  /**
   * 发送通知
   */
  notify(options: NotifyOptions): Promise<NotifyResult>;
}

export type NotifierFactory = () => Notifier;
