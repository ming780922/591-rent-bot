# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Telegram bot that monitors rental listings from Taiwan's 591 rental website (rent.591.com.tw). Users subscribe with customizable filters and receive notifications when new matching listings appear.

## Commands

All commands run from `workers/bot/`:

```bash
npm run dev        # Run locally with wrangler dev
npm run deploy     # Deploy to Cloudflare Workers
npm run db:migrate # Apply D1 database schema migrations
```

The crawler is Python-based and runs via GitHub Actions only — no local run command.

## Architecture

```
Telegram User
     │
     ▼
Cloudflare Worker (workers/bot/)
  - POST /webhook → handles Telegram messages
  - Cron trigger (hourly) → dispatches GitHub Actions workflow
     │
     ├── D1 Database (SQLite)
     │     users, subscriptions, subscription_filters, sessions
     │
     └── GitHub Actions (crawl.yml)
           └── Python + Playwright crawler (crawler/)
                 └── Scrapes rent.591.com.tw
                 └── Sends Telegram notifications directly via Bot API
```

**Data flow:**
1. User sends `/subscribe` → Worker runs multi-step conversation (state stored in D1 `sessions` table)
2. Completed subscription saved to `subscriptions` + `subscription_filters` tables
3. Hourly cron: Worker fetches active subscriptions from D1, triggers `crawl.yml` via GitHub API with subscription JSON as input
4. Crawler visits 591 URLs (built from filter data), scrapes listings with Playwright, deduplicates by listing ID, sends up to 20 results per subscription via Telegram

## Key Files

| File | Purpose |
|------|---------|
| `workers/bot/src/index.ts` | Worker entry point — routes webhook and cron events |
| `workers/bot/src/bot.ts` | Bot setup, command handlers, callback query routing |
| `workers/bot/src/handlers/subscribe.ts` | Multi-step subscription wizard (10+ conversation states, inline keyboards) |
| `workers/bot/src/handlers/status.ts` | Display current subscription |
| `workers/bot/src/handlers/pause.ts` | Pause/resume subscription |
| `workers/bot/src/db/queries.ts` | All D1 database helpers |
| `workers/bot/src/utils/build-url.ts` | Converts filter data → 591 search URLs |
| `workers/bot/src/db/schema.sql` | D1 schema (users, subscriptions, subscription_filters, sessions) |
| `workers/bot/wrangler.toml` | Cloudflare Worker config — D1 binding, cron schedule, env vars |
| `crawler/crawler.py` | Playwright scraper — runs on GitHub Actions, sends Telegram messages |
| `.github/workflows/crawl.yml` | Manually-triggered workflow for crawling |
| `.github/workflows/deploy-worker.yml` | Auto-deploys Worker on push to `main` (workers/bot/**) |

## Bot Commands

- `/start` — Welcome message
- `/subscribe` — Interactive filter setup wizard
- `/status` — Show current subscription settings
- `/pause` / `/resume` — Toggle notifications

## Subscription Filters

Stored in `subscription_filters`: location (town or MRT-based), room type, rent range, size range, layout (rooms), building shape, 12+ feature flags (pets, cooking, parking, elevator, balcony, etc.).

## Framework & Dependencies

- **grammy** — Telegram bot framework (TypeScript)
- **Cloudflare Workers** — serverless runtime
- **Wrangler** — CLI for Workers development and deployment
- **Playwright + httpx** — Python crawler dependencies
