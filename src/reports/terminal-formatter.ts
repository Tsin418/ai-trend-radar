import chalk from 'chalk';
import type { TrendingDigest, TrendingRecommendation } from '../trending/types.js';

/**
 * 格式化终端输出 - Demo 模式专用
 * 使用色彩和符号增强可读性，让输出更"可晒"
 */
export function formatDemoOutput(digest: TrendingDigest): void {
  console.log('\n');

  // 主标题 - 使用渐变色和醒目符号
  console.log(chalk.cyan.bold('╭────────────────────────────────────────────────────────────────────────────╮'));
  console.log(chalk.cyan.bold('│  🎯  GitHub Trending Radar - Demo Mode                                    │'));
  console.log(chalk.cyan.bold('╰────────────────────────────────────────────────────────────────────────────╯'));

  // Profile 信息
  console.log(chalk.gray(`\n📋 使用预设【AI 产品开发者】profile`));
  console.log(chalk.gray(`📅 ${digest.date}`));

  const { recommendations } = digest;

  if (recommendations.length === 0) {
    console.log(chalk.yellow.bold('\n⚠️  今日暂无强相关项目推荐'));
    console.log(chalk.gray('\n提示：可以调整 profile 关键词或语言偏好以获得更多匹配'));
    console.log('\n');
    return;
  }

  // 统计信息 - 使用视觉化的进度条感觉
  console.log(chalk.green.bold(`\n✨ 从 ${digest.repositories.length} 个项目中发现 ${recommendations.length} 个强相关推荐\n`));
  console.log(chalk.gray('━'.repeat(80)));

  recommendations.forEach((rec, index) => {
    formatRecommendation(rec, index + 1);
  });

  // 引导用户配置 - 使用醒目的框架
  console.log(chalk.gray('━'.repeat(80)));
  console.log('\n');
  console.log(chalk.yellow.bold('✨ 下一步：配置你自己的 profile'));
  console.log(chalk.gray('   ↓'));
  console.log(chalk.cyan('   npx github-trending-radar init'));
  console.log('');
  console.log(chalk.gray('或者直接运行（使用默认配置）：'));
  console.log(chalk.cyan('   npx github-trending-radar --dry-run'));
  console.log('');
  console.log(chalk.gray('━'.repeat(80)));
  console.log('\n');
}

/**
 * 格式化单个推荐项目
 */
function formatRecommendation(rec: TrendingRecommendation, rank: number): void {
  console.log(chalk.gray('━'.repeat(80)));

  // 排名和分数 - 使用不同颜色区分高低分
  const scoreColor = rec.score >= 120 ? chalk.yellow : rec.score >= 100 ? chalk.green : chalk.cyan;
  console.log(scoreColor.bold(`${getRankEmoji(rank)} 第 ${rank} 名 · ${rec.score.toFixed(1)} 分`));

  // 项目名称 - 加粗突出
  console.log(chalk.white.bold(`   ${rec.repo.fullName}`));

  // 项目元信息 - 使用语义化颜色和符号
  const metaParts: string[] = [];

  if (rec.repo.language) {
    metaParts.push(chalk.blue(`📦 ${rec.repo.language}`));
  }

  if (rec.repo.totalStars) {
    const starsFormatted = formatNumber(rec.repo.totalStars);
    metaParts.push(chalk.gray(`⭐ ${starsFormatted}`));
  }

  if (rec.repo.starsToday) {
    const todayFormatted = formatNumber(rec.repo.starsToday);
    metaParts.push(chalk.green(`🔥 +${todayFormatted} today`));
  }

  if (metaParts.length > 0) {
    console.log(`   ${metaParts.join(chalk.gray('  ·  '))}`);
  }

  // 项目描述 - 浅灰色，不喧宾夺主
  if (rec.repo.description) {
    console.log(chalk.dim(`   ${rec.repo.description}`));
  }

  // 推荐原因 - 使用渐变色标记重要性
  if (rec.reasons.length > 0) {
    console.log(chalk.cyan.bold('\n   💡 为什么推荐'));
    rec.reasons.forEach((reason) => {
      console.log(chalk.white(`      ▸ ${reason}`));
    });
  }

  // 实践建议 - 使用数字序号和动作色
  if (rec.practiceIdeas.length > 0) {
    console.log(chalk.green.bold('\n   🚀 可以这样用'));
    rec.practiceIdeas.forEach((idea, i) => {
      console.log(chalk.white(`      ${chalk.yellow((i + 1).toString())}. ${idea}`));
    });
  }

  // 项目链接 - 蓝色可点击链接
  console.log(chalk.blue.underline(`\n   🔗 ${rec.repo.url}`));
}

/**
 * 获取排名对应的 emoji
 */
function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return '📌';
  }
}

/**
 * 格式化数字（添加千位分隔符）
 */
function formatNumber(num: number): string {
  if (num >= 1000) {
    return num.toLocaleString();
  }
  return num.toString();
}

/**
 * 格式化增强版输出 - 用于普通 dry-run
 */
export function formatEnhancedOutput(digest: TrendingDigest): void {
  console.log('\n');

  // 主标题
  console.log(chalk.cyan.bold('╭────────────────────────────────────────────────────────────────────────────╮'));
  console.log(chalk.cyan.bold('│  🎯  GitHub Trending Radar                                                │'));
  console.log(chalk.cyan.bold('╰────────────────────────────────────────────────────────────────────────────╯'));

  // 日期和统计信息
  console.log(chalk.gray(`\n📅 ${digest.date}`));

  const matchRate = digest.repositories.length > 0
    ? ((digest.recommendations.length / digest.repositories.length) * 100).toFixed(1)
    : '0.0';

  console.log(chalk.gray(`📊 扫描 ${digest.repositories.length} 个项目 → 推荐 ${digest.recommendations.length} 个 (${matchRate}% 匹配率)\n`));

  if (digest.recommendations.length === 0) {
    console.log(chalk.yellow.bold('⚠️  今日暂无推荐项目'));
    console.log(chalk.gray('\n提示：可以调整 profile 关键词或语言偏好以获得更多匹配'));
    console.log(chalk.gray('━'.repeat(80)));
    console.log('\n');
    return;
  }

  console.log(chalk.gray('━'.repeat(80)));

  digest.recommendations.forEach((rec, index) => {
    formatRecommendation(rec, index + 1);
  });

  console.log(chalk.gray('━'.repeat(80)));
  console.log('\n');
}

/**
 * 格式化简洁版输出 - 用于 JSON 格式时的辅助提示
 */
export function formatMinimalStats(digest: TrendingDigest): void {
  console.log(chalk.gray(`\n📊 Stats: ${digest.repositories.length} scanned, ${digest.recommendations.length} recommended`));
}
