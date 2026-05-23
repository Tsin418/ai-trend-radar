# Contributing

## Local setup

```bash
pnpm install
cp .env.example .env.local
pnpm typecheck
pnpm digest:dry-run
```

## Rules

- Do not commit `.env.local` or any real SMTP credentials.
- Keep the project focused on one pipeline: `collect -> rank -> report -> send`.
- Prefer small, auditable changes over broad refactors.

## Before opening a PR

```bash
pnpm typecheck
pnpm digest:dry-run
```
