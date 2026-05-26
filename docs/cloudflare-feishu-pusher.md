# Cloudflare Feishu Pusher

This project uses a split schedule for reliable 09:00 Asia/Shanghai delivery:

1. GitHub Actions generates `data/latest-daily-digest.json` at 08:35.
2. Cloudflare Worker Cron fetches that digest at 09:00 and sends it to Feishu.

The root `wrangler.toml` makes `npx wrangler deploy` deploy the Worker entry at
`workers/feishu-pusher/src/index.ts`. It is not a static Pages project.

## GitHub Actions

The daily workflow runs:

```bash
pnpm radar:daily:generate
```

It commits:

- `data/radar-store.json`
- `data/latest-daily-digest.json`
- `data/llm-enrichment-cache.json`, when present

GitHub Actions no longer needs `FEISHU_WEBHOOK_URL` or `FEISHU_SECRET`.

## Cloudflare Setup

Create or select a Cloudflare Workers project connected to this repository.

Use this deploy command:

```bash
npx wrangler deploy
```

The Worker name in `wrangler.toml` is `ai-trend-radar` so it matches the
connected Cloudflare build project.

Set these Worker secrets:

```bash
npx wrangler secret put FEISHU_WEBHOOK_URL
npx wrangler secret put FEISHU_SECRET
```

`FEISHU_SECRET` is optional if the Feishu bot does not use signature validation.

Optional secrets:

```bash
npx wrangler secret put MANUAL_SEND_TOKEN
npx wrangler secret put GITHUB_TOKEN
```

`MANUAL_SEND_TOKEN` enables authenticated manual sends:

```bash
curl -X POST \
  -H "Authorization: Bearer $MANUAL_SEND_TOKEN" \
  "https://<worker-host>/send?force=true"
```

`GITHUB_TOKEN` is only needed if the digest URL moves to a private repository or
GitHub raw access becomes restricted.

## KV Idempotency

Bind a Workers KV namespace named `RADAR_STATE` to the Worker. The Worker uses
keys like `sent:daily-YYYY-MM-DD` to avoid duplicate Feishu sends.

The Worker can deploy without this binding, but duplicate-send protection is
disabled until `RADAR_STATE` exists.

## Runtime Configuration

`wrangler.toml` includes:

```toml
[triggers]
crons = ["0 1 * * *"]

[vars]
DIGEST_URL = "https://raw.githubusercontent.com/Tsin418/ai-trend-radar/main/data/latest-daily-digest.json"
MAX_DIGEST_AGE_HOURS = "36"
```

Cloudflare Cron uses UTC, so `0 1 * * *` means 09:00 in Asia/Shanghai.

You can also test the Worker with the manual endpoint if `MANUAL_SEND_TOKEN` is
configured:

```bash
curl -X POST \
  -H "Authorization: Bearer $MANUAL_SEND_TOKEN" \
  "https://<worker-host>/send?force=true"
```
