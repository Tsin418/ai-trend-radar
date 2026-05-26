# GitHub Trending Radar

**可插拔的趋势信号 → 个性化摘要引擎**

将 GitHub Trending 和 Product Hunt 发布信号转化为个性化推荐，通过多通道（邮件、微信、飞书等）推送。

[English](./README.md) | 简体中文

## AI Developer Radar Bot

本 fork 在原有 `Collectors -> Rankers -> Notifiers` 架构上新增 AI 开源项目趋势雷达。

```bash
pnpm radar:baseline
pnpm radar:daily:dry-run
pnpm radar:daily:send
pnpm radar:weekly:dry-run
pnpm radar:weekly:send
```

Radar 会从 GitHub Trending、GitHub Search API 和 `config/watchlist.yaml` 收集候选项目，将快照保存到
`data/radar-store.json`，计算 24h/7d star delta，进行 AI 分类和 Potential Score 排序，并在配置
`FEISHU_WEBHOOK_URL` 后发送飞书机器人消息。Cloudflare Worker 定时任务在配置
`PRODUCT_HUNT_TOKEN` 后，会在飞书摘要末尾追加独立的 Product Hunt Launch Signals 区块。

第一次运行只会建立 baseline；第二次日运行开始有 daily delta，约 7 天后 weekly delta 才完整。

## 核心特性

🎯 **个性化排名** - 基于关键词、语言偏好、焦点方向的多维评分
🔌 **可插拔架构** - Collector、Ranker、Notifier 三层解耦
📧 **多通道推送** - 支持邮件（SMTP）、微信（基于 WeClaw 本地桥接）
🚀 **零安装运行** - `npx github-trending-radar --demo`
📊 **JSON 输出** - 支持管道串接和自动化工作流
🎨 **精美模板** - HTML 邮件 + 纯文本微信消息

## 它能做什么

- 从 GitHub Trending 抓取每日热门项目
- 按个人画像（关键词、语言、方向）评分排名
- 生成推荐原因和实践建议（中文）
- 发送到邮箱或个人微信
- 支持 dry-run 测试和 JSON 输出

## 为什么要用它

大多数 Trending 摘要是通用的，这个项目是**有观点的** —— 它回答：

> 在我当前的工作中，哪些趋势项目值得我花时间？

不仅展示流行度，还添加**实用相关性层**：

- ✅ 关键词匹配度
- ✅ 编程语言偏好
- ✅ 项目方向提示
- ✅ 实践建议（如何落地）

## 架构设计

```text
┌─────────────────────────────────────────────────────────┐
│                     CLI / Task Layer                    │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Collectors  │───▶│   Rankers    │───▶│  Notifiers   │
└──────────────┘    └──────────────┘    └──────────────┘
   │                    │                    │
   ├─ GitHub           ├─ RuleBased         ├─ Email (SMTP)
   ├─ Product Hunt     ├─ LLM explain       ├─ WeChat (WeClaw)
   └─ Reddit (future)  └─ Hybrid            └─ Feishu / Telegram
```

**三层解耦设计：**

1. **Collectors** - 数据源抽象（当前：GitHub 和 Product Hunt；未来：Reddit、Hacker News、Hugging Face）
2. **Rankers** - 排名策略（当前：RuleBased，未来：LLM / Hybrid）
3. **Notifiers** - 通知通道（当前：邮件、微信，未来：Telegram）

## 快速开始

### 方式 1: Demo Mode（推荐 - 零配置体验）

30 秒体验产品价值，无需任何配置：

```bash
npx github-trending-radar --demo

# 或使用短命令
npx gtr --demo
```

**Demo Mode 特性**：
- ✅ 使用预设【AI 产品开发者】profile
- ✅ 只展示 Top 3 强相关项目（聚焦）
- ✅ 美化的终端输出（色彩 + 符号）
- ✅ 自动引导配置流程

### 方式 2: Dry Run（测试配置）

使用你的配置但不发送邮件：

```bash
# Dry run（不发送邮件）
npx github-trending-radar --dry-run

# 使用短命令
npx gtr --dry-run
```

### 方式 3: 发送通知

```bash
# 发送邮件（需要配置 SMTP 环境变量）
npx github-trending-radar --to=your@email.com
```

## 安装和配置

### 系统要求

- Node.js 18+ 推荐
- `pnpm` 包管理器
- 邮件发送需要 SMTP 账号

### 方式 1: 交互式配置（推荐）

3 分钟完成配置：

```bash
pnpm install
npx tsx scripts/send-trending-digest.ts init
```

**交互流程**：
1. 选择开发者类型（AI 产品、全栈、DevOps、独立开发、数据工程）
2. 选择通知方式（邮件、微信）
3. 配置邮箱（自动检测 QQ/Gmail/163/126）
4. 测试运行

**自动生成 `.env.local`**，无需手动编辑。

### 方式 2: 手动配置

```bash
pnpm install
cp .env.example .env.local
```

然后编辑 `.env.local` 填写配置。

## 环境变量配置

### 1. 通知通道选择

```env
# 选择通知通道（默认：email）
# 可选值：email, wechat
# 多通道用逗号分隔：email,wechat
NOTIFIER_CHANNELS=email
```

### 2. 邮件配置（email 通道）

```env
SMTP_USER=your@qq.com
SMTP_PASSWORD=your_smtp_authorization_code
MAIL_FROM=your@qq.com
TRENDING_EMAIL_TO=your@gmail.com
```

**SMTP 自动解析规则：**

1. 显式 SMTP 配置 → 使用这些
2. `@qq.com` 结尾 → 自动使用 QQ 邮箱（smtp.qq.com:465）
3. `@gmail.com` 结尾 → 自动使用 Gmail（smtp.gmail.com:465）
4. `@163.com` 结尾 → 自动使用 163 邮箱（smtp.163.com:465）
5. `@126.com` 结尾 → 自动使用 126 邮箱（smtp.126.com:465）

**完整 SMTP 变量：**

```env
SMTP_HOST=           # SMTP 服务器地址（可选）
SMTP_PORT=           # SMTP 端口（默认 465）
SMTP_SECURE=         # 是否使用 SSL（默认 true）
SMTP_USER=           # 用户名（必需）
SMTP_PASSWORD=       # 密码或授权码（必需）
MAIL_FROM=           # 发件人（默认同 SMTP_USER）
TRENDING_EMAIL_TO=   # 收件人（可选，默认同 SMTP_USER）
```

### 3. 微信配置（wechat 通道，基于 WeClaw）

```env
WECLAW_API_URL=http://127.0.0.1:18011
WECHAT_TO=filehelper@im.wechat
```

**接入方式：**

1. 按 [WeClaw](https://github.com/fastclaw-ai/weclaw) 启动本地桥接服务：`weclaw start`
2. 首次启动扫码登录微信
3. 默认 HTTP API 监听在 `127.0.0.1:18011`
4. 配置 `WECHAT_TO` 为接收方，例如 `filehelper@im.wechat`

### 4. 个性化配置

```env
TRENDING_PROFILE_NOTE=          # 覆盖默认画像描述
TRENDING_PROFILE_KEYWORDS=      # 追加关键词（逗号分隔）
TRENDING_REPO_LIMIT=10          # 扫描项目数
TRENDING_RECOMMENDATION_LIMIT=5 # 推荐项目数
```

### 配置示例

**仅邮件：**

```env
NOTIFIER_CHANNELS=email
SMTP_USER=your@qq.com
SMTP_PASSWORD=your_authorization_code
TRENDING_EMAIL_TO=your@gmail.com
```

**仅微信：**

```env
NOTIFIER_CHANNELS=wechat
WECLAW_API_URL=http://127.0.0.1:18011
WECHAT_TO=filehelper@im.wechat
```

**邮件 + 微信：**

```env
NOTIFIER_CHANNELS=email,wechat
SMTP_USER=your@qq.com
SMTP_PASSWORD=your_authorization_code
TRENDING_EMAIL_TO=your@gmail.com
WECLAW_API_URL=http://127.0.0.1:18011
WECHAT_TO=filehelper@im.wechat
```

## 使用方法

### 方式 1: npx（推荐）

零安装直接运行：

```bash
# 查看帮助文档
npx github-trending-radar --help

# Demo 模式（零配置体验 - 推荐首次使用）
npx gtr --demo

# Dry run（不发送邮件，查看输出）
npx github-trending-radar --dry-run

# 发送通知
npx github-trending-radar --to=your@email.com

# 发送到指定微信接收方
npx github-trending-radar --wechat-to=filehelper@im.wechat

# 使用短命令别名
npx gtr --dry-run

# 自定义参数
npx gtr --dry-run --repo-limit=15 --recommendation-limit=5

# JSON 格式输出（便于管道串接）
npx gtr --dry-run --format=json
```

**可用参数：**

- `--demo` - Demo 模式：零配置体验，使用预设 AI 产品开发者 profile
- `--dry-run` - 测试模式，不发送邮件
- `--to=EMAIL` - 收件人邮箱（兼容旧参数，等同于 `--email-to`）
- `--email-to=EMAIL` - 收件人邮箱（覆盖环境变量）
- `--wechat-to=ID` - 微信接收方 ID（例如 `filehelper@im.wechat`）
- `--repo-limit=N` - 扫描项目数（默认 10）
- `--recommendation-limit=N` - 推荐项目数（默认 5）
- `--format=text|json` - 输出格式（默认 text）

**子命令：**

```bash
# 交互式配置向导
npx gtr init

# 查看帮助
npx gtr --help
npx gtr init --help
```

### 方式 2: pnpm scripts（本地开发）

本地 dry run：

```bash
pnpm digest:dry-run
```

发送摘要邮件：

```bash
pnpm digest:send
```

覆盖收件人：

```bash
pnpm digest:send -- --to=you@example.com
```

控制扫描和推荐数量：

```bash
pnpm digest:dry-run -- --repo-limit=15 --recommendation-limit=5
```

## 输出内容

摘要包含：

- 当日简短总结
- 你的当前 profile 总结
- 焦点方向
- 推荐的热门仓库
- 每个仓库的相关性原因
- 如何应用的实践建议

邮件同时生成 HTML 和纯文本格式。

## Profile 个性化

### 方式 1: 使用预设模板（推荐）

运行 `npx gtr init` 时选择：

- **AI 产品开发者** - AI 工具、Agent 工作流、自动化产品
- **全栈工程师** - Next.js、React、API 设计、全栈开发
- **DevOps/云原生** - Docker、K8s、CI/CD、云基础设施
- **独立开发者** - SaaS 工具、快速原型、增长、变现
- **数据工程师** - ETL、数据管道、数据分析、ML 工程

### 方式 2: 自定义配置

可以通过环境变量调整摘要而无需修改代码：

- `TRENDING_PROFILE_NOTE` 覆盖邮件中显示的 profile 总结
- `TRENDING_PROFILE_KEYWORDS` 追加额外的匹配关键词（逗号分隔）

**默认 profile**（如不使用 init）:

- AI 工具
- Agent 工作流
- 自动化管道
- 内容系统
- 增长工具
- 产品化脚本

## 开发

类型检查：

```bash
pnpm typecheck
```

推荐的本地验证流程：

```bash
pnpm typecheck
pnpm digest:dry-run
```

## 自动化

### GitHub Actions 定时推送

项目包含 `.github/workflows/digest-email.yml` 工作流，每天 `01:00 UTC`（北京时间 09:00）自动执行。

**配置步骤：**

1. 在 GitHub 仓库 Settings → Secrets 添加：

```text
SMTP_USER
SMTP_PASSWORD
MAIL_FROM
TRENDING_EMAIL_TO
```

2. （可选）如果使用微信，添加：

```text
WECLAW_API_URL
WECHAT_TO
```

3. （可选）在 Variables 中添加个性化配置：

```text
NOTIFIER_CHANNELS=email,wechat
TRENDING_PROFILE_NOTE=
TRENDING_PROFILE_KEYWORDS=
TRENDING_REPO_LIMIT=10
TRENDING_RECOMMENDATION_LIMIT=5
```

**手动触发：** 在 GitHub Actions 页面使用 `workflow_dispatch` 手动执行。

### macOS 本地调度

如果你要通过本机 `weclaw` 发到个人微信，推荐使用本地调度器，不要用 GitHub Actions。

可行方式包括：

- `launchd`
- `crontab`
- 任何能定时执行 `pnpm digest:send` 的本地任务调度工具

首次使用时，如果本机还没接入个人微信，先执行：

```bash
weclaw login
weclaw start
pnpm digest:send -- --wechat-to=filehelper@im.wechat
```

## 架构扩展

### Product Hunt Collector

Product Hunt 已实现为 launch/product signal 数据源：

```bash
pnpm producthunt:dry-run
pnpm producthunt:json
```

Cloudflare 定时推送场景下，把 `PRODUCT_HUNT_TOKEN` 配置为 Worker Secret 即可。详见
`docs/producthunt-collector.md` 和 `docs/cloudflare-feishu-pusher.md`。

### 添加新的数据源（Collector）

参考 `src/collectors/README.md`，步骤：

1. 创建新 Collector（如 `reddit.ts`）
2. 实现 `Collector<TrendingItem>` 接口
3. 导出到 `src/collectors/index.ts`

**示例：**

```typescript
// src/collectors/reddit.ts
import type { Collector, TrendingItem } from './types.js';

export class RedditCollector implements Collector {
  readonly name = 'reddit';

  async fetch(limit: number): Promise<TrendingItem[]> {
    // 实现 Reddit API 抓取
    return items;
  }
}
```

### 添加新的排序策略（Ranker）

参考 `src/rankers/README.md`，步骤：

1. 创建新 Ranker（如 `llm.ts`）
2. 实现 `Ranker` 接口
3. 在任务层工厂函数中接入

**示例：**

```typescript
// src/rankers/llm.ts
import type { TrendingRanker } from './types.js';

export class LlmRanker implements TrendingRanker {
  readonly name = 'llm';

  rank(repositories, profile, limit) {
    return repositories.slice(0, limit).map((repo) => ({
      repo,
      score: 0,
      reasons: [],
      practiceIdeas: []
    }));
  }
}
```

### 添加新的通知通道（Notifier）

1. 创建新 Notifier（如 `telegram.ts`）
2. 实现 `Notifier` 接口
3. 注册到 `src/tasks/github-trending-digest.ts` 的工厂函数

**示例：**

```typescript
// src/notifiers/telegram.ts
import type { Notifier, NotifyOptions, NotifyResult } from './types.js';

export class TelegramNotifier implements Notifier {
  readonly name = 'telegram';

  async notify(options: NotifyOptions): Promise<NotifyResult> {
    // 实现 Telegram Bot API 调用
    return { success: true, skipped: false };
  }
}
```

## 项目结构

```text
src/
├── collectors/       # 数据源抽象层
│   ├── types.ts     # Collector 接口
│   ├── github.ts    # GitHub Trending 实现
│   └── README.md    # 扩展指南
├── rankers/          # 排名策略层
│   ├── types.ts     # Ranker 接口
│   ├── rule-based.ts # 规则评分实现
│   └── README.md    # 扩展指南
├── notifiers/        # 通知通道抽象层
│   ├── types.ts     # Notifier 接口
│   ├── email.ts     # 邮件通知实现
│   ├── wechat.ts    # 微信（WeClaw）实现
│   └── index.ts     # 统一导出
├── profiles/         # Profile 模板
├── trending/         # 画像和类型定义
├── reports/          # 排名和摘要生成
├── tasks/            # 端到端任务编排
└── config/           # 环境变量验证
scripts/              # CLI 入口
bin/                  # npx 可执行文件
```

## 最佳实践

### 1. 定时任务配置

**GitHub Actions（推荐）：**
- 免费、稳定、零维护
- Secrets 加密存储凭证
- 每日自动执行

**本地 cron：**
- 适合调试或个人使用
- 需要机器常驻
- 日志存储在本地

**建议：** 开发时用 cron，生产用 GitHub Actions。

### 2. 多通道策略

**仅邮件：**
- 适合深度阅读
- 完整的 HTML 排版
- 可归档和搜索

**仅微信：**
- 适合即时通知
- 移动端友好
- 群组协作

**邮件 + 微信：**
- 邮件用于详细阅读
- 微信用于快速提醒
- 适合团队协作

### 3. 个性化画像

默认画像针对 AI 产品、Agent 工作流、自动化方向。

**自定义方法：**

1. **追加关键词**（推荐）：
   ```env
   TRENDING_PROFILE_KEYWORDS=langchain,openai,nextjs
   ```

2. **覆盖画像描述**：
   ```env
   TRENDING_PROFILE_NOTE=我是一个专注于 XXX 的开发者
   ```

3. **修改代码**（高级）：
   编辑 `src/trending/profile.ts`


## 贡献

参见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证

[MIT](./LICENSE)
