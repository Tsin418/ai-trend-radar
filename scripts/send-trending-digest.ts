import dotenv from 'dotenv';
import { defineCommand, runMain } from 'citty';
import { runGithubTrendingDigest } from '../src/tasks/github-trending-digest.js';
import type { TrendingDigest } from '../src/trending/types.js';
import { formatDemoOutput, formatEnhancedOutput } from '../src/reports/terminal-formatter.js';
import { runInitWizard } from '../src/cli/init-wizard.js';

// 只在本地开发环境加载 .env 文件（非 node_modules 运行）
// npx 场景下应该依赖系统环境变量或 CLI 参数
const isRunningFromNodeModules = import.meta.url.includes('/node_modules/');
if (!isRunningFromNodeModules) {
  dotenv.config({ path: '.env.local' });
  dotenv.config();
}

interface OutputFormatters {
  text: (digest: TrendingDigest, notifyInfo?: { to?: string; destination?: string; messageId?: string; skipped?: boolean; partial?: boolean; reason?: string; error?: string }) => void;
  json: (digest: TrendingDigest, notifyInfo?: { to?: string; destination?: string; messageId?: string; skipped?: boolean; partial?: boolean; reason?: string; error?: string }) => void;
}

const formatters: OutputFormatters = {
  text(digest, notifyInfo) {
    console.log(`日报日期: ${digest.date}`);
    console.log(`扫描项目数: ${digest.repositories.length}`);
    console.log(`推荐项目数: ${digest.recommendations.length}`);

    digest.recommendations.forEach((item, index) => {
      console.log(`${index + 1}. ${item.repo.fullName} [score=${item.score}]`);
    });

    if (notifyInfo?.skipped) {
      console.log(`通知已跳过: ${notifyInfo.reason ?? 'unknown reason'}`);
    } else if (notifyInfo?.partial) {
      console.log(`通知部分成功: ${notifyInfo.destination ?? 'unknown destination'}`);
      if (notifyInfo.reason) {
        console.log(notifyInfo.reason);
      }
    } else if (notifyInfo?.reason || notifyInfo?.error) {
      console.log(`通知发送失败: ${notifyInfo.reason ?? notifyInfo.error}`);
    } else if (notifyInfo?.destination || notifyInfo?.to) {
      console.log(`通知已发送到 ${notifyInfo.destination ?? notifyInfo.to} (${notifyInfo.messageId ?? 'no message id'})`);
    } else {
      console.log('Dry run 完成，未发送通知。');
    }
  },

  json(digest, notifyInfo) {
    const output = {
      date: digest.date,
      generatedAt: digest.generatedAt,
      stats: {
        scanned: digest.repositories.length,
        recommended: digest.recommendations.length
      },
      recommendations: digest.recommendations.map((item) => ({
        rank: item.repo.rank,
        fullName: item.repo.fullName,
        url: item.repo.url,
        description: item.repo.description,
        language: item.repo.language,
        starsToday: item.repo.starsToday,
        totalStars: item.repo.totalStars,
        score: item.score,
        reasons: item.reasons,
        practiceIdeas: item.practiceIdeas
      })),
      notify: notifyInfo
    };
    console.log(JSON.stringify(output, null, 2));
  }
};

const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: '交互式配置向导 - 3 分钟完成个性化配置'
  },
  async run() {
    await runInitWizard();
  }
});

const main = defineCommand({
  meta: {
    name: 'github-trending-radar',
    version: '0.1.0',
    description: 'GitHub Trending 个性化邮件推荐系统'
  },
  subCommands: {
    init: initCommand
  },
  args: {
    demo: {
      type: 'boolean',
      description: 'Demo 模式：零配置体验，使用预设 AI 产品开发者 profile',
      default: false
    },
    'dry-run': {
      type: 'boolean',
      description: '测试模式，不发送邮件',
      default: false
    },
    to: {
      type: 'string',
      description: '收件人邮箱地址（兼容旧参数，等同于 --email-to）'
    },
    'email-to': {
      type: 'string',
      description: '收件人邮箱地址（覆盖环境变量）'
    },
    'wechat-to': {
      type: 'string',
      description: '微信接收方 ID（例如 user_id@im.wechat）'
    },
    'repo-limit': {
      type: 'string',
      description: '扫描项目数量（默认 10）',
      valueHint: 'number'
    },
    'recommendation-limit': {
      type: 'string',
      description: '推荐项目数量（默认 5）',
      valueHint: 'number'
    },
    format: {
      type: 'string',
      description: '输出格式：text 或 json',
      default: 'text',
      valueHint: 'text|json'
    }
  },
  async run({ args }) {
    const isDemoMode = args.demo;
    const dryRun = args['dry-run'] || isDemoMode; // demo 模式强制 dry-run
    const emailTo = args['email-to'] || args.to;
    const wechatTo = args['wechat-to'];
    const repoLimit = args['repo-limit'] ? Number.parseInt(args['repo-limit'], 10) : undefined;
    const recommendationLimit = args['recommendation-limit'] ? Number.parseInt(args['recommendation-limit'], 10) : undefined;
    const format = (args.format === 'json' ? 'json' : 'text') as keyof OutputFormatters;

    // Demo 模式下，限制推荐数量为 3（更聚焦）
    const finalRecommendationLimit = isDemoMode ? 3 : recommendationLimit;

    const result = await runGithubTrendingDigest({
      sendEmail: !dryRun,
      emailTo,
      wechatTo,
      repoLimit,
      recommendationLimit: finalRecommendationLimit,
      useDemoProfile: isDemoMode // 新增参数，告诉任务使用 demo profile
    });

    if (!result.ok || !result.digest) {
      if (format === 'json') {
        console.error(JSON.stringify({ error: result.error ?? 'Unknown error' }, null, 2));
      } else {
        console.error('GitHub Trending digest failed.');
        if (result.error) console.error(result.error);
      }
      process.exit(1);
    }

    const notifyResult = result.notify ?? (result.email
      ? {
          to: result.email.to,
          messageId: result.email.messageId,
          skipped: result.email.skipped,
          reason: result.email.reason
        }
      : undefined);

    // Demo 模式使用增强格式化输出
    if (isDemoMode && format === 'text') {
      formatDemoOutput(result.digest);
    } else if (format === 'text' && dryRun) {
      // dry-run 模式也使用增强输出（但不显示 demo 引导）
      formatEnhancedOutput(result.digest);
    } else {
      // 其他情况使用原有格式化
      formatters[format](result.digest, notifyResult);
    }

    // 只有在实际发送通知时才检查结果
    if (result.notify) {
      // partial: 部分成功，应该退出 1
      // success: false 且 skipped: false，表示发送失败，应该退出 1
      if (result.notify.partial || (!result.notify.success && !result.notify.skipped)) {
        process.exit(1);
      }
    }
    // dry-run 模式 (result.notify === undefined) 正常退出
  }
});

runMain(main);
