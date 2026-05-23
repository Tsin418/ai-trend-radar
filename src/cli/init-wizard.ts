import { select, input, password, confirm, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PROFILE_TEMPLATES, type ProfileTemplate } from '../profiles/templates.js';
import { runGithubTrendingDigest } from '../tasks/github-trending-digest.js';
import { formatEnhancedOutput } from '../reports/terminal-formatter.js';

/**
 * SMTP 自动配置规则
 */
const SMTP_PRESETS: Record<string, { host: string; port: number; secure: boolean }> = {
  'qq.com': {
    host: 'smtp.qq.com',
    port: 465,
    secure: true
  },
  'gmail.com': {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true
  },
  '163.com': {
    host: 'smtp.163.com',
    port: 465,
    secure: true
  },
  '126.com': {
    host: 'smtp.126.com',
    port: 465,
    secure: true
  }
};

/**
 * 自动检测 SMTP 配置
 */
function autoDetectSMTP(email: string): { host: string; port: number; secure: boolean } | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  return SMTP_PRESETS[domain] || null;
}

/**
 * 生成 .env.local 内容
 */
function generateEnvContent(config: {
  profileTemplate: ProfileTemplate;
  channels: string[];
  smtpUser?: string;
  smtpPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  emailTo?: string;
  wechatTo?: string;
}): string {
  const lines: string[] = [
    '# GitHub Trending Radar 配置',
    `# 生成时间: ${new Date().toISOString()}`,
    '',
    '# ========================================',
    '# 通知通道配置',
    '# ========================================',
    `NOTIFIER_CHANNELS=${config.channels.join(',')}`,
    ''
  ];

  // 邮件配置
  if (config.channels.includes('email') && config.smtpUser && config.smtpPassword) {
    lines.push('# ========================================');
    lines.push('# 邮件配置');
    lines.push('# ========================================');
    lines.push(`SMTP_USER=${config.smtpUser}`);
    lines.push(`SMTP_PASSWORD=${config.smtpPassword}`);

    if (config.smtpHost) {
      lines.push(`SMTP_HOST=${config.smtpHost}`);
    }
    if (config.smtpPort) {
      lines.push(`SMTP_PORT=${config.smtpPort}`);
    }
    if (config.smtpSecure !== undefined) {
      lines.push(`SMTP_SECURE=${config.smtpSecure}`);
    }

    lines.push(`MAIL_FROM=${config.smtpUser}`);

    if (config.emailTo) {
      lines.push(`TRENDING_EMAIL_TO=${config.emailTo}`);
    }
    lines.push('');
  }

  // 微信配置
  if (config.channels.includes('wechat') && config.wechatTo) {
    lines.push('# ========================================');
    lines.push('# 微信配置（基于 WeClaw）');
    lines.push('# ========================================');
    lines.push('WECLAW_API_URL=http://127.0.0.1:18011');
    lines.push(`WECHAT_TO=${config.wechatTo}`);
    lines.push('');
  }

  // Profile 配置
  lines.push('# ========================================');
  lines.push('# 个性化配置');
  lines.push('# ========================================');
  lines.push(`TRENDING_PROFILE_NOTE=${config.profileTemplate.profile.summary}`);
  lines.push(`TRENDING_PROFILE_KEYWORDS=${config.profileTemplate.profile.keywords.join(',')}`);
  lines.push('TRENDING_REPO_LIMIT=10');
  lines.push('TRENDING_RECOMMENDATION_LIMIT=5');
  lines.push('');

  return lines.join('\n');
}

/**
 * 运行交互式配置向导
 */
export async function runInitWizard(): Promise<void> {
  console.log('\n');
  console.log(chalk.cyan.bold('👋 欢迎使用 GitHub Trending Radar！'));
  console.log(chalk.gray('让我帮你快速配置个性化推荐...\n'));

  try {
    // ========================================
    // 步骤 1: 选择开发者类型
    // ========================================
    console.log(chalk.gray('━'.repeat(80)));
    console.log(chalk.cyan.bold('📋 步骤 1/4: 选择你的开发者类型'));
    console.log(chalk.gray('━'.repeat(80)));
    console.log('');

    const profileTemplateId = await select({
      message: '请选择最符合的描述:',
      choices: PROFILE_TEMPLATES.map((t) => ({
        value: t.id,
        name: t.name,
        description: t.description
      }))
    });

    const profileTemplate = PROFILE_TEMPLATES.find((t) => t.id === profileTemplateId)!;

    console.log(chalk.green(`✓ 已选择: ${profileTemplate.name}\n`));

    // ========================================
    // 步骤 2: 选择通知方式
    // ========================================
    console.log(chalk.gray('━'.repeat(80)));
    console.log(chalk.cyan.bold('📋 步骤 2/4: 选择通知方式'));
    console.log(chalk.gray('━'.repeat(80)));
    console.log('');

    const channels = await checkbox({
      message: '你想如何接收推荐？（多选，空格选择）',
      choices: [
        { value: 'email', name: '邮件（推荐 - 支持 QQ/Gmail/自定义 SMTP）', checked: true },
        { value: 'wechat', name: '微信（需要本地运行 WeClaw）' }
      ],
      required: true
    });

    console.log(chalk.green(`✓ 已选择: ${channels.join(', ')}\n`));

    // ========================================
    // 步骤 3: 配置通知渠道
    // ========================================
    console.log(chalk.gray('━'.repeat(80)));
    console.log(chalk.cyan.bold('📋 步骤 3/4: 配置通知渠道'));
    console.log(chalk.gray('━'.repeat(80)));
    console.log('');

    let smtpUser: string | undefined;
    let smtpPassword: string | undefined;
    let smtpHost: string | undefined;
    let smtpPort: number | undefined;
    let smtpSecure: boolean | undefined;
    let emailTo: string | undefined;
    let wechatTo: string | undefined;

    // 配置邮件
    if (channels.includes('email')) {
      console.log(chalk.cyan('📧 邮件配置\n'));

      smtpUser = await input({
        message: '发件邮箱:',
        validate: (value) => {
          if (!value.includes('@')) return '请输入有效的邮箱地址';
          return true;
        }
      });

      // 自动检测 SMTP
      const smtpPreset = autoDetectSMTP(smtpUser);
      if (smtpPreset) {
        const domain = smtpUser.split('@')[1];
        console.log(chalk.green(`✓ 检测到 ${domain}，自动配置 SMTP\n`));
        smtpHost = smtpPreset.host;
        smtpPort = smtpPreset.port;
        smtpSecure = smtpPreset.secure;
      } else {
        console.log(chalk.yellow('⚠️  未识别邮箱提供商，需要手动配置 SMTP\n'));

        smtpHost = await input({
          message: 'SMTP 服务器地址:',
          default: 'smtp.example.com'
        });

        const portInput = await input({
          message: 'SMTP 端口:',
          default: '465'
        });
        smtpPort = Number.parseInt(portInput, 10);

        smtpSecure = await confirm({
          message: '使用 SSL/TLS?',
          default: true
        });
      }

      smtpPassword = await password({
        message: 'SMTP 授权码（不是密码）:',
        mask: '*',
        validate: (value) => {
          if (!value) return '授权码不能为空';
          return true;
        }
      });

      console.log(chalk.green('✓ SMTP 配置完成\n'));

      const useDefaultRecipient = await confirm({
        message: '收件邮箱使用同一地址？',
        default: true
      });

      if (!useDefaultRecipient) {
        emailTo = await input({
          message: '收件邮箱:',
          validate: (value) => {
            if (!value.includes('@')) return '请输入有效的邮箱地址';
            return true;
          }
        });
      }

      console.log('');
    }

    // 配置微信
    if (channels.includes('wechat')) {
      console.log(chalk.cyan('💬 微信配置\n'));
      console.log(chalk.gray('提示: 需要先运行 weclaw start 并扫码登录\n'));

      wechatTo = await input({
        message: '微信接收方 ID:',
        default: 'filehelper@im.wechat',
        validate: (value) => {
          if (!value) return '接收方 ID 不能为空';
          return true;
        }
      });

      console.log(chalk.green('✓ 微信配置完成\n'));
    }

    // ========================================
    // 步骤 4: 确认配置
    // ========================================
    console.log(chalk.gray('━'.repeat(80)));
    console.log(chalk.cyan.bold('📋 步骤 4/4: 确认配置'));
    console.log(chalk.gray('━'.repeat(80)));
    console.log('');

    console.log(chalk.green('✓ Profile:'), profileTemplate.name);
    console.log(chalk.green('✓ 通知:'), channels.join(', '));
    if (channels.includes('email') && smtpUser) {
      console.log(chalk.green('✓ 邮箱:'), emailTo || smtpUser);
    }
    if (channels.includes('wechat') && wechatTo) {
      console.log(chalk.green('✓ 微信:'), wechatTo);
    }
    console.log(chalk.green('✓ 推荐数量:'), '每日 Top 5');
    console.log('');

    const confirmSave = await confirm({
      message: '保存配置？',
      default: true
    });

    if (!confirmSave) {
      console.log(chalk.yellow('\n⚠️  配置已取消\n'));
      return;
    }

    // ========================================
    // 保存配置
    // ========================================
    const envContent = generateEnvContent({
      profileTemplate,
      channels,
      smtpUser,
      smtpPassword,
      smtpHost,
      smtpPort,
      smtpSecure,
      emailTo,
      wechatTo
    });

    const envPath = path.join(process.cwd(), '.env.local');
    await fs.writeFile(envPath, envContent, 'utf-8');

    console.log(chalk.green(`\n✓ 配置已保存到: ${envPath}\n`));

    // ========================================
    // 测试运行
    // ========================================
    const runTest = await confirm({
      message: '现在测试运行吗？',
      default: true
    });

    if (!runTest) {
      console.log('\n');
      console.log(chalk.gray('━'.repeat(80)));
      console.log(chalk.yellow.bold('✨ 配置完成！'));
      console.log(chalk.gray('━'.repeat(80)));
      console.log('');
      console.log(chalk.cyan('测试运行:'), 'npx gtr --dry-run');
      console.log(chalk.cyan('发送通知:'), 'npx gtr');
      console.log(chalk.gray('━'.repeat(80)));
      console.log('\n');
      return;
    }

    console.log('\n');
    console.log(chalk.gray('━'.repeat(80)));
    console.log(chalk.cyan.bold('🚀 正在测试运行...'));
    console.log(chalk.gray('━'.repeat(80)));
    console.log('');

    // 强制重新加载环境变量
    // 注意：这里我们不能直接重新加载 .env.local，因为 dotenv 已经运行过了
    // 所以我们手动设置环境变量
    if (smtpUser) process.env.SMTP_USER = smtpUser;
    if (smtpPassword) process.env.SMTP_PASSWORD = smtpPassword;
    if (smtpHost) process.env.SMTP_HOST = smtpHost;
    if (smtpPort) process.env.SMTP_PORT = smtpPort.toString();
    if (smtpSecure !== undefined) process.env.SMTP_SECURE = smtpSecure.toString();
    if (emailTo) process.env.TRENDING_EMAIL_TO = emailTo;
    if (wechatTo) process.env.WECHAT_TO = wechatTo;
    process.env.NOTIFIER_CHANNELS = channels.join(',');
    process.env.TRENDING_PROFILE_NOTE = profileTemplate.profile.summary;
    process.env.TRENDING_PROFILE_KEYWORDS = profileTemplate.profile.keywords.join(',');

    const result = await runGithubTrendingDigest({
      sendEmail: true, // 实际发送
      emailTo,
      wechatTo
    });

    if (!result.ok || !result.digest) {
      console.log(chalk.red('❌ 测试运行失败'));
      if (result.error) {
        console.log(chalk.red(`   ${result.error}`));
      }
      console.log('');
      return;
    }

    // 显示结果
    formatEnhancedOutput(result.digest);

    // 显示通知结果
    if (result.notify) {
      if (result.notify.success && !result.notify.partial) {
        console.log(chalk.green('✓ 通知已成功发送'));
        if (result.notify.destination) {
          console.log(chalk.gray(`  发送到: ${result.notify.destination}`));
        }
      } else if (result.notify.partial) {
        console.log(chalk.yellow('⚠️  通知部分成功'));
        if (result.notify.reason) {
          console.log(chalk.gray(`  ${result.notify.reason}`));
        }
      } else {
        console.log(chalk.red('❌ 通知发送失败'));
        if (result.notify.error || result.notify.reason) {
          console.log(chalk.red(`  ${result.notify.error || result.notify.reason}`));
        }
      }
    }

    console.log('');
    console.log(chalk.gray('━'.repeat(80)));
    console.log(chalk.yellow.bold('✨ 配置完成！'));
    console.log(chalk.gray('━'.repeat(80)));
    console.log('');
    console.log(chalk.cyan('🔄 定时任务（可选）：'));
    console.log(chalk.gray('   每天自动推送: pnpm digest:send'));
    console.log(chalk.gray('   GitHub Actions: 参考 README.md\n'));
    console.log(chalk.cyan('📖 查看完整文档:'));
    console.log(chalk.gray('   https://github.com/xxx/github-trending-radar'));
    console.log(chalk.gray('━'.repeat(80)));
    console.log('\n');
  } catch (error) {
    if ((error as Error).name === 'ExitPromptError') {
      console.log(chalk.yellow('\n⚠️  配置已取消\n'));
      return;
    }
    throw error;
  }
}
