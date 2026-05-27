# Daily Dashboard Data

`pnpm radar:daily:generate` now writes two files:

- `data/latest-daily-digest.json`: existing text-only Feishu/digest payload.
- `data/latest-daily-dashboard.json`: structured data for dashboards.

The digest payload is intentionally unchanged at the top level. Dashboard consumers should read `latest-daily-dashboard.json`.

`latest-daily-dashboard.json` also exposes frontend-ready homepage fields:

- `lastUpdatedLabel`: human-readable generated time.
- `growthLinks`: GitHub repo/profile and optional personal links for dashboard CTAs.
- `homepageSections`: four render-ready homepage sections for open-source projects, AI products, AI news, and self-hosted push setup.

## Dashboard Sections

The dashboard file includes:

- `summary`: run summary, scanned repo count, AI candidate count, selected project count, top category, and baseline status.
- `projects`: selected GitHub projects with scores, deltas, LLM repo summaries, and metadata.
- `sections`: hot projects, early signals, watchlist movement, Product Hunt launches, Hugging Face model/demo signals, Hacker News buzz, AIHot highlights, and cross-source highlights.
- `sourceHealth`: per-source enabled/success status, item count, latency, warning, and error fields.
- `categoryStats`: category-level repo count, selected count, average score, star deltas, and heat score.
- `historyHighlights`: top 24h/7d star deltas, recurring projects, and rising categories.
- `trendEntities`: rule-based cross-source trend entities.
- `topicClusters`: rule-based topic clusters such as MCP, coding agents, local inference, and browser agents.

## Source Health

Dashboard source health currently covers:

- `github-trending`
- `github-search`
- `watchlist`
- `product-hunt`
- `aihot`
- `huggingface-models`
- `huggingface-spaces`
- `hackernews`

Collector failures are non-fatal and are surfaced in both `sourceHealth` and `dataNotes`.

## AIHot

AIHot collection uses Cheerio-based HTML parsing and extracts structured items from likely content blocks before falling back to link-level extraction. It filters navigation/social links, deduplicates items, infers categories, and applies `config/sources.yaml` `aihot.categories`.

If configured categories are too sparse, high-quality fallback items can be retained and the AIHot source health receives a warning.

## Trend LLM Enrichment

Trend entity enrichment is separate from repo enrichment:

- `TREND_LLM_ENRICHMENT_ENABLED=true`
- `TREND_LLM_ENRICHMENT_LIMIT=10`
- cache path: `data/llm-trend-enrichment-cache.json`

Missing API keys or LLM failures do not fail the daily run. Warnings are appended to `dataNotes`.
