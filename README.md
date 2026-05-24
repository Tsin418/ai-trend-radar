# GitHub Trending Radar

**Pluggable Trend Signal → Personalized Digest Engine**

Transform GitHub Trending (extensible to Product Hunt, Reddit, etc.) into personalized recommendations, delivered via multiple channels (email, WeChat, etc.).

English | [简体中文](./README_zh.md)

## AI Developer Radar Bot

This fork adds an AI open-source trend radar on top of the original
Collectors -> Rankers -> Notifiers architecture.

```bash
pnpm radar:baseline
pnpm radar:daily:dry-run
pnpm radar:daily:send
pnpm radar:weekly:dry-run
pnpm radar:weekly:send
```

The radar collects candidates from GitHub Trending, GitHub Search API, and
`config/watchlist.yaml`, stores daily snapshots in `data/radar-store.json`,
calculates 24h/7d star deltas, classifies AI categories, scores potential, and
sends a Feishu message when `FEISHU_WEBHOOK_URL` is configured.

The first run creates the baseline snapshot. Star deltas become meaningful from
the next daily run; weekly deltas become meaningful after about seven days.

## Core Features

🎯 **Personalized Ranking** - Multi-dimensional scoring based on keywords, language preferences, and focus areas
🔌 **Pluggable Architecture** - Three-layer decoupling: Collector, Ranker, Notifier
📧 **Multi-channel Delivery** - Email (SMTP), WeChat (via WeClaw local bridge)
🚀 **Zero Installation** - `npx github-trending-radar --demo`
📊 **JSON Output** - Pipeline-friendly and automation-ready
🎨 **Beautiful Templates** - HTML emails + plain text WeChat messages

## What It Does

- Fetch daily trending projects from GitHub Trending
- Score and rank by personal profile (keywords, languages, directions)
- Generate recommendation reasons and actionable ideas (in Chinese by default)
- Deliver to your email or personal WeChat
- Support dry-run testing and JSON output

## Why Use It

Most Trending digests are generic. This project is **opinionated** — it answers:

> Which trending projects are worth my time for my current work?

Beyond popularity, it adds a **practical relevance layer**:

- ✅ Keyword match score
- ✅ Programming language preference
- ✅ Project direction hints
- ✅ Actionable ideas (how to apply it)

## Architecture

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
   ├─ Product Hunt     ├─ LLM (future)      ├─ WeChat (WeClaw)
   └─ Reddit           └─ Hybrid            └─ Telegram (future)
```

**Three-layer design:**

1. **Collectors** - Data source abstraction (current: GitHub, future: Product Hunt, Reddit)
2. **Rankers** - Ranking strategy (current: RuleBased, future: LLM / Hybrid)
3. **Notifiers** - Notification channels (current: Email, WeChat, future: Telegram)

## Quick Start

### Option 1: Demo Mode (Recommended - Zero Config)

Experience the product value in 30 seconds, no configuration needed:

```bash
npx github-trending-radar --demo

# Or use short alias
npx gtr --demo
```

**Demo Mode Features**:
- ✅ Uses preset [AI Product Builder] profile
- ✅ Shows only Top 3 highly relevant projects (focused)
- ✅ Beautiful terminal output (colors + symbols)
- ✅ Auto-guide to configuration

### Option 2: Dry Run (Test Config)

Use your config but don't send emails:

```bash
# Dry run (no emails sent)
npx github-trending-radar --dry-run

# Or use short alias
npx gtr --dry-run
```

### Option 3: Send Notifications

```bash
# Send email (requires SMTP env vars)
npx github-trending-radar --to=your@email.com
```

## Installation & Setup

### Requirements

- Node.js 18+ recommended
- `pnpm` package manager
- SMTP account for email delivery

### Option 1: Interactive Setup (Recommended)

Complete setup in 3 minutes:

```bash
pnpm install
npx tsx scripts/send-trending-digest.ts init
```

**Interactive flow**:
1. Choose developer type (AI Product, Full-stack, DevOps, Indie Hacker, Data Engineer)
2. Choose notification channels (Email, WeChat)
3. Configure email (auto-detect QQ/Gmail/163/126)
4. Test run

**Auto-generates `.env.local`**, no manual editing needed.

### Option 2: Manual Setup

```bash
pnpm install
cp .env.example .env.local
```

Then edit `.env.local` with your settings.

## Environment Variables

### 1. Notification Channels

```env
# Choose notification channels (default: email)
# Options: email, wechat
# Multiple channels: email,wechat
NOTIFIER_CHANNELS=email
```

### 2. Email Config (email channel)

```env
SMTP_USER=your@qq.com
SMTP_PASSWORD=your_smtp_authorization_code
MAIL_FROM=your@qq.com
TRENDING_EMAIL_TO=your@gmail.com
```

**Auto SMTP detection**:

1. Explicit SMTP config → Use these
2. `@qq.com` → Auto-use QQ Mail (smtp.qq.com:465)
3. `@gmail.com` → Auto-use Gmail (smtp.gmail.com:465)
4. `@163.com` → Auto-use 163 Mail (smtp.163.com:465)
5. `@126.com` → Auto-use 126 Mail (smtp.126.com:465)

**Full SMTP variables**:

```env
SMTP_HOST=           # SMTP server address (optional)
SMTP_PORT=           # SMTP port (default 465)
SMTP_SECURE=         # Use SSL (default true)
SMTP_USER=           # Username (required)
SMTP_PASSWORD=       # Password or auth code (required)
MAIL_FROM=           # Sender (default: same as SMTP_USER)
TRENDING_EMAIL_TO=   # Recipient (optional, default: same as SMTP_USER)
```

### 3. WeChat Config (wechat channel, via WeClaw)

```env
WECLAW_API_URL=http://127.0.0.1:18011
WECHAT_TO=filehelper@im.wechat
```

**Setup**:

1. Start WeClaw local bridge: `weclaw start` ([WeClaw](https://github.com/fastclaw-ai/weclaw))
2. Scan QR code to login WeChat
3. Default HTTP API listens on `127.0.0.1:18011`
4. Set `WECHAT_TO` to recipient, e.g., `filehelper@im.wechat`

### 4. Personalization Config

```env
TRENDING_PROFILE_NOTE=          # Override default profile description
TRENDING_PROFILE_KEYWORDS=      # Append keywords (comma-separated)
TRENDING_REPO_LIMIT=10          # Repos to scan
TRENDING_RECOMMENDATION_LIMIT=5 # Repos to recommend
```

### 5. AI Developer Radar + DeepSeek Enrichment

The AI Developer Radar can enrich the final rule-ranked projects with a
DeepSeek-generated explanation. Ranking still comes from the rule-based scorer;
the LLM only explains the selected projects.

```env
RADAR_REPO_LIMIT=100
RADAR_RECOMMENDATION_LIMIT=10
RADAR_STORE_PATH=data/radar-store.json

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
LLM_ENRICHMENT_ENABLED=true
LLM_ENRICHMENT_LIMIT=10
LLM_README_MAX_CHARS=12000
LLM_TIMEOUT_MS=30000
LLM_MAX_RETRIES=2
LLM_MAX_OUTPUT_TOKENS=1200
```

If `DEEPSEEK_API_KEY` is not configured, the radar skips LLM enrichment and
continues to send the normal digest.

### Config Examples

**Email only:**

```env
NOTIFIER_CHANNELS=email
SMTP_USER=your@qq.com
SMTP_PASSWORD=your_authorization_code
TRENDING_EMAIL_TO=your@gmail.com
```

**WeChat only:**

```env
NOTIFIER_CHANNELS=wechat
WECLAW_API_URL=http://127.0.0.1:18011
WECHAT_TO=filehelper@im.wechat
```

**Email + WeChat:**

```env
NOTIFIER_CHANNELS=email,wechat
SMTP_USER=your@qq.com
SMTP_PASSWORD=your_authorization_code
TRENDING_EMAIL_TO=your@gmail.com
WECLAW_API_URL=http://127.0.0.1:18011
WECHAT_TO=filehelper@im.wechat
```

## Usage

### Option 1: npx (Recommended)

Zero installation:

```bash
# View help
npx github-trending-radar --help

# Demo mode (zero config - recommended for first use)
npx gtr --demo

# Dry run (no emails, view output)
npx github-trending-radar --dry-run

# Send notifications
npx github-trending-radar --to=your@email.com

# Send to WeChat
npx github-trending-radar --wechat-to=filehelper@im.wechat

# Use short alias
npx gtr --dry-run

# Custom parameters
npx gtr --dry-run --repo-limit=15 --recommendation-limit=5

# JSON output (pipeline-friendly)
npx gtr --dry-run --format=json
```

**Available parameters:**

- `--demo` - Demo mode: zero config, uses preset AI Product Builder profile
- `--dry-run` - Test mode, no emails sent
- `--to=EMAIL` - Recipient email (legacy, same as `--email-to`)
- `--email-to=EMAIL` - Recipient email (overrides env var)
- `--wechat-to=ID` - WeChat recipient ID (e.g., `filehelper@im.wechat`)
- `--repo-limit=N` - Repos to scan (default 10)
- `--recommendation-limit=N` - Repos to recommend (default 5)
- `--format=text|json` - Output format (default text)

**Subcommands:**

```bash
# Interactive setup wizard
npx gtr init

# View help
npx gtr --help
npx gtr init --help
```

### Option 2: pnpm scripts (Local Development)

Local dry run:

```bash
pnpm digest:dry-run
```

Send digest email:

```bash
pnpm digest:send
```

Override recipient:

```bash
pnpm digest:send -- --to=you@example.com
```

Control scan and recommendation counts:

```bash
pnpm digest:dry-run -- --repo-limit=15 --recommendation-limit=5
```

## Output

The digest contains:

- A short summary for the day
- Your current profile summary
- Focus areas
- Top recommended repositories
- Reasons each repo is relevant
- Practical ideas for how to apply it

Emails are generated in both HTML and plain text.

## Profile Customization

### Option 1: Use Preset Templates (Recommended)

Choose when running `npx gtr init`:

- **AI Product Builder** - AI tools, Agent workflows, Automation
- **Full-stack Engineer** - Next.js, React, API design, Full-stack
- **DevOps/Cloud Native** - Docker, K8s, CI/CD, Cloud infrastructure
- **Indie Hacker** - SaaS tools, MVPs, Growth, Monetization
- **Data Engineer** - ETL, Data pipelines, Analytics, ML engineering

### Option 2: Custom Config

Adjust the digest without changing code:

- `TRENDING_PROFILE_NOTE` overrides the profile summary shown in emails
- `TRENDING_PROFILE_KEYWORDS` appends extra matching keywords (comma-separated)

**Default profile** (if not using init):

- AI tools
- Agent workflows
- Automation pipelines
- Content systems
- Growth tooling
- Productized scripts

## Development

Type-check the project:

```bash
pnpm typecheck
```

Recommended local validation:

```bash
pnpm typecheck
pnpm digest:dry-run
```

## Automation

### GitHub Actions Scheduled Delivery

The project includes `.github/workflows/digest-email.yml` workflow, running daily at `01:00 UTC` (09:00 Beijing time).

**Setup steps:**

1. Add to GitHub repo Settings → Secrets:

```text
SMTP_USER
SMTP_PASSWORD
MAIL_FROM
TRENDING_EMAIL_TO
```

2. (Optional) If using WeChat, add:

```text
WECLAW_API_URL
WECHAT_TO
```

3. (Optional) Add personalization to Variables:

```text
NOTIFIER_CHANNELS=email,wechat
TRENDING_PROFILE_NOTE=
TRENDING_PROFILE_KEYWORDS=
TRENDING_REPO_LIMIT=10
TRENDING_RECOMMENDATION_LIMIT=5
```

**Manual trigger:** Use `workflow_dispatch` on GitHub Actions page.

### Local Scheduling on macOS

If sending to personal WeChat via local `weclaw`, use local scheduler instead of GitHub Actions.

Options:

- `launchd`
- `crontab`
- Any tool that can schedule `pnpm digest:send`

First-time setup:

```bash
weclaw login
weclaw start
pnpm digest:send -- --wechat-to=filehelper@im.wechat
```

## Architecture Extension

### Add New Data Source (Collector)

See `src/collectors/README.md`, steps:

1. Create new Collector (e.g., `producthunt.ts`)
2. Implement `Collector<TrendingItem>` interface
3. Export in `src/collectors/index.ts`

**Example:**

```typescript
// src/collectors/producthunt.ts
import type { Collector, TrendingItem } from './types.js';

export class ProductHuntCollector implements Collector {
  readonly name = 'producthunt';

  async fetch(limit: number): Promise<TrendingItem[]> {
    // Implement Product Hunt API fetching
    return items;
  }
}
```

### Add New Ranking Strategy (Ranker)

See `src/rankers/README.md`, steps:

1. Create new Ranker (e.g., `llm.ts`)
2. Implement `Ranker` interface
3. Wire up in task layer factory function

**Example:**

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

### Add New Notification Channel (Notifier)

1. Create new Notifier (e.g., `telegram.ts`)
2. Implement `Notifier` interface
3. Register in `src/tasks/github-trending-digest.ts` factory function

**Example:**

```typescript
// src/notifiers/telegram.ts
import type { Notifier, NotifyOptions, NotifyResult } from './types.js';

export class TelegramNotifier implements Notifier {
  readonly name = 'telegram';

  async notify(options: NotifyOptions): Promise<NotifyResult> {
    // Implement Telegram Bot API call
    return { success: true, skipped: false };
  }
}
```

## Project Structure

```text
src/
├── collectors/       # Data source abstraction layer
│   ├── types.ts     # Collector interface
│   ├── github.ts    # GitHub Trending implementation
│   └── README.md    # Extension guide
├── rankers/          # Ranking strategy layer
│   ├── types.ts     # Ranker interface
│   ├── rule-based.ts # Rule-based scoring
│   └── README.md    # Extension guide
├── notifiers/        # Notification channel layer
│   ├── types.ts     # Notifier interface
│   ├── email.ts     # Email notification
│   ├── wechat.ts    # WeChat (WeClaw)
│   └── index.ts     # Unified exports
├── profiles/         # Profile templates
├── trending/         # Profile and type definitions
├── reports/          # Ranking and digest generation
├── tasks/            # End-to-end task orchestration
└── config/           # Environment variable validation
scripts/              # CLI entry points
bin/                  # npx executables
```

## Best Practices

### 1. Scheduling Strategy

**GitHub Actions (Recommended):**
- Free, stable, zero maintenance
- Secrets encrypted storage
- Daily auto-execution

**Local cron:**
- Good for debugging or personal use
- Requires machine uptime
- Logs stored locally

**Recommendation:** Use cron for development, GitHub Actions for production.

### 2. Multi-channel Strategy

**Email only:**
- Deep reading
- Complete HTML formatting
- Archivable and searchable

**WeChat only:**
- Instant notification
- Mobile-friendly
- Group collaboration

**Email + WeChat:**
- Email for detailed reading
- WeChat for quick reminders
- Good for team collaboration

### 3. Profile Personalization

Default profile targets AI products, Agent workflows, and automation.

**Customization methods:**

1. **Append keywords** (recommended):
   ```env
   TRENDING_PROFILE_KEYWORDS=langchain,openai,nextjs
   ```

2. **Override profile description**:
   ```env
   TRENDING_PROFILE_NOTE=I am a developer focused on XXX
   ```

3. **Modify code** (advanced):
   Edit `src/trending/profile.ts`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
