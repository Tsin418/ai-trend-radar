import { z } from 'zod';

const envSchema = z.object({
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  GMAIL_USER: z.string().email().optional(),
  GMAIL_APP_PASSWORD: z.string().min(6).optional(),
  TRENDING_EMAIL_TO: z.string().email().optional(),
  TRENDING_PROFILE_NOTE: z.string().optional(),
  TRENDING_PROFILE_KEYWORDS: z.string().optional(),
  TRENDING_REPO_LIMIT: z.string().optional(),
  TRENDING_RECOMMENDATION_LIMIT: z.string().optional(),
  WECHAT_TO: z.string().optional(),
  WECLAW_API_URL: z.string().url().optional(),
  FEISHU_WEBHOOK_URL: z.string().url().optional(),
  FEISHU_SECRET: z.string().optional(),
  NOTIFIER_CHANNELS: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  RADAR_REPO_LIMIT: z.string().optional(),
  RADAR_RECOMMENDATION_LIMIT: z.string().optional(),
  RADAR_DAILY_STAR_THRESHOLD: z.string().optional(),
  RADAR_EARLY_SIGNAL_DAILY_THRESHOLD: z.string().optional(),
  RADAR_EARLY_SIGNAL_WEEKLY_THRESHOLD: z.string().optional(),
  RADAR_PROFILE_KEYWORDS: z.string().optional(),
  RADAR_STORE_PATH: z.string().optional(),
  RADAR_USE_SAMPLE_DATA: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.union([z.string().url(), z.literal('')]).optional(),
  DEEPSEEK_MODEL: z.string().optional(),
  LLM_ENRICHMENT_ENABLED: z.string().optional(),
  LLM_ENRICHMENT_LIMIT: z.string().optional(),
  LLM_README_MAX_CHARS: z.string().optional(),
  LLM_TIMEOUT_MS: z.string().optional(),
  LLM_MAX_RETRIES: z.string().optional()
});

export function getEnv() {
  const parsedEnv = envSchema.safeParse(process.env);

  if (!parsedEnv.success) {
    console.error('环境变量验证失败:');
    console.error(JSON.stringify(parsedEnv.error.flatten(), null, 2));
    throw new Error('Invalid environment variables. Please check your .env configuration.');
  }

  return parsedEnv.data;
}
