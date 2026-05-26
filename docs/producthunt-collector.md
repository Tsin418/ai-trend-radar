# Product Hunt Collector

Product Hunt is treated as a launch and product-interest signal for the AI Developer Radar. It complements GitHub code momentum, but Product Hunt votes are not equivalent to GitHub stars and are not used as a code-quality signal.

## Configuration

For local dry-runs, add the token and optional collector settings to `.env.local`:

```env
PRODUCT_HUNT_TOKEN=your_product_hunt_api_token
PRODUCT_HUNT_ENABLED=true
PRODUCT_HUNT_POST_LIMIT=30
PRODUCT_HUNT_DAYS_BACK=1
PRODUCT_HUNT_TOPICS=artificial-intelligence,developer-tools,open-source,productivity,saas
PRODUCT_HUNT_KEYWORDS=ai,llm,agent,rag,mcp,coding,developer,devtool,automation,workflow,open source,api,sdk
PRODUCT_HUNT_MIN_VOTES=10
PRODUCT_HUNT_MIN_COMMENTS=0
```

`PRODUCT_HUNT_TOKEN` must not be committed. Product Hunt states that its API is not for commercial use by default, so this integration is intended for personal or internal research unless you have separate approval from Product Hunt.

## Dry Run

```bash
pnpm producthunt:dry-run
pnpm producthunt:json
pnpm producthunt:dry-run -- --limit=20 --days-back=2 --topic=developer-tools
```

The text output prints Product Hunt URL, website, votes, comments, heat score, topics, and tagline. JSON output emits normalized `TrendingItem` objects.

## Signal Model

Posts are fetched from Product Hunt API v2 GraphQL with `featured: true`, then deduped and filtered with deterministic rules:

- topic matches configured Product Hunt topics
- name, tagline, or description contains configured AI/developer keywords
- website or product links contain obvious developer signals such as GitHub, docs, API, or SDK URLs
- votes/comments meet the configured minimums

The V1 heat score is:

```txt
heatScore = votesCount + commentsCount * 3
```

Product Hunt output remains a separate launch/product signal. The daily GitHub radar digest is not changed by this collector.

## Cloudflare Deployment

The Cloudflare Worker cron fetches the generated GitHub digest JSON, collects Product Hunt launch signals at send time, and appends them to the Feishu message as a separate section.

Store the token as a Cloudflare secret:

```bash
npx wrangler secret put PRODUCT_HUNT_TOKEN
```

In the Cloudflare dashboard, the same setting is under:

```txt
Workers & Pages -> ai-trend-radar -> Settings -> Variables and Secrets -> Add -> Secret
```

Use `PRODUCT_HUNT_TOKEN` as the name and paste the Product Hunt API token as the value.

Non-secret tuning values can be set as Worker variables in the dashboard or in `wrangler.toml` under `[vars]`:

```toml
[vars]
PRODUCT_HUNT_ENABLED = "true"
PRODUCT_HUNT_POST_LIMIT = "30"
PRODUCT_HUNT_DAYS_BACK = "1"
PRODUCT_HUNT_TOPICS = "artificial-intelligence,developer-tools,open-source,productivity,saas"
PRODUCT_HUNT_KEYWORDS = "ai,llm,agent,rag,mcp,coding,developer,devtool,automation,workflow,open source,api,sdk"
PRODUCT_HUNT_MIN_VOTES = "10"
PRODUCT_HUNT_MIN_COMMENTS = "0"
```
