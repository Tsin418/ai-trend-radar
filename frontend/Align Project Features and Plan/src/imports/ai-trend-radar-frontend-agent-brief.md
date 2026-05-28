# AI Trend Radar 前端开发说明与 Agent Prompt

> 目标：让前端工程师 agent 准确理解 `Tsin418/ai-trend-radar` 这个项目的产品定位、后端能力、前端页面范围、数据结构和开发方式。  
> 使用方式：把本文档直接交给 Cursor / Claude Code / Codex / Windsurf / ChatGPT Coding Agent，让它先输出 implementation plan，再开始前端开发。

---

## 0. 给前端工程师 Agent 的总 Prompt

你现在要为 GitHub 仓库 `https://github.com/Tsin418/ai-trend-radar` 设计并开发一个前端页面。

请注意：

1. 你必须先完整阅读当前代码库，不要一上来改代码。
2. 你需要先理解这个项目已经实现了什么、输出了什么数据、前端应该展示什么。
3. 你现在的任务不是重写后端，也不是改 collector / ranker / notifier，而是为现有 AI Trend Radar 做一个可用的前端展示层。
4. 请先输出一份 implementation plan，说明：
   - 你理解的产品定位；
   - 当前仓库中与前端相关的数据输出位置；
   - 你准备新增/修改的文件；
   - 页面结构；
   - mock data 方案；
   - UI 组件拆分；
   - 开发步骤；
   - 验收方式。
5. 等我确认 plan 后，再开始编码。

前端的核心目标不是“美观地列出 GitHub Trending 项目”，而是做一个 **AI 开源趋势情报控制台**，帮助用户判断：

- 今天 AI 开源生态发生了什么；
- 哪些项目正在快速升温；
- 哪些项目是 early signals；
- 哪些 watchlist 项目有异动；
- Agent / Coding Agent / RAG / MCP / Local LLM / AI App Builder 等方向谁在升温；
- 多个数据源是否共同指向同一个趋势；
- 每个项目为什么值得关注，以及风险在哪里。

---

## 1. 产品定位

`ai-trend-radar` 不是普通的 GitHub Trending 展示工具，而是一个面向 AI 开源生态的 **AI Developer Radar / AI Trend Intelligence Dashboard**。

它的后端会从多个来源采集趋势信号，经过分类、评分、潜力判断、风险判断和可选 LLM 解释后，生成 daily / weekly digest，并通过 Feishu、Email、WeChat 等渠道推送。

前端要把这些情报结构化展示出来，让用户快速完成判断：

```text
我今天应该看哪些 AI 开源项目？
哪些项目只是热闹，哪些真的可能有价值？
AI 开源生态里的开发者注意力正在流向哪里？
```

---

## 2. 当前项目功能理解

### 2.1 核心架构

项目基于三层架构：

```text
Collectors -> Rankers -> Notifiers
```

含义：

- `Collectors`：采集趋势数据；
- `Rankers`：对候选项目或趋势信号排序、分类、评分；
- `Notifiers`：把最终 digest 推送到 Feishu / Email / WeChat 等渠道。

前端不应该破坏这个架构。前端优先消费现有 digest / JSON / archive / sample data。

---

### 2.2 数据源

当前项目已经支持或规划支持以下数据源：

| 数据源 | 用途 | 前端展示建议 |
|---|---|---|
| GitHub Trending | 发现已经开始热门的 AI 开源项目 | Top Hot Projects、Project List |
| GitHub Search API | 通过 AI topics / keywords 发现相关项目 | Candidate Pool、Early Signals |
| Watchlist | 持续跟踪长期关注项目 | Watchlist Movements |
| Product Hunt | 捕捉 AI 产品 launch 信号 | Product Launch Signals |
| AIHot | 获取中文/全球 AI 热点 | AIHot Highlights |
| Hugging Face Models | 模型热度信号 | Model Momentum |
| Hugging Face Spaces | demo / app 热度信号 | Model / Demo Signals |
| Hacker News | 开发者讨论热度 | Developer Buzz |
| arXiv | AI paper 新信号 | Paper Signals |

前端需要显性展示 source，而不是把所有内容混成一个列表。

---

### 2.3 项目关注方向

当前 radar profile 关注以下方向：

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
```

前端中的 category filter、category heatmap、category trend section 都应该基于这些方向设计。

---

### 2.4 核心输出形态

后端最终输出的 digest 应包含：

- 今日摘要；
- 今日 Top Hot Projects；
- Accelerating Projects；
- Early Signals；
- Watchlist Movements；
- Category Stats；
- Multi-source Signals；
- Source Health；
- Data Notes / Warnings；
- 可选 LLM Summary；
- 每周趋势 narrative。

---

## 3. 前端信息架构

建议导航结构：

```text
1. Dashboard
2. Projects
3. Categories
4. Multi-source Signals
5. Watchlist
6. Digests
7. Source Health
8. Settings
```

MVP 可以先做：

```text
1. Dashboard
2. Projects
3. Project Detail Drawer
4. Source Health Strip
5. Digest Preview
```

---

## 4. 页面设计要求

## 4.1 Dashboard / Today Radar 首页

首页是最重要的页面，应该让用户在 30 秒内理解今天发生了什么。

### 首屏内容

顶部：

- 产品名：`AI Developer Radar`
- 副标题：`Daily AI open-source trend intelligence for builders`
- 当前日期
- Daily / Weekly 切换
- Last generated time
- Copy Digest / Export 按钮

KPI Cards：

- Scanned Repos
- AI Candidates
- Hot Projects
- Early Signals
- Watchlist Movements
- Source Warnings

主内容区：

- 今日 headline
- 今日 summary
- Category Heat
- Top Hot Projects
- Early Signals
- Watchlist Movements
- Cross-source Highlights
- Source Health Strip

---

## 4.2 Projects 项目列表页

这是用户筛项目、做 deep dive 的主页面。

### 必须展示字段

每个项目卡片或表格行包含：

- repo full name
- repo URL
- description
- category
- language
- topics
- source
- total stars
- forks
- open issues
- daily star delta
- weekly star delta
- final score
- risk level
- trend type
- whether watchlist
- created_at
- pushed_at
- first_seen_at
- last_seen_at

### 必须支持筛选

- Search by repo name / description / topics
- Category filter
- Source filter
- Language filter
- Trend type filter
- Risk level filter
- Watchlist only
- Hot Today only
- Early Signals only
- Sort by final score
- Sort by daily star delta
- Sort by weekly star delta
- Sort by acceleration
- Sort by recently pushed

---

## 4.3 Project Detail Drawer / Detail Page

点击项目后，打开 detail drawer 或独立详情页。

### 模块

1. 基本信息
   - repo name
   - description
   - GitHub link
   - language
   - topics
   - created_at
   - pushed_at

2. 增长指标
   - total stars
   - daily star delta
   - weekly star delta
   - daily growth rate
   - weekly growth rate
   - acceleration

3. Score Breakdown
   - attention score
   - acceleration score
   - early potential score
   - developer activity score
   - AI relevance score
   - usefulness score
   - risk score
   - final score

4. Insight
   - why it matters
   - developer insight
   - LLM summary if available
   - risk notes

5. Historical Snapshot
   - stars history
   - daily delta history
   - weekly delta history

MVP 没有历史 API 时，可以先用 mock snapshots 画图。

---

## 4.4 Categories 趋势方向页

回答：哪个 AI 技术方向正在升温？

每个 category 展示：

- repo count
- average weekly star delta
- top repo
- new repo count
- category heat score
- trend direction：up / flat / down

推荐图表：

- category heatmap
- category ranking bar chart
- category trend line
- top repos by category

---

## 4.5 Multi-source Signals 多源信号页

展示 GitHub 之外的趋势信号。

模块：

- Product Launches
- Model / Space Momentum
- Developer Buzz
- AIHot Highlights
- Paper Signals
- Cross-source Highlights

重点突出：

```text
Cross-source Highlight = 同一个项目/话题/模型被多个来源同时提到。
```

这是比单一 star 增长更强的趋势信号。

---

## 4.6 Watchlist 页面

Watchlist 用于跟踪长期关注项目。

页面结构：

- 按 category 分组展示 watchlist repos；
- 展示每个 repo 的最新 stars、24h delta、7d delta、pushed_at；
- 标记是否有 movement；
- 支持 Add / Remove，MVP 可先只读；
- 支持跳转项目详情。

---

## 4.7 Digest Archive 页面

展示 daily / weekly digest 历史。

功能：

- 查看今日日报；
- 查看历史日报；
- 查看每周周报；
- 一键复制 Feishu / Markdown / Email 格式；
- 展示每期 digest 的 summary、selected projects、data notes、source warnings。

---

## 4.8 Source Health 页面

用于 debug 和可信度判断。

字段：

- source
- enabled
- success
- item count
- latency
- started_at
- finished_at
- warning
- error

状态展示：

- Green：success
- Yellow：success with warning
- Red：failed
- Gray：disabled

---

## 4.9 Settings 页面

MVP 可以只读，后续可编辑。

展示：

- radar profile
- categories
- keywords
- thresholds
- watchlist config
- source config
- notification config
- LLM enrichment config

注意：不要在前端明文展示 secrets，例如 Feishu webhook、DeepSeek API key、SMTP password。

---

# 5. TypeScript Mock 数据结构

前端可以先不接真实后端，使用本地 mock JSON 开发。

建议新建：

```text
frontend/src/types/radar.ts
frontend/src/mocks/radarDigest.mock.ts
```

---

## 5.1 TypeScript Interfaces

```ts
export type RadarRunMode = 'daily' | 'weekly';

export type TrendType = 'sustained_hot' | 'sudden_breakout' | 'early_signal';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Unknown';

export type SourceType =
  | 'opensource'
  | 'product_launch'
  | 'model_hub'
  | 'paper'
  | 'developer_discussion'
  | 'media'
  | 'curated_trend';

export interface RadarRepository {
  repoFullName: string;
  repoUrl: string;
  owner: string;
  name: string;
  description: string;
  language: string | null;
  topics: string[];
  category: string;
  createdAt: string | null;
  pushedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  source: string;
  stars: number;
  forks: number;
  openIssues: number;
  isArchived: boolean;
  isFork: boolean;
  isWatchlist: boolean;
}

export interface RepoScore {
  repoFullName: string;
  dailyStarDelta: number | null;
  weeklyStarDelta: number | null;
  dailyGrowthRate: number | null;
  weeklyGrowthRate: number | null;
  yesterdayStarDelta: number | null;
  threeDayAverageDelta: number | null;
  sevenDayAverageDelta: number | null;
  acceleration: number;
  accelerationConfidence: 'high' | 'medium' | 'low';
  trendType: TrendType;
  attentionScore: number;
  accelerationScore: number;
  earlyPotentialScore: number;
  developerActivityScore: number;
  aiRelevanceScore: number;
  usefulnessScore: number;
  riskScore: number;
  finalScore: number;
  riskLevel: RiskLevel;
  scoreDate: string;
  signals: string[];
}

export interface RepoLLMSummary {
  oneLiner: string;
  problemSolved: string;
  aiCategory: string;
  trendType: TrendType;
  whyNow: string;
  whatChanged: string;
  whyTrending: string;
  developerTakeaway: string;
  developerInsight: string;
  targetUsers: string;
  riskNotes: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScoredRadarRepository {
  repository: RadarRepository;
  score: RepoScore;
  whyItMatters: string;
  developerInsight: string;
  llmSummary?: RepoLLMSummary;
}

export interface RadarCategoryStat {
  category: string;
  repoCount: number;
  averageWeeklyStarDelta: number | null;
  topRepoFullName: string | null;
  newRepoCount: number;
}

export interface SourceHealth {
  source:
    | 'github-trending'
    | 'github-search'
    | 'watchlist'
    | 'product-hunt'
    | 'aihot'
    | 'huggingface-models'
    | 'huggingface-spaces'
    | 'hackernews'
    | 'arxiv';
  enabled: boolean;
  success: boolean;
  itemCount: number;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  error?: string;
  warning?: string;
}

export interface TrendItem {
  id: string;
  source: string;
  sourceType: SourceType;
  title: string;
  url: string;
  description?: string;
  summary?: string;
  recommendedReason?: string;
  author?: string;
  organization?: string;
  language?: 'en' | 'zh' | 'other';
  region?: 'global' | 'china' | 'us' | 'europe' | 'unknown';
  tags?: string[];
  category?: string;
  originalSource?: string;
  originalUrl?: string;
  metrics?: {
    stars?: number;
    starDelta24h?: number;
    starDelta7d?: number;
    upvotes?: number;
    likes?: number;
    downloads?: number;
    commentsCount?: number;
    repliesCount?: number;
    rank?: number;
  };
  publishedAt?: string;
  updatedAt?: string;
  collectedAt: string;
}

export interface TrendEntity {
  id: string;
  canonicalId: string;
  title: string;
  canonicalUrl: string;
  entityType: 'repo' | 'product' | 'model' | 'space' | 'paper' | 'topic' | 'news' | 'unknown';
  normalizedKeys: string[];
  sources: string[];
  sourceCount: number;
  sourceItems: TrendItem[];
  metrics: {
    stars?: number;
    starDelta24h?: number;
    starDelta7d?: number;
    votes?: number;
    likes?: number;
    downloads?: number;
    commentsCount?: number;
    hnScore?: number;
    crossSourceBonus: number;
    heatScore: number;
  };
  crossSourceBonus: number;
  category?: string;
  summary?: string;
  whyItMatters?: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface MultiSourceDigestSections {
  productLaunches: TrendItem[];
  modelDemoSignals: TrendItem[];
  developerBuzz: TrendItem[];
  aihotHighlights: TrendItem[];
  crossSourceHighlights: TrendEntity[];
}

export interface WeeklyNarrative {
  weeklyOverview: string;
  hottestDirection: string;
  notableProjects: string[];
  earlySignals: string;
  developerBuzz: string;
  developerTakeaway: string;
}

export interface RadarDigest {
  mode: RadarRunMode;
  title: string;
  date: string;
  generatedAt: string;
  headline?: string;
  summary: string;
  baselineCreated: boolean;
  scannedRepoCount?: number;
  aiCandidateCount?: number;
  dataNotes: string[];
  hotProjects: ScoredRadarRepository[];
  acceleratingProjects: ScoredRadarRepository[];
  earlySignals: ScoredRadarRepository[];
  watchlistMovements: ScoredRadarRepository[];
  selectedProjects: ScoredRadarRepository[];
  categoryStats?: RadarCategoryStat[];
  researchPicks?: ScoredRadarRepository[];
  multiSourceSections?: MultiSourceDigestSections;
  sourceHealth?: SourceHealth[];
  trendEntities?: TrendEntity[];
  topicClusters?: TrendEntity[];
  weeklyNarrative?: WeeklyNarrative;
  recurringProjects?: string[];
}
```

---

## 5.2 Mock Digest Data

```ts
import type { RadarDigest } from '../types/radar';

export const mockRadarDigest: RadarDigest = {
  mode: 'daily',
  title: 'AI Developer Radar｜Daily｜2026-05-28',
  date: '2026-05-28',
  generatedAt: '2026-05-28T09:00:00+09:00',
  headline: 'Coding Agent and MCP tooling remain the strongest developer attention clusters today.',
  summary:
    'Today’s AI open-source signals are concentrated in coding-agent workflows, MCP tooling, and practical AI app builders. Several projects show strong GitHub momentum, while cross-source signals from Product Hunt and Hacker News suggest continued interest in agentic developer tools.',
  baselineCreated: false,
  scannedRepoCount: 168,
  aiCandidateCount: 42,
  dataNotes: [
    'Daily star delta is calculated from stored snapshots, not directly returned by GitHub.',
    'Weekly delta becomes more reliable after seven consecutive daily snapshots.',
    'LLM enrichment is enabled for selected projects only; ranking remains rule-based.',
  ],
  hotProjects: [
    {
      repository: {
        repoFullName: 'Lum1104/Understand-Anything',
        repoUrl: 'https://github.com/Lum1104/Understand-Anything',
        owner: 'Lum1104',
        name: 'Understand-Anything',
        description:
          'Turn any codebase into an interactive knowledge graph that can be explored, searched, and queried with AI coding tools.',
        language: 'TypeScript',
        topics: [
          'codebase-analysis',
          'knowledge-graph',
          'claude-code',
          'codex',
          'vibe-coding',
        ],
        category: 'Coding Agent / SWE Agent',
        createdAt: '2026-03-15T02:30:51Z',
        pushedAt: '2026-05-26T05:09:57Z',
        firstSeenAt: '2026-05-24T03:05:31Z',
        lastSeenAt: '2026-05-28T00:00:00Z',
        source: 'github-trending',
        stars: 38517,
        forks: 3072,
        openIssues: 83,
        isArchived: false,
        isFork: false,
        isWatchlist: false,
      },
      score: {
        repoFullName: 'Lum1104/Understand-Anything',
        dailyStarDelta: 186,
        weeklyStarDelta: 920,
        dailyGrowthRate: 0.49,
        weeklyGrowthRate: 2.45,
        yesterdayStarDelta: 132,
        threeDayAverageDelta: 155,
        sevenDayAverageDelta: 131,
        acceleration: 1.2,
        accelerationConfidence: 'high',
        trendType: 'sustained_hot',
        attentionScore: 92,
        accelerationScore: 76,
        earlyPotentialScore: 42,
        developerActivityScore: 88,
        aiRelevanceScore: 94,
        usefulnessScore: 91,
        riskScore: 18,
        finalScore: 84,
        riskLevel: 'Low',
        scoreDate: '2026-05-28',
        signals: [
          'High 24h star delta',
          'Strong coding-agent relevance',
          'Recently pushed',
          'Developer-tool oriented README',
        ],
      },
      whyItMatters:
        'Codebase understanding is becoming a core workflow for coding agents. A project that converts code into queryable knowledge graphs can reduce context cost and improve agent navigation.',
      developerInsight:
        'Worth tracking as part of the coding-agent infrastructure layer, especially if it integrates well with Claude Code, Codex, Cursor, and local workflows.',
      llmSummary: {
        oneLiner: 'A codebase knowledge graph layer for AI coding tools.',
        problemSolved:
          'It helps developers and agents understand large codebases through structured graph navigation instead of repeated raw file search.',
        aiCategory: 'Coding Agent / SWE Agent',
        trendType: 'sustained_hot',
        whyNow:
          'The rise of AI coding agents has created demand for better codebase memory, retrieval, and context compression.',
        whatChanged:
          'The project has shown sustained star growth and recent activity around agent-compatible workflows.',
        whyTrending:
          'It connects directly to the pain point of making AI coding tools more reliable on large repositories.',
        developerTakeaway:
          'Evaluate whether graph-based code context can improve your agent workflow or internal codebase Q&A system.',
        developerInsight:
          'This belongs to the emerging codebase intelligence layer underneath coding agents.',
        targetUsers: 'AI engineers, coding-agent users, developer-tool builders',
        riskNotes: 'High popularity may partly reflect trend attention; evaluate actual integration depth before adoption.',
        confidence: 'high',
      },
    },
  ],
  acceleratingProjects: [
    {
      repository: {
        repoFullName: 'ChromeDevTools/chrome-devtools-mcp',
        repoUrl: 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
        owner: 'ChromeDevTools',
        name: 'chrome-devtools-mcp',
        description: 'Chrome DevTools for coding agents.',
        language: 'TypeScript',
        topics: ['chrome', 'devtools', 'debugging', 'mcp', 'mcp-server', 'puppeteer'],
        category: 'MCP / Tool Calling',
        createdAt: '2025-09-11T10:39:55Z',
        pushedAt: '2026-05-24T00:06:02Z',
        firstSeenAt: '2026-05-24T03:05:31Z',
        lastSeenAt: '2026-05-28T00:00:00Z',
        source: 'watchlist',
        stars: 41389,
        forks: 2624,
        openIssues: 82,
        isArchived: false,
        isFork: false,
        isWatchlist: true,
      },
      score: {
        repoFullName: 'ChromeDevTools/chrome-devtools-mcp',
        dailyStarDelta: 96,
        weeklyStarDelta: 540,
        dailyGrowthRate: 0.23,
        weeklyGrowthRate: 1.32,
        yesterdayStarDelta: 44,
        threeDayAverageDelta: 61,
        sevenDayAverageDelta: 77,
        acceleration: 1.57,
        accelerationConfidence: 'medium',
        trendType: 'sudden_breakout',
        attentionScore: 82,
        accelerationScore: 88,
        earlyPotentialScore: 28,
        developerActivityScore: 79,
        aiRelevanceScore: 90,
        usefulnessScore: 86,
        riskScore: 22,
        finalScore: 79,
        riskLevel: 'Low',
        scoreDate: '2026-05-28',
        signals: ['Watchlist movement', 'MCP relevance', 'Acceleration above recent average'],
      },
      whyItMatters:
        'Browser control and debugging are important capabilities for agentic coding workflows. MCP integration makes this project relevant to tool-calling ecosystems.',
      developerInsight:
        'Track whether browser/tool MCP servers become default infrastructure for coding agents and computer-use workflows.',
    },
  ],
  earlySignals: [
    {
      repository: {
        repoFullName: 'example-ai/local-agent-runtime',
        repoUrl: 'https://github.com/example-ai/local-agent-runtime',
        owner: 'example-ai',
        name: 'local-agent-runtime',
        description: 'A lightweight local runtime for tool-using AI agents.',
        language: 'Rust',
        topics: ['agent', 'local-llm', 'tool-calling', 'runtime'],
        category: 'Local LLM / Inference',
        createdAt: '2026-04-22T10:00:00Z',
        pushedAt: '2026-05-28T01:10:00Z',
        firstSeenAt: '2026-05-28T01:20:00Z',
        lastSeenAt: '2026-05-28T01:20:00Z',
        source: 'github-search',
        stars: 420,
        forks: 31,
        openIssues: 7,
        isArchived: false,
        isFork: false,
        isWatchlist: false,
      },
      score: {
        repoFullName: 'example-ai/local-agent-runtime',
        dailyStarDelta: 28,
        weeklyStarDelta: 116,
        dailyGrowthRate: 7.14,
        weeklyGrowthRate: 38.1,
        yesterdayStarDelta: 19,
        threeDayAverageDelta: 22,
        sevenDayAverageDelta: 16,
        acceleration: 1.27,
        accelerationConfidence: 'medium',
        trendType: 'early_signal',
        attentionScore: 65,
        accelerationScore: 71,
        earlyPotentialScore: 90,
        developerActivityScore: 76,
        aiRelevanceScore: 82,
        usefulnessScore: 78,
        riskScore: 38,
        finalScore: 72,
        riskLevel: 'Medium',
        scoreDate: '2026-05-28',
        signals: ['Early-stage repo', 'High relative growth', 'Recently pushed'],
      },
      whyItMatters:
        'Although the absolute star delta is below the hot threshold, the relative growth and category relevance make it worth watching.',
      developerInsight:
        'Potential early signal in local agent runtime infrastructure. Needs further validation through docs, issues, and adoption.',
    },
  ],
  watchlistMovements: [],
  selectedProjects: [],
  categoryStats: [
    {
      category: 'Coding Agent / SWE Agent',
      repoCount: 12,
      averageWeeklyStarDelta: 388,
      topRepoFullName: 'Lum1104/Understand-Anything',
      newRepoCount: 3,
    },
    {
      category: 'MCP / Tool Calling',
      repoCount: 8,
      averageWeeklyStarDelta: 241,
      topRepoFullName: 'ChromeDevTools/chrome-devtools-mcp',
      newRepoCount: 2,
    },
    {
      category: 'RAG / Knowledge Base',
      repoCount: 5,
      averageWeeklyStarDelta: 96,
      topRepoFullName: 'run-llama/llama_index',
      newRepoCount: 1,
    },
  ],
  researchPicks: [],
  multiSourceSections: {
    productLaunches: [
      {
        id: 'producthunt-agent-browser-demo',
        source: 'product-hunt',
        sourceType: 'product_launch',
        title: 'Agent Browser Demo',
        url: 'https://www.producthunt.com/products/example-agent-browser-demo',
        description: 'A browser automation product for AI agents.',
        recommendedReason:
          'Relevant to browser-agent and computer-use workflows, which overlap with current GitHub MCP signals.',
        language: 'en',
        region: 'global',
        tags: ['agent', 'browser', 'automation'],
        category: 'AI Browser / Computer Use',
        metrics: {
          upvotes: 312,
          commentsCount: 42,
          rank: 4,
        },
        publishedAt: '2026-05-28T00:00:00Z',
        collectedAt: '2026-05-28T09:00:00+09:00',
      },
    ],
    modelDemoSignals: [
      {
        id: 'hf-model-example-local-agent-7b',
        source: 'huggingface-models',
        sourceType: 'model_hub',
        title: 'local-agent-7b',
        url: 'https://huggingface.co/example/local-agent-7b',
        description: 'A small model optimized for local tool-use agents.',
        recommendedReason:
          'Connects to the broader local agent runtime signal and local inference category.',
        language: 'en',
        region: 'global',
        tags: ['local-llm', 'agent', 'tool-use'],
        category: 'Local LLM / Inference',
        metrics: {
          likes: 184,
          downloads: 12800,
        },
        collectedAt: '2026-05-28T09:00:00+09:00',
      },
    ],
    developerBuzz: [
      {
        id: 'hn-mcp-debugging-thread',
        source: 'hackernews',
        sourceType: 'developer_discussion',
        title: 'Show HN: Debug browser agents through MCP',
        url: 'https://news.ycombinator.com/item?id=00000000',
        summary:
          'Developers are discussing whether browser debugging should become a standard tool interface for coding agents.',
        recommendedReason:
          'Developer discussion overlaps with GitHub MCP project acceleration.',
        language: 'en',
        region: 'global',
        tags: ['mcp', 'browser-agent', 'debugging'],
        category: 'MCP / Tool Calling',
        metrics: {
          commentsCount: 86,
        },
        collectedAt: '2026-05-28T09:00:00+09:00',
      },
    ],
    aihotHighlights: [
      {
        id: 'aihot-coding-agent-highlight',
        source: 'aihot',
        sourceType: 'curated_trend',
        title: 'Coding Agent 工具链继续升温',
        url: 'https://aihot.virxact.com/',
        summary:
          '多个代码理解、MCP、浏览器控制相关项目出现在今日 AI 工具热榜中。',
        recommendedReason:
          '中文 AI 热点与 GitHub 项目增长方向一致，说明该方向不只是海外开发者讨论。',
        language: 'zh',
        region: 'china',
        tags: ['coding-agent', 'mcp', 'developer-tools'],
        category: 'Coding Agent / SWE Agent',
        collectedAt: '2026-05-28T09:00:00+09:00',
      },
    ],
    crossSourceHighlights: [
      {
        id: 'entity-mcp-browser-tooling',
        canonicalId: 'mcp-browser-tooling',
        title: 'MCP Browser Tooling',
        canonicalUrl: 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
        entityType: 'topic',
        normalizedKeys: ['mcp', 'browser-agent', 'chrome-devtools', 'tool-calling'],
        sources: ['github-trending', 'hackernews', 'product-hunt'],
        sourceCount: 3,
        sourceItems: [],
        metrics: {
          stars: 41389,
          starDelta24h: 96,
          starDelta7d: 540,
          commentsCount: 86,
          crossSourceBonus: 18,
          heatScore: 88,
        },
        crossSourceBonus: 18,
        category: 'MCP / Tool Calling',
        summary:
          'Browser control and debugging tools for agents are showing signals across GitHub, Hacker News, and Product Hunt.',
        whyItMatters:
          'Cross-source confirmation suggests this is not just a GitHub star event but a broader developer workflow topic.',
        firstSeenAt: '2026-05-24T03:05:31Z',
        lastSeenAt: '2026-05-28T09:00:00+09:00',
      },
    ],
  },
  sourceHealth: [
    {
      source: 'github-trending',
      enabled: true,
      success: true,
      itemCount: 50,
      startedAt: '2026-05-28T08:59:00+09:00',
      finishedAt: '2026-05-28T08:59:12+09:00',
      latencyMs: 12000,
    },
    {
      source: 'github-search',
      enabled: true,
      success: true,
      itemCount: 72,
      startedAt: '2026-05-28T08:59:12+09:00',
      finishedAt: '2026-05-28T08:59:36+09:00',
      latencyMs: 24000,
      warning: 'Rate limit remaining is low.',
    },
    {
      source: 'product-hunt',
      enabled: true,
      success: true,
      itemCount: 30,
      startedAt: '2026-05-28T08:59:36+09:00',
      finishedAt: '2026-05-28T08:59:42+09:00',
      latencyMs: 6000,
    },
    {
      source: 'aihot',
      enabled: true,
      success: true,
      itemCount: 30,
      startedAt: '2026-05-28T08:59:42+09:00',
      finishedAt: '2026-05-28T08:59:46+09:00',
      latencyMs: 4000,
    },
    {
      source: 'huggingface-models',
      enabled: true,
      success: true,
      itemCount: 30,
      startedAt: '2026-05-28T08:59:46+09:00',
      finishedAt: '2026-05-28T08:59:51+09:00',
      latencyMs: 5000,
    },
    {
      source: 'huggingface-spaces',
      enabled: true,
      success: false,
      itemCount: 0,
      startedAt: '2026-05-28T08:59:51+09:00',
      finishedAt: '2026-05-28T09:00:21+09:00',
      latencyMs: 30000,
      error: 'Request timeout.',
    },
    {
      source: 'hackernews',
      enabled: true,
      success: true,
      itemCount: 45,
      startedAt: '2026-05-28T09:00:21+09:00',
      finishedAt: '2026-05-28T09:00:29+09:00',
      latencyMs: 8000,
    },
    {
      source: 'arxiv',
      enabled: true,
      success: true,
      itemCount: 20,
      startedAt: '2026-05-28T09:00:29+09:00',
      finishedAt: '2026-05-28T09:00:36+09:00',
      latencyMs: 7000,
    },
  ],
  trendEntities: [],
  topicClusters: [],
  recurringProjects: ['ChromeDevTools/chrome-devtools-mcp'],
};

mockRadarDigest.selectedProjects = [
  ...mockRadarDigest.hotProjects,
  ...mockRadarDigest.acceleratingProjects,
  ...mockRadarDigest.earlySignals,
];
```

---

# 6. 前端开发 Prompt

下面这段可以直接复制给前端 coding agent。

```text
你现在要为仓库 https://github.com/Tsin418/ai-trend-radar 开发一个前端页面。

请先只读代码，不要修改任何文件。你需要先理解当前仓库的功能、脚本、数据结构、JSON 输出、digest 输出、mock/sample data 和 archive 生成逻辑。

你的目标是为这个项目做一个 AI 开源趋势情报 dashboard，而不是普通 GitHub Trending 列表页。

产品定位：
AI Developer Radar 是一个 daily / weekly AI open-source trend intelligence dashboard。后端会从 GitHub Trending、GitHub Search、Watchlist、Product Hunt、AIHot、Hugging Face、Hacker News、arXiv 等来源采集趋势信号，计算 star velocity、early signal、category heat、watchlist movement、risk level 和 potential score，并生成 digest。前端负责把这些情报结构化展示出来，让用户快速判断今天 AI 开源生态发生了什么，以及哪些项目值得关注。

请先输出 implementation plan，必须包括：
1. 你阅读后理解的当前项目结构；
2. 当前仓库中哪里可以拿到前端需要的数据；
3. 你准备新增的前端目录结构；
4. 页面设计；
5. 组件拆分；
6. mock data 接入方式；
7. 后续真实 API / JSON 接入方式；
8. 开发步骤；
9. 验收方式；
10. 风险和不确定点。

不要一开始就写代码。等我确认 plan 后，再开始实现。

MVP 前端必须包括：
1. Dashboard 首页；
2. Projects 项目列表；
3. Project Detail Drawer；
4. Category filter；
5. Source Health Strip；
6. Digest Preview；
7. GitHub 外链；
8. 使用本地 mock data 跑通。

优先技术要求：
- 如果仓库已有前端框架，尊重现有结构；
- 如果没有前端，优先使用 Next.js / React / Vite 中最适合当前仓库的轻量方案；
- TypeScript 必须开启；
- UI 风格要偏专业情报 dashboard，而不是花哨 landing page；
- 信息密度要高，但不能混乱；
- 用 card + table + drawer + filters 的结构；
- 所有外链必须可点击；
- 没有数据时要有 empty state；
- source 失败时要显示 warning，不要 silent fail；
- daily/weekly delta 为 null 时，不要显示 +0，要显示 Baseline only / Not enough data / Newly seen。

页面结构建议：
1. Dashboard
2. Projects
3. Categories
4. Multi-source Signals
5. Watchlist
6. Digests
7. Source Health
8. Settings

MVP 可先实现：
1. Dashboard
2. Projects
3. Project Detail Drawer
4. Source Health Strip
5. Digest Preview

核心组件建议：
- AppShell
- SidebarNav
- TopBar
- KpiCard
- RadarSummaryCard
- CategoryHeatCard
- ProjectCard
- ProjectTable
- ProjectFilters
- ProjectDetailDrawer
- ScoreBreakdown
- SourceHealthBadge
- SourceHealthPanel
- DigestPreview
- MultiSourceSignalCard
- EmptyState
- WarningBanner

请使用本文档中的 TypeScript interfaces 和 mockRadarDigest 作为第一版开发数据。

验收标准：
1. 本地能启动前端；
2. Dashboard 能展示 headline、summary、KPI、Top Projects、Early Signals、Source Health；
3. Projects 页面能展示项目列表，并支持 search / category / source / risk level / watchlist filter；
4. 点击项目能打开 detail drawer；
5. detail drawer 能展示 score breakdown、why it matters、developer insight、LLM summary；
6. source health 能清楚显示成功、失败、warning；
7. 所有 GitHub URL 和 external URL 可点击；
8. null delta 不显示成 0；
9. mock data 类型通过 TypeScript 校验；
10. 不改动 secrets，不硬编码 API key，不破坏现有后端脚本。
```

---

# 7. 建议前端目录结构

如果仓库没有现成前端，可以新增：

```text
frontend/
  package.json
  tsconfig.json
  vite.config.ts 或 next.config.ts
  src/
    app/
      App.tsx
      routes.tsx
    components/
      layout/
        AppShell.tsx
        SidebarNav.tsx
        TopBar.tsx
      dashboard/
        KpiCard.tsx
        RadarSummaryCard.tsx
        CategoryHeatCard.tsx
        SourceHealthStrip.tsx
      projects/
        ProjectCard.tsx
        ProjectTable.tsx
        ProjectFilters.tsx
        ProjectDetailDrawer.tsx
        ScoreBreakdown.tsx
      signals/
        MultiSourceSignalCard.tsx
        CrossSourceHighlightCard.tsx
      digest/
        DigestPreview.tsx
      common/
        EmptyState.tsx
        WarningBanner.tsx
        Badge.tsx
    data/
      radarDigest.mock.ts
    types/
      radar.ts
    utils/
      format.ts
      score.ts
      filters.ts
    styles/
      globals.css
```

如果希望直接集成在仓库根目录，也可以使用：

```text
src/frontend/
```

但为了不干扰现有 CLI / scripts，MVP 更建议独立 `frontend/`。

---

# 8. UI 风格要求

整体风格：

- 专业、干净、偏 intelligence dashboard；
- 不要做成普通营销 landing page；
- 信息密度较高，但需要清楚分层；
- 卡片边界清晰；
- 表格可扫描；
- 重要增长数据高亮；
- 风险和 warning 要明显；
- 分类标签颜色稳定；
- source 状态一眼能看懂。

建议视觉关键词：

```text
McKinsey-style structure
Linear / Vercel-like dashboard polish
GitHub / OpenAI developer-tool aesthetic
High-signal, low-noise
```

---

# 9. 组件细节建议

## 9.1 KpiCard

Props：

```ts
interface KpiCardProps {
  label: string;
  value: string | number;
  helper?: string;
  trend?: 'up' | 'down' | 'flat';
  warning?: boolean;
}
```

用于展示：

- Scanned Repos
- AI Candidates
- Hot Projects
- Early Signals
- Watchlist Movements
- Source Warnings

---

## 9.2 ProjectCard

Props：

```ts
interface ProjectCardProps {
  project: ScoredRadarRepository;
  onOpenDetail: (repoFullName: string) => void;
}
```

展示：

- repo name
- description
- category badge
- source badge
- risk badge
- stars / 24h delta / 7d delta
- final score
- why it matters
- GitHub button

---

## 9.3 ProjectDetailDrawer

Props：

```ts
interface ProjectDetailDrawerProps {
  project: ScoredRadarRepository | null;
  open: boolean;
  onClose: () => void;
}
```

展示：

- project metadata
- score breakdown
- signals
- llm summary
- risk notes
- external links

---

## 9.4 SourceHealthStrip

Props：

```ts
interface SourceHealthStripProps {
  sources: SourceHealth[];
}
```

展示状态：

- success：green
- warning：yellow
- failed：red
- disabled：gray

---

# 10. 数据接入策略

## 10.1 MVP

使用本地 mock data：

```text
frontend/src/data/radarDigest.mock.ts
```

页面直接 import：

```ts
import { mockRadarDigest } from '@/data/radarDigest.mock';
```

---

## 10.2 第二阶段

从后端生成的 JSON 文件读取，例如：

```text
public/data/latest-digest.json
public/data/digest-archive/*.json
public/data/radar-store.json
```

前端 fetch：

```ts
const res = await fetch('/data/latest-digest.json');
const digest = await res.json();
```

---

## 10.3 第三阶段

接入真实 API：

```text
GET /api/digest/latest
GET /api/digest/archive
GET /api/projects
GET /api/projects/:repoFullName
GET /api/source-health
GET /api/categories
GET /api/watchlist
```

但 MVP 不强制做 API server。

---

# 11. 重要边界条件

前端必须正确处理以下情况：

1. `dailyStarDelta === null`：显示 `Not enough data` 或 `Baseline only`；
2. `weeklyStarDelta === null`：显示 `Need 7-day snapshots`；
3. `baselineCreated === true`：显示 baseline warning；
4. `sourceHealth.success === false`：显示 source failure；
5. `llmSummary` 不存在：fallback 到 rule-based insight；
6. `hotProjects.length === 0`：显示 empty state，不要硬凑项目；
7. `source warnings` 不为空：顶部显示 warning banner；
8. `repoUrl` 为空或异常：隐藏 GitHub button 或显示 disabled；
9. `riskLevel === High`：风险提示要明显；
10. `isWatchlist === true`：项目卡片上明确标注 watchlist。

---

# 12. 验收标准

MVP 完成时，需要满足：

1. 可以本地启动前端；
2. Dashboard 能展示完整 mock digest；
3. Project List 能展示项目并筛选；
4. Project Detail Drawer 可打开并关闭；
5. Score Breakdown 可读；
6. Source Health 状态清晰；
7. Digest Preview 可复制；
8. 所有外链可点击；
9. TypeScript 无类型错误；
10. 不改动后端核心逻辑；
11. 不写入任何 secret；
12. 不破坏现有 `pnpm typecheck`、`pnpm test`、`pnpm radar:*` 脚本。

---

# 13. 未来迭代方向

## Phase 1：Dashboard MVP

- Dashboard
- Projects
- Detail Drawer
- Source Health
- Digest Preview
- Mock Data

## Phase 2：真实数据接入

- latest digest JSON
- archive JSON
- radar-store JSON
- historical charts
- category trend charts

## Phase 3：交互增强

- watchlist edit
- profile edit
- useful / not useful / seen feedback
- LLM summary regenerate
- manual run trigger
- export markdown / Feishu card / email HTML

## Phase 4：产品化

- login
- multi-user profile
- Supabase storage
- public digest page
- RSS feed page
- project deep-dive research page
- trend comparison across weeks

---

# 14. 最终一句话总结

前端要把 `ai-trend-radar` 从一个命令行/推送型 bot，升级成一个可视化的 AI 开源趋势情报工作台：

```text
Collect signals → Score potential → Explain why it matters → Help builders decide what to track.
```
