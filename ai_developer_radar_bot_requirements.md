# AI Developer Radar Bot 开发需求文档

> 基于 `Hazel-Lin/github-trending-radar` 二次开发  
> 目标：从“GitHub Trending 个性化摘要”升级为“AI 开源项目开发者趋势雷达”  
> 使用方式：将本文档作为需求上下文提供给 Claude Code / Cursor / Windsurf / ChatGPT Coding Agent / 其他 coding agent

---

## 0. 给 Coding Agent 的总 Prompt

你现在要基于现有开源项目 `Hazel-Lin/github-trending-radar` 做二次开发。

请先完整阅读当前代码库，不要直接改代码。你需要先理解原项目的架构，包括：

- `src/collectors/`
- `src/rankers/`
- `src/notifiers/`
- `src/tasks/`
- `.github/workflows/`
- `.env.example`
- README / README_zh / docs

原项目的定位是将 GitHub Trending 转化为个性化推荐摘要，并通过 Email / WeChat 等渠道发送。现在我要把它改造成一个面向 AI 开源生态的 **AI Developer Radar Bot**。

这个 bot 的核心目标不是简单搬运 GitHub Trending，而是每天和每周从开发者视角帮助我发现 AI 开源生态的动向，并尽可能早地发现有潜力的项目。

请先输出一份 implementation plan，说明你理解的现有架构、你准备新增/修改的模块、文件级别改动计划、数据结构设计、测试方案和潜在风险。等我确认后再开始编码。

---

## 1. 项目背景

我希望每天上午 9 点收到一条飞书机器人推送，内容是：

- 最近 24 小时在 GitHub 上新增 stars 较快的 AI 相关项目；
- 尤其关注新增 stars 超过 50 的项目；
- 但不要只依赖 `daily_star_delta >= 50`，还要能发现早期潜力项目；
- 每天推送最多 10 个项目；
- 每周生成一次周报，从开发者角度总结 AI 开源生态方向变化。

这个项目不是一个普通的 GitHub Trending bot，而是一个：

**AI Developer Radar**

它要回答的问题是：

1. 最近开发者的注意力正在流向哪些 AI 技术方向？
2. 哪些项目正在快速升温？
3. 哪些项目还没大火，但可能有潜力？
4. 这些项目分别属于 Agent、Coding Agent、RAG、MCP、Local LLM、AI Infra 等哪些方向？
5. 这些变化对 AI 产品、开发者工具和开源生态有什么启发？

---

## 2. 基于原项目的改造原则

原项目已经有比较好的三层架构：

```text
Collectors -> Rankers -> Notifiers
```

请尽量复用这个架构，而不是推倒重写。

### 2.1 保留原项目能力

需要尽量保留：

- GitHub Trending collector；
- rule-based ranking 的基本能力；
- profile / keywords 个性化能力；
- dry-run；
- JSON output；
- Email notifier；
- WeChat notifier；
- GitHub Actions 定时执行能力；
- CLI 使用方式。

### 2.2 新增核心能力

需要新增：

1. GitHub Search / GitHub REST metadata collector；
2. AI topic / keyword 搜索；
3. 用户 watchlist 机制；
4. repo 每日快照存储；
5. 24h / 7d star delta 计算；
6. AI 项目分类；
7. Potential Score 潜力评分；
8. Feishu 飞书机器人推送；
9. Daily digest；
10. Weekly digest；
11. baseline day 机制；
12. 风险过滤与质量评分；
13. 配置文件 / 环境变量扩展。

---

## 3. 目标产品形态

### 3.1 每日推送

每天 09:00 推送一条飞书消息。

标题示例：

```text
AI Developer Radar｜Daily｜2026-05-24
```

内容需要包括：

1. 今日概览；
2. 今日 Top Hot Projects；
3. Early Signals；
4. Watchlist Movements；
5. Developer Insight；
6. 数据说明。

### 3.2 每周推送

每周一 09:00 推送一条周报。

标题示例：

```text
AI Developer Radar｜Weekly｜2026-W22
```

内容需要包括：

1. 本周 AI 开源生态总结；
2. 本周最热方向；
3. 本周增长最快项目；
4. 本周早期潜力项目；
5. 本周值得深入研究的 3 个项目；
6. 对我的启发。

---

## 4. 用户关注方向

请内置一个默认关注画像，后续可通过 `.env` 或配置文件覆盖。

默认关注方向：

```text
1. AI Agent Framework
2. Coding Agent / SWE Agent
3. RAG / Knowledge Base
4. MCP / Tool Calling
5. Local LLM / Inference
6. AI App Builder
7. AI Workflow Automation
8. Vector Database / Embedding
9. AI Browser / Computer Use
10. AI DevTool / Observability
```

默认关键词：

```text
ai
llm
agent
agents
ai-agent
rag
retrieval
mcp
model-context-protocol
tool-calling
function-calling
coding-agent
swe-agent
copilot
cursor
cline
computer-use
browser-agent
workflow
automation
inference
local-llm
embedding
vector-database
vector-db
knowledge-base
openai
anthropic
claude
gemini
llama
transformer
diffusion
```

---

## 5. 数据源设计

### 5.1 Source A：GitHub Trending

保留原项目的 GitHub Trending collector。

用途：

- 捕捉已经开始热门的项目；
- 作为 daily digest 的候选池之一。

### 5.2 Source B：GitHub Search API / REST API

新增 GitHub search collector。

建议搜索维度：

```text
topic:llm
topic:ai-agent
topic:agents
topic:rag
topic:mcp
topic:generative-ai
topic:openai
topic:claude
topic:cursor
topic:ai-coding
topic:inference
topic:vector-database
topic:workflow-automation
topic:computer-use
topic:browser-agent
```

也可以支持 keyword search，例如：

```text
llm stars:>30
agent stars:>30
rag stars:>30
mcp stars:>30
coding agent stars:>30
```

注意事项：

- 必须考虑 GitHub API rate limit；
- 支持 `GITHUB_TOKEN`；
- 每次采集数量要可配置；
- 避免过量调用；
- 对同一 repo 去重。

### 5.3 Source C：Watchlist

新增 `config/watchlist.yaml` 或 `config/watchlist.json`。

用途：

- 维护我长期关注的 AI 项目；
- 即使这些项目没有进入 GitHub Trending，也要持续跟踪；
- 用于发现 watchlist movement，例如 star 异常增长、release、pushed_at 更新等。

示例：

```yaml
categories:
  ai_agent_framework:
    - langchain-ai/langgraph
    - crewAIInc/crewAI
    - microsoft/autogen
    - openai/openai-agents-python

  coding_agent:
    - All-Hands-AI/OpenHands
    - continuedev/continue
    - aider-ai/aider

  rag_knowledge_base:
    - run-llama/llama_index
    - langchain-ai/langchain
    - qdrant/qdrant
    - weaviate/weaviate

  mcp_tooling:
    - modelcontextprotocol/servers
    - punkpeye/awesome-mcp-servers

  ai_app_builder:
    - langgenius/dify
    - flowiseai/flowise
    - lobehub/lobe-chat
```

MVP 阶段可以内置较小 watchlist，后续用户自行扩展。

---

## 6. 数据存储设计

需要新增 storage 层。

MVP 推荐使用 SQLite。  
如果实现成本过高，也可以先使用 JSON 文件，但最终建议 SQLite。

### 6.1 repositories 表

```sql
CREATE TABLE IF NOT EXISTS repositories (
  repo_full_name TEXT PRIMARY KEY,
  repo_url TEXT,
  owner TEXT,
  name TEXT,
  description TEXT,
  language TEXT,
  topics TEXT,
  category TEXT,
  created_at TEXT,
  first_seen_at TEXT,
  last_seen_at TEXT,
  source TEXT
);
```

### 6.2 repo_snapshots 表

```sql
CREATE TABLE IF NOT EXISTS repo_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_full_name TEXT,
  stars INTEGER,
  forks INTEGER,
  open_issues INTEGER,
  pushed_at TEXT,
  collected_at TEXT
);
```

### 6.3 repo_scores 表

```sql
CREATE TABLE IF NOT EXISTS repo_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_full_name TEXT,
  daily_star_delta INTEGER,
  weekly_star_delta INTEGER,
  daily_growth_rate REAL,
  weekly_growth_rate REAL,
  attention_score REAL,
  early_potential_score REAL,
  developer_activity_score REAL,
  ai_relevance_score REAL,
  usefulness_score REAL,
  risk_score REAL,
  final_score REAL,
  score_date TEXT
);
```

### 6.4 digest_runs 表，可选

```sql
CREATE TABLE IF NOT EXISTS digest_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT,
  started_at TEXT,
  finished_at TEXT,
  status TEXT,
  selected_repo_count INTEGER,
  error_message TEXT
);
```

---

## 7. Star Delta 机制

GitHub API 返回的是当前 stars 总数，而不是过去 24h 新增 stars。

因此必须通过快照计算：

```text
daily_star_delta = stars_today - stars_yesterday
weekly_star_delta = stars_today - stars_7_days_ago
```

### 7.1 Baseline Day 机制

第一次运行时没有昨天的数据。

要求：

- 第一次运行只建立 baseline；
- 推送或 dry-run 时明确提示：`Baseline created. Star delta will be available from the next run.`
- 第二天开始计算 daily delta；
- 第七天后开始准确计算 weekly delta。

### 7.2 缺失数据处理

如果某个 repo 昨天没有快照：

- 不要强行计算 daily delta；
- 标记为 `newly_seen`；
- 可以进入 Early Signals，但不要标注错误的 delta。

---

## 8. 候选池机制

每日候选池分三类。

### 8.1 Pool 1：Hot Today

标准：

```text
daily_star_delta >= 50
AI relevance >= threshold
recently pushed
```

用途：日报主榜单。

### 8.2 Pool 2：Early Signals

标准：

```text
20 <= daily_star_delta < 50
weekly_star_delta >= 80
50 <= total_stars <= 3000
AI relevance >= threshold
recently pushed
```

用途：早期潜力项目发现。

### 8.3 Pool 3：Watchlist Movements

标准：

```text
repo in watchlist
AND (
  daily_star_delta > recent average * 2
  OR weekly_star_delta is high
  OR pushed_at updated recently
  OR new release detected, if release API is implemented
)
```

用途：关注核心生态变化。

---

## 9. Scoring 机制

请实现 `PotentialScoreRanker` 或类似模块。

### 9.1 总分公式

```text
Potential Score =
  30% Attention Momentum
+ 20% Early-stage Potential
+ 20% Developer Activity
+ 15% AI Relevance
+ 10% Product/Infra Usefulness
-  5% Risk Penalty
```

如果实现时采用 0–100 分制，则建议：

```text
final_score =
  attention_score * 0.30
+ early_potential_score * 0.20
+ developer_activity_score * 0.20
+ ai_relevance_score * 0.15
+ usefulness_score * 0.10
- risk_score * 0.05
```

### 9.2 Attention Momentum

考虑：

- daily_star_delta；
- weekly_star_delta；
- daily_growth_rate；
- weekly_growth_rate；
- fork_delta，如可实现；
- 是否来自 Trending。

注意：

- 大项目看绝对增长；
- 小项目看相对增长；
- 不要让 50,000 stars 项目的一点常规增长压过 300 stars 项目的快速启动信号。

### 9.3 Early-stage Potential

加分项：

```text
50 <= total_stars <= 3000
created_at <= 180 days
weekly_star_delta >= 80
daily_star_delta >= 20
```

扣分项：

```text
stars < 30
README 很短或无法获取
没有 license
长期无 commit
```

### 9.4 Developer Activity

考虑：

- `pushed_at` 是否在最近 14 天；
- 最近 commit 数，如果实现；
- 最近 release，如果实现；
- open issues；
- forks；
- 是否有 docs / examples / demo，如果实现 README 分析。

MVP 可先使用：

```text
pushed_at
forks
open_issues
```

### 9.5 AI Relevance

先用规则实现，不强依赖 LLM。

基于：

- repo name；
- description；
- topics；
- README，如实现；
- watchlist category。

输出 category：

```text
AI Agent Framework
Coding Agent / SWE Agent
RAG / Knowledge Base
MCP / Tool Calling
Local LLM / Inference
AI App Builder
AI Workflow Automation
Vector Database / Embedding
AI Browser / Computer Use
AI DevTool / Observability
Other AI
```

### 9.6 Product / Infra Usefulness

MVP 可用规则粗判：

加分项：

- repo 是工具 / framework / library / SDK；
- 有明确 usage；
- 有 docs/examples；
- 能被开发者直接使用；
- 与 agent、RAG、coding、MCP、inference、workflow 相关。

### 9.7 Risk Penalty

扣分项：

- README 极短；
- 最近 30 天无 push；
- fork/star ratio 异常低；
- topics 很少或非常泛；
- description 夸张但 metadata 很弱；
- stars 暴涨但 forks/issues/commits 没有同步信号。

MVP 阶段先实现简单风险等级：

```text
Low
Medium
High
Unknown
```

---

## 10. 飞书 Notifier

新增 `FeishuNotifier`。

### 10.1 配置

环境变量建议：

```env
NOTIFIER_CHANNELS=feishu
FEISHU_WEBHOOK_URL=https://open.larksuite.com/open-apis/bot/v2/hook/60d52a38-6805-4dd4-a42b-803df18f693b
FEISHU_SECRET=5g6Oe00ZTj8qeEONmm9vVf
```

其中：


- 如果原项目已有 `NOTIFIER_CHANNELS=email,wechat`，请扩展为支持 `feishu`。

### 10.2 消息格式

优先实现飞书富文本或消息卡片。

如果卡片实现复杂，MVP 先使用 text / post 消息。

日报示例：

```text
AI Developer Radar｜Daily｜2026-05-24

今日结论：
- Coding Agent 方向继续升温
- MCP 工具出现 2 个早期潜力项目
- RAG 方向增长放缓，但 production workflow 类项目活跃

Top Hot Projects
1. repo/name
   Category: Coding Agent
   Stars: 2,430 (+186 / 24h, +520 / 7d)
   Why it matters: xxx
   Developer insight: xxx
   Risk: Low
   GitHub: https://github.com/xxx/xxx

Early Signals
- repo/name: total stars 420, 7d +130, 可能是 xxx 方向的新工具

Watchlist Movements
- repo/name: release / push / star acceleration detected
```

### 10.3 每个项目需要展示字段

至少包含：

```text
repo_full_name
repo_url
category
description
total_stars
daily_star_delta
weekly_star_delta
final_score
risk_level
why_it_matters
developer_insight
```

---

## 11. Daily Digest 逻辑

每日执行流程：

```text
1. Load config
2. Collect candidates from GitHub Trending
3. Collect candidates from GitHub Search API
4. Collect repos from watchlist
5. Deduplicate by repo_full_name
6. Fetch latest metadata for each repo
7. Save repository metadata
8. Save daily snapshot
9. Calculate daily / weekly deltas
10. Classify AI category
11. Score candidates
12. Select:
    - Hot Today
    - Early Signals
    - Watchlist Movements
13. Generate digest
14. Send to Feishu
15. Record digest run
```

### 11.1 Top 10 选择逻辑

优先级：

1. Hot Today；
2. Early Signals；
3. Watchlist Movements；
4. fallback：highest potential score from all AI candidates。

注意：

如果当天 `daily_star_delta >= 50` 的项目不足 10 个，不要硬凑垃圾项目。  
可以补充 Early Signals，并在推送里说明：

```text
今日新增 stars >= 50 的 AI 项目不足 10 个，已补充 Early Signals。
```

---

## 12. Weekly Digest 逻辑

每周一执行。

输入：

- 过去 7 天 snapshots；
- 过去 7 天 scores；
- watchlist movement；
- category aggregation。

输出：

```text
AI Developer Radar｜Weekly

1. 本周总览
2. 本周最热方向
3. 本周增长最快项目
4. 本周早期潜力项目
5. 本周值得进一步研究的 3 个项目
6. 对产品 / 开发者生态的启发
```

### 12.1 Category-level 统计

需要聚合：

```text
每个 category 的候选项目数量
每个 category 的平均 weekly_star_delta
每个 category 的 Top repo
每个 category 的新增项目数量
```

### 12.2 周报洞察

MVP 可以用模板生成，不必强依赖 LLM。

例如：

```text
本周 Coding Agent 方向共有 8 个项目进入候选池，其中 3 个项目 weekly_star_delta 超过 200，说明开发者仍在积极探索自动化编程工作流。
```

后续版本再接 LLM 生成更自然的中文总结。

---

## 13. CLI / Scripts 需求

在原项目 CLI 基础上新增或扩展：

```bash
pnpm radar:daily:dry-run
pnpm radar:daily:send
pnpm radar:weekly:dry-run
pnpm radar:weekly:send
pnpm radar:baseline
```

或者通过原有 CLI 参数实现：

```bash
pnpm digest:dry-run -- --mode=daily --channel=feishu
pnpm digest:send -- --mode=daily --channel=feishu
pnpm digest:send -- --mode=weekly --channel=feishu
```

请根据现有项目风格选择最小侵入方案。

---

## 14. GitHub Actions

原项目已有每日 01:00 UTC，即北京时间 09:00 的 scheduled workflow。请复用或新增 workflow。

### 14.1 Daily

```yaml
on:
  schedule:
    - cron: "0 1 * * *"
  workflow_dispatch:
```

### 14.2 Weekly

```yaml
on:
  schedule:
    - cron: "0 1 * * 1"
  workflow_dispatch:
```

### 14.3 Secrets / Variables

Secrets：

```text
GITHUB_TOKEN
FEISHU_WEBHOOK_URL
FEISHU_SECRET
```

Variables：

```text
NOTIFIER_CHANNELS=feishu
RADAR_REPO_LIMIT=100
RADAR_RECOMMENDATION_LIMIT=10
RADAR_DAILY_STAR_THRESHOLD=50
RADAR_EARLY_SIGNAL_DAILY_THRESHOLD=20
RADAR_EARLY_SIGNAL_WEEKLY_THRESHOLD=80
RADAR_PROFILE_KEYWORDS=
```

注意：

- 如果 SQLite 文件需要保存历史，需要设计持久化方案；
- GitHub Actions 环境默认是 ephemeral，运行结束文件不会保留，除非 commit 回 repo、上传 artifact，或使用外部数据库；
- MVP 如果用 GitHub Actions + SQLite，需要解决 snapshot 持久化。

---

## 15. Snapshot 持久化方案

请评估并选择一个 MVP 方案。

### 方案 A：SQLite 文件 commit 回 repo

优点：

- 不需要额外服务；
- 适合个人项目；
- 成本低。

缺点：

- 需要 GitHub Actions 有 push 权限；
- 可能产生频繁 commits；
- 并发运行要避免冲突。

### 方案 B：Supabase

优点：

- 稳定；
- 适合后续 dashboard；
- 多端可访问。

缺点：

- 需要配置数据库；
- 开发复杂度略高。

### 方案 C：JSON snapshot commit 回 repo

优点：

- 最简单；
- 易于 debug。

缺点：

- 数据结构扩展性弱；
- 查询 weekly trend 不方便。

MVP 推荐：

- 如果追求最快实现：JSON snapshots；
- 如果希望后续可扩展：SQLite；
- 如果已经准备 dashboard：Supabase。

请在 implementation plan 中说明你的选择和理由。

---

## 16. 配置文件

建议新增：

```text
config/radar-profile.yaml
config/watchlist.yaml
```

### 16.1 radar-profile.yaml 示例

```yaml
profile:
  name: "Andrew AI Developer Radar"
  description: "Track AI open-source projects from a developer/product builder perspective."
  categories:
    - AI Agent Framework
    - Coding Agent / SWE Agent
    - RAG / Knowledge Base
    - MCP / Tool Calling
    - Local LLM / Inference
    - AI App Builder
    - AI Workflow Automation
    - Vector Database / Embedding
    - AI Browser / Computer Use
    - AI DevTool / Observability
  keywords:
    - ai
    - llm
    - agent
    - rag
    - mcp
    - coding-agent
    - inference
    - vector-database
    - workflow
    - automation
  thresholds:
    daily_star_hot: 50
    daily_star_early: 20
    weekly_star_early: 80
    early_stage_min_stars: 50
    early_stage_max_stars: 3000
```

---

## 17. LLM 相关需求

MVP 不强制接 LLM。

优先用 rule-based 机制跑通：

- AI relevance；
- category classification；
- why_it_matters；
- developer insight。

V2 可接 LLM，用于：

1. 判断 repo 是否真的属于 AI developer tooling；
2. 分类；
3. 生成中文摘要；
4. 生成 developer insight；
5. 生成 weekly trend insight。

LLM 输出必须可降级。  
如果 LLM API 失败，不能导致整个 bot 失败。

---

## 18. 输出质量要求

日报和周报不能只是机械列表。

每个项目至少要有：

```text
这个项目是什么
为什么今天值得关注
它属于哪个技术方向
它对开发者/产品有什么启发
它是否存在风险
```

中文表达要简洁，偏专业，适合每天快速阅读。

不要写成营销文案。  
不要过度吹捧。  
没有足够证据时要说“信号较弱”或“需要继续观察”。

---

## 19. 错误处理

必须处理：

1. GitHub API rate limit；
2. GitHub API timeout；
3. repo metadata 缺失；
4. 飞书 webhook 失败；
5. storage 写入失败；
6. 第一次运行无 baseline；
7. 候选项目不足 10 个；
8. weekly delta 数据不足 7 天。

错误时：

- dry-run 要清晰输出错误；
- send 模式下，如果没有有效候选，也要推送一条状态说明，避免用户以为 bot 挂了；
- 不要 silent fail。

---

## 20. 测试要求

请增加或更新测试。

至少测试：

1. repo 去重；
2. snapshot 写入；
3. daily delta 计算；
4. weekly delta 计算；
5. AI keyword classification；
6. Potential Score 计算；
7. Top 10 selection；
8. Feishu message rendering；
9. baseline day 行为；
10. insufficient candidates fallback。

运行验证：

```bash
pnpm typecheck
pnpm test
pnpm radar:daily:dry-run
pnpm radar:weekly:dry-run
```

如果原项目没有 test framework，请至少提供可运行的 dry-run 和核心函数单测建议。

---

## 21. 验收标准

MVP 完成时，应满足：

1. 可以基于原项目本地运行；
2. 可以通过 dry-run 看到 AI Developer Radar 日报；
3. 可以保存 repo snapshot；
4. 第二次运行可以计算 daily star delta；
5. 可以筛选 `daily_star_delta >= 50` 的 AI 项目；
6. 如果不足 10 个，可以补充 Early Signals；
7. 可以推送到飞书机器人；
8. 可以通过 GitHub Actions 每天 09:00 自动运行；
9. 可以配置 watchlist；
10. 可以输出清晰的错误信息。

---

## 22. 开发优先级

### Phase 1：MVP

目标：先跑起来。

必须实现：

- Feishu notifier；
- GitHub metadata fetch；
- AI keyword filter；
- snapshot storage；
- daily delta；
- Hot Today；
- Early Signals；
- daily Feishu digest；
- GitHub Actions daily schedule；
- dry-run。

暂不强制：

- LLM summary；
- Supabase；
- release detection；
- fake-star 检测；
- dashboard；
- HN / Reddit / Product Hunt。

### Phase 2：稳定版

新增：

- weekly digest；
- watchlist movements；
- richer category aggregation；
- risk scoring；
- quality scoring；
- better Feishu card；
- README analysis；
- better fallback；
- SQLite/Supabase migration if needed。

### Phase 3：增强版

新增：

- LLM classification and insight；
- Hacker News / Reddit / Product Hunt signal；
- Hugging Face trending；
- npm / PyPI package growth；
- release note summary；
- fake-star risk detection；
- dashboard；
- historical chart；
- project detail page。

---

## 23. 建议文件结构

请根据现有项目实际结构调整，以下只是建议：

```text
src/
  collectors/
    github.ts
    github-search.ts
    watchlist.ts

  storage/
    types.ts
    sqlite-store.ts
    json-store.ts

  rankers/
    rule-based.ts
    potential-score.ts
    ai-category.ts
    risk.ts

  notifiers/
    email.ts
    wechat.ts
    feishu.ts

  renderers/
    daily-digest.ts
    weekly-digest.ts
    feishu-card.ts

  tasks/
    github-trending-digest.ts
    ai-developer-radar-daily.ts
    ai-developer-radar-weekly.ts

config/
  radar-profile.yaml
  watchlist.yaml

.github/
  workflows/
    radar-daily.yml
    radar-weekly.yml
```

---

## 24. 给 Agent 的执行纪律

请按以下方式工作：

1. 先阅读代码，不要一上来改；
2. 先输出 implementation plan；
3. 说明哪些能力可直接复用，哪些需要新增；
4. 对 storage 持久化方案做选择并解释；
5. 实现时尽量小步提交；
6. 每完成一个模块，运行 typecheck / dry-run；
7. 不要破坏原来的 Email / WeChat 功能；
8. 不要硬编码我的飞书 webhook；
9. 不要把 secrets 写入代码；
10. 如果发现原项目结构和本文档假设不一致，优先尊重实际代码结构，但要说明调整理由。

---

## 25. 最终目标

把原项目从：

```text
Daily GitHub Trending personalized digest
```

升级为：

```text
AI Developer Radar:
A daily and weekly AI open-source trend intelligence bot that tracks star velocity, early signals, watchlist movements, and developer-facing insights, delivered through Feishu.
```

请先开始代码阅读，然后输出 implementation plan。
