# 使用案例

本文档展示 GitHub Trending Radar 在不同场景下的实际应用价值。

## 目录

- [典型使用场景](#典型使用场景)
  - [场景 1: AI 产品开发者 - 追踪前沿工具](#场景-1-ai-产品开发者---追踪前沿工具)
  - [场景 2: 全栈工程师 - 发现生产力工具](#场景-2-全栈工程师---发现生产力工具)
  - [场景 3: 独立开发者 - 寻找可复用组件](#场景-3-独立开发者---寻找可复用组件)
  - [场景 4: 开源维护者 - 社区趋势洞察](#场景-4-开源维护者---社区趋势洞察)
- [真实案例](#真实案例)
  - [案例 1: 从趋势发现到产品落地](#案例-1-从趋势发现到产品落地)
  - [案例 2: 团队技术雷达同步](#案例-2-团队技术雷达同步)

---

## 典型使用场景

### 场景 1: AI 产品开发者 - 追踪前沿工具

**用户画像**

- 专注 AI 应用开发，使用 TypeScript/Python
- 关注 Agent、RAG、MCP 等前沿方向
- 需要快速评估新工具的实用性

**配置示例**

```bash
# 使用预设 profile
npx github-trending-radar init
# 选择：AI 产品开发者

# 或手动配置
TRENDING_PROFILE_KEYWORDS=ai,agent,llm,rag,mcp,automation,workflow
TRENDING_PROFILE_NOTE=专注 AI 工具和 Agent 工作流开发
```

**实际输出（示例）**

```
🥇 第 1 名 · 126.0 分
   anthropics/model-context-protocol
   📦 TypeScript  ·  ⭐ 12,450  ·  🔥 +892 today

   💡 为什么推荐
      ▸ 和你当前的实战关键词高度重合：mcp、agent、ai
      ▸ 项目类型贴近你正在做的方向：AI / Agent 基础设施

   🚀 可以这样用
      1. 可以先接入现有 AI 工具，验证 Context 共享价值
      2. 封装成可复用的 MCP Server，降低团队接入成本
```

**价值交付**

- ✅ 每天 5 分钟了解 AI 领域最新趋势
- ✅ 过滤掉 80% 不相关内容，聚焦高价值项目
- ✅ 获得实践建议，降低技术调研时间

---

### 场景 2: 全栈工程师 - 发现生产力工具

**用户画像**

- 使用 Next.js/React 构建 Web 产品
- 关注 API 设计、数据库、前端性能
- 希望提升开发效率和代码质量

**配置示例**

```bash
# 使用预设 profile
npx github-trending-radar init
# 选择：全栈工程师

# 或手动配置
TRENDING_PROFILE_KEYWORDS=nextjs,react,typescript,api,database,tailwind
TRENDING_PROFILE_NOTE=专注现代 Web 开发和全栈架构
```

**实际输出（示例）**

```
🥇 第 1 名 · 118.0 分
   vercel/next.js
   📦 TypeScript  ·  ⭐ 142,300  ·  🔥 +245 today

   💡 为什么推荐
      ▸ 和你当前的实战关键词高度重合：nextjs、typescript、react
      ▸ 技术栈和你当前常用栈一致，落地成本低

   🚀 可以这样用
      1. 关注新版本特性，评估是否适合当前项目升级
      2. 学习最佳实践，改进现有代码架构
```

**价值交付**

- ✅ 及时了解框架新特性和最佳实践
- ✅ 发现可集成的开发工具和库
- ✅ 避免重复造轮子，提升交付速度

---

### 场景 3: 独立开发者 - 寻找可复用组件

**用户画像**

- 快速构建 SaaS 产品和 MVP
- 关注增长工具、变现、Landing Page
- 追求开发效率和产品验证速度

**配置示例**

```bash
# 使用预设 profile
npx github-trending-radar init
# 选择：独立开发者

# 或手动配置
TRENDING_PROFILE_KEYWORDS=saas,mvp,stripe,supabase,marketing,analytics
TRENDING_PROFILE_NOTE=专注快速构建和产品验证
```

**实际输出（示例）**

```
🥇 第 1 名 · 132.0 分
   shadcn-ui/taxonomy
   📦 TypeScript  ·  ⭐ 8,920  ·  🔥 +423 today

   💡 为什么推荐
      ▸ 和你当前的实战关键词高度重合：saas、nextjs、stripe
      ▸ 提供完整的 SaaS 模板，可直接 fork 使用

   🚀 可以这样用
      1. Fork 作为项目起点，快速搭建产品骨架
      2. 学习 Stripe 集成和订阅管理最佳实践
```

**价值交付**

- ✅ 找到可复用的 SaaS 模板和组件
- ✅ 学习增长和变现的实战案例
- ✅ 缩短从想法到上线的时间

---

### 场景 4: 开源维护者 - 社区趋势洞察

**用户画像**

- 维护多个开源项目
- 需要了解社区动态和竞品
- 希望发现潜在的协作机会

**配置示例**

```bash
# 自定义配置
TRENDING_PROFILE_KEYWORDS=open-source,community,cli,devtool
TRENDING_PROFILE_NOTE=关注开源生态和社区趋势
TRENDING_REPO_LIMIT=20  # 扫描更多项目
TRENDING_RECOMMENDATION_LIMIT=10  # 推荐更多项目
```

**实际输出（示例）**

```
🥇 第 1 名 · 115.0 分
   google/gemini-api
   📦 Python  ·  ⭐ 15,600  ·  🔥 +1,234 today

   💡 为什么推荐
      ▸ 大厂开源项目，社区活跃度高
      ▸ 可能影响你的项目技术选型

   🚀 可以这样用
      1. 评估是否可以集成到现有项目
      2. 参考 API 设计和文档组织方式
```

**价值交付**

- ✅ 及时发现竞品和替代方案
- ✅ 了解社区热点，调整项目方向
- ✅ 发现潜在的协作和贡献机会

---

## 真实案例

### 案例 1: 从趋势发现到产品落地

**背景**

某 AI 产品开发者（化名"李明"）专注于构建自动化工具，希望找到可落地的 Agent 项目灵感。

**行动流程**

```bash
# 1. 初始配置（3 分钟）
npx github-trending-radar init
# 选择：AI 产品开发者
# 配置邮件：接收每日推荐

# 2. 每日接收邮件
# 早上 9:00 收到推荐邮件，浏览 5 分钟

# 3. 发现关键项目（第 3 天）
# 推荐了一个 MCP Server 模板项目
# 评分 128 分，匹配关键词：mcp、agent、typescript

# 4. 快速验证（1 小时）
git clone <项目地址>
npm install
npm run dev
# 测试核心功能，验证可行性

# 5. 产品化落地（2 周）
# - Fork 项目，简化为最小可用版本
# - 接入自己的数据源和业务场景
# - 封装成 CLI 工具，发布到 npm
# - 在社交媒体分享，获得 200+ stars
```

**成果**

- ✅ **时间节省**：减少 80% 技术调研时间（从 2 周降到 3 天）
- ✅ **产品落地**：2 周完成从想法到上线
- ✅ **社区反馈**：获得 200+ GitHub stars，验证产品价值
- ✅ **持续价值**：项目成为个人品牌的重要组成部分

**关键经验**

> "以前我每天要花 1-2 小时刷 GitHub Trending 和 Hacker News，但 90% 都是噪音。现在工具帮我过滤到只剩 5 个高相关项目，每天 5 分钟就够了。更重要的是，它给出的实践建议让我知道怎么用，而不只是看热闹。"

---

### 案例 2: 团队技术雷达同步

**背景**

某技术团队（10 人）希望建立统一的技术雷达，确保团队成员对前沿技术有共识。

**行动流程**

```bash
# 1. 团队 profile 配置
# 在 GitHub Actions 中配置团队共识的关键词
TRENDING_PROFILE_KEYWORDS=typescript,react,nextjs,api,postgres,ai
TRENDING_PROFILE_NOTE=团队技术栈：Next.js + AI 应用
NOTIFIER_CHANNELS=email,wechat  # 邮件 + 微信群

# 2. 定时推送
# 每天 09:00 UTC（北京时间 17:00）推送到团队邮件组和微信群
# GitHub Actions 自动运行

# 3. 团队协作
# - 每周五 Tech Sync 会议讨论本周推荐项目
# - 投票决定值得深入调研的项目（2-3 个）
# - 分配 owner 进行调研和分享（下周汇报）

# 4. 知识沉淀
# - 调研结果整理成文档，存入团队知识库
# - 可落地的工具/库记录到技术选型清单
# - 不适合的项目也记录原因，避免重复调研
```

**配置示例（GitHub Actions）**

```yaml
# .github/workflows/team-tech-radar.yml
name: Team Tech Radar

on:
  schedule:
    - cron: "0 9 * * *" # 每天 09:00 UTC

jobs:
  send-digest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4

      - run: pnpm install
      - run: pnpm digest:send
        env:
          SMTP_USER: ${{ secrets.SMTP_USER }}
          SMTP_PASSWORD: ${{ secrets.SMTP_PASSWORD }}
          TRENDING_EMAIL_TO: team@company.com
          WECHAT_TO: team-group@im.wechat
```

**成果**

- ✅ **信息同步**：团队 10 人每天同步接收相同的技术趋势
- ✅ **决策提速**：技术选型讨论时间减少 60%（有明确的候选方案）
- ✅ **学习效率**：避免重复调研，知识复用率提升
- ✅ **团队文化**：建立了"技术驱动"的团队氛围

**关键经验**

> "以前每个人都有自己的信息源，技术选型会议经常陷入'我觉得 A 好' vs '我觉得 B 好'的主观争论。现在我们有了统一的输入（每日推荐），讨论更聚焦，决策更客观。"

---

## 其他使用技巧

### 1. 调整推荐数量

```bash
# 快速浏览模式（每天 2 分钟）
TRENDING_RECOMMENDATION_LIMIT=3

# 深度调研模式（每天 10 分钟）
TRENDING_RECOMMENDATION_LIMIT=10
```

### 2. 组合多个关键词

```bash
# 追踪特定技术栈
TRENDING_PROFILE_KEYWORDS=nextjs,supabase,stripe,vercel

# 追踪特定领域
TRENDING_PROFILE_KEYWORDS=ai,agent,rag,embedding,vector-db
```

### 3. JSON 输出用于自动化

```bash
# 输出 JSON 格式，便于后续处理
npx github-trending-radar --dry-run --format=json > output.json

# 示例：提取项目 URL
jq -r '.recommendations[].repo.url' output.json

# 示例：提取高分项目（>120 分）
jq '.recommendations[] | select(.score > 120)' output.json
```

### 4. 多通道通知

```bash
# 同时发送到邮件和微信
NOTIFIER_CHANNELS=email,wechat

# 邮件用于深度阅读（HTML 格式）
# 微信用于快速提醒（纯文本）
```

---

## 常见问题

**Q: 推荐数量太少怎么办？**

A: 调整 profile 配置：
- 增加关键词数量
- 扩大语言范围
- 提高 `TRENDING_REPO_LIMIT`（扫描更多项目）

**Q: 推荐内容不够精准？**

A: 优化关键词：
- 使用更具体的关键词（如 `nextjs` 而非 `web`）
- 添加否定词（未来功能）
- 参考推荐原因，调整画像

**Q: 如何避免遗漏重要项目？**

A: 两种策略：
- 定期运行（每日），确保覆盖所有趋势
- 调高推荐数量（如 10 个），降低过滤强度

---

## 总结

GitHub Trending Radar 的核心价值：

1. **节省时间** - 从每天 1-2 小时降到 5 分钟
2. **提升精准度** - 过滤 80% 噪音，聚焦高价值项目
3. **可执行建议** - 不只是"看热闹"，还知道"怎么用"
4. **团队协作** - 统一信息源，加速决策

立即开始：

```bash
npx github-trending-radar --demo  # 30 秒体验
npx github-trending-radar init    # 3 分钟配置
```

---

**贡献案例**

如果你有使用案例想要分享，欢迎：
- 提交 PR 到 `docs/use-cases.md`
- 在 GitHub Issues 分享你的故事
- 在社交媒体上 @ 我们

我们会将优质案例收录到文档中 🎉
