# Cal.com Chat Bot

A multi-platform chat bot for Cal.com built with [Chat SDK](https://chat-sdk.dev) and Next.js. Supports **Slack** and **Telegram**.

## Features

### Slack
- **Booking notifications** — DMs when someone books, reschedules, or cancels a meeting
- **`/cal availability [@user]`** — check when you or a teammate is free
- **`/cal book @user`** — book a meeting via an interactive modal + slot picker
- **`/cal bookings`** — view upcoming bookings as a Slack card
- **`/cal link`** — connect your Cal.com account via OAuth
- **App Home tab** — see upcoming bookings right in the bot's home tab

### Telegram
- **`/bookings`** — view upcoming bookings
- **`/availability`** — check your availability
- **`/link`** — connect your Cal.com account via OAuth
- **`/unlink`** — disconnect your Cal.com account
- **@mention** — ask anything in natural language (AI-powered)

## Architecture

```
app/
  api/
    webhooks/[platform]/route.ts   # Chat SDK webhook handler (Slack + Telegram events)
    webhooks/calcom/route.ts       # Cal.com webhook receiver (booking notifications)
    auth/slack/callback/route.ts   # Slack OAuth callback (workspace install)
    auth/calcom/callback/route.ts  # Cal.com OAuth callback (user account linking)
  auth/calcom/complete/page.tsx    # Post-OAuth success/error page
  page.tsx                         # Slack install landing page
lib/
  bot.ts                           # Chat instance + all event handlers
  agent.ts                         # AI agent tools (bookings, availability, etc.)
  ai-provider.ts                   # AI provider config (Groq by default; swap to OpenAI, Anthropic, etc.)
  notifications.ts                 # Booking notification card builders
  user-linking.ts                  # Redis: platform user <-> Cal.com account linking + token refresh
  format-for-telegram.ts           # Converts markdown/cards to Telegram-safe HTML
  redis.ts                         # Redis client (Upstash / ioredis)
  logger.ts                        # Structured logger
  env.ts                           # Startup environment variable validation
  calcom/
    client.ts                      # Cal.com API v2 typed client
    oauth.ts                       # Cal.com OAuth flow (auth URL, token exchange, refresh, state signing)
    types.ts                       # Cal.com API type definitions
    webhooks.ts                    # Webhook signature verification + parsing
  handlers/
    slack.ts                       # Slack-specific slash command + action handlers
    telegram.ts                    # Telegram-specific slash command handlers
slack-manifest.yml                 # Slack app manifest template
vercel.json                        # Vercel deployment config (region: iad1)
```

## Prerequisites

- Node.js 20.9+ / Bun
- A Slack workspace (for Slack bot)
- A Telegram account and BotFather access (for Telegram bot, optional)
- A Redis instance — [Upstash](https://upstash.com) recommended for Vercel (serverless-compatible)
- A Cal.com account with OAuth client access

## Setup

### 1. Install dependencies

```bash
bun install
# or: npm install
```

### 2. Create the Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From an app manifest**
3. Select your workspace and paste the contents of `slack-manifest.yml`
4. Replace `https://your-domain.com` with your deployed URL (or ngrok tunnel for local dev)
5. Under **Basic Information** → **App Credentials**, enable **Manage Distribution** for multi-workspace OAuth

### 3. Create a Cal.com OAuth client

1. Go to [app.cal.com/settings/developer/oauth](https://app.cal.com/settings/developer/oauth)
2. Create a new OAuth client
3. Set the **Redirect URI** to `https://your-domain.com/api/auth/calcom/callback`
4. A Cal.com admin will review and approve your client
5. Once approved, note your **Client ID** and **Client Secret**

### 4. Configure environment variables

Copy `.env.example` and fill in the values:

```bash
cp .env.example .env
```

| Variable                      | Required | Description                                                                 |
| ----------------------------- | -------- | --------------------------------------------------------------------------- |
| `SLACK_SIGNING_SECRET`        | ✅       | From Basic Information → App Credentials                                    |
| `SLACK_CLIENT_ID`             | ✅       | From Basic Information → App Credentials                                    |
| `SLACK_CLIENT_SECRET`         | ✅       | From Basic Information → App Credentials                                    |
| `SLACK_ENCRYPTION_KEY`        | ✅       | Generate: `openssl rand -base64 32` — encrypts bot tokens at rest in Redis  |
| `REDIS_URL`                   | ✅ prod  | Redis connection URL — required in production (see §5 below)                |
| `CALCOM_API_URL`              | ✅       | `https://api.cal.com`                                                       |
| `CALCOM_OAUTH_CLIENT_ID`      | ✅       | From Cal.com OAuth client settings                                          |
| `CALCOM_OAUTH_CLIENT_SECRET`  | ✅       | From Cal.com OAuth client settings                                          |
| `CALCOM_WEBHOOK_SECRET`       | ✅       | Set in Cal.com → Settings → Webhooks                                        |
| `CALCOM_APP_URL`              | ✅       | `https://app.cal.com`                                                       |
| `NEXT_PUBLIC_APP_URL`         | ✅       | Your deployed app URL (used for OAuth redirects and install page)           |
| `GROQ_API_KEY`                | ✅       | From [console.groq.com](https://console.groq.com) — required for AI features |
| `AI_MODEL`                    | —        | Override the default Groq model (e.g. `llama-3.3-70b-versatile`)           |
| `TELEGRAM_BOT_TOKEN`          | —        | From [@BotFather](https://t.me/BotFather) — required to enable Telegram     |
| `TELEGRAM_BOT_USERNAME`       | —        | Your bot's username (e.g. `CalcomBot`) — required when `TELEGRAM_BOT_TOKEN` is set |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | —      | Optional secret to verify incoming Telegram webhook requests                |
| `TELEGRAM_API_BASE_URL`       | —        | Override Telegram API gateway (default: `https://api.telegram.org`)        |
| `REDIS_KEY_PREFIX`            | —        | Key prefix for Chat SDK state (default: `chat-sdk`). Changing this requires reinstalling the Slack app |
| `REDIS_USE_IOREDIS`           | —        | Set `true` to use ioredis adapter (Redis Cluster / Sentinel support)        |
| `LOG_LEVEL`                   | —        | `debug` \| `info` \| `warn` \| `error` \| `silent` (default: `info` in prod, `debug` in dev) |

### 5. Set up Redis

**Upstash (recommended for Vercel):**

1. Create a database at [upstash.com](https://upstash.com)
2. Copy the **Redis URL** (format: `rediss://default:TOKEN@HOST:PORT`) to `REDIS_URL`

> **Tip:** When deploying to Vercel, you can use the [Upstash Vercel integration](https://vercel.com/integrations/upstash) to create a database and automatically set `REDIS_URL` in your project environment.

**Local development:**

```bash
docker run -p 6379:6379 redis
# REDIS_URL=redis://localhost:6379
```

> If `REDIS_URL` is not set, the bot falls back to an in-memory state adapter. This is fine for local dev but **not suitable for production** — state is lost on restart and locks don't work across serverless instances.

### 6. Set up Cal.com webhooks

1. In Cal.com, go to **Settings** → **Developer** → **Webhooks**
2. Create a new webhook pointing to `https://your-domain.com/api/webhooks/calcom`
3. Enable events: `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`, `BOOKING_CONFIRMED`
4. Add a signing secret and set it as `CALCOM_WEBHOOK_SECRET`
5. (Optional) In the webhook metadata, include `slack_team_id` and `slack_user_id` to route notifications to specific users

### Telegram (optional)

To enable the Telegram bot alongside Slack:

1. Create a bot via [@BotFather](https://t.me/BotFather) and get the bot token
2. Register the webhook URL with Telegram:
   ```bash
   # Without webhook verification (simplest)
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-domain.com/api/webhooks/telegram"

   # With webhook verification (recommended for production)
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-domain.com/api/webhooks/telegram&secret_token=<YOUR_SECRET>"
   ```
3. Add to `.env`:
   - `TELEGRAM_BOT_TOKEN` — from BotFather
   - `TELEGRAM_BOT_USERNAME` — your bot's username (e.g. `CalcomBot`)
   - `TELEGRAM_WEBHOOK_SECRET_TOKEN` — must match the `secret_token` value passed to `setWebhook` above

**Group chat:** Add the bot to a group. It responds only to @mentions. The bot does not need to be an admin.

**Limitations:** Streaming uses post+edit fallback (no native streaming). Modals are not supported. Button callback data is limited to 64 bytes — keep action IDs short.

### 7. Run locally

```bash
bun run dev
```

Expose with a tunnel:

```bash
ngrok http 3000
```

Update your Slack app's **Event Subscriptions** and **Interactivity** request URLs to the ngrok URL. Set the Slack OAuth redirect URL to `https://YOUR_NGROK_URL/api/auth/slack/callback` and the Cal.com OAuth redirect URI to `https://YOUR_NGROK_URL/api/auth/calcom/callback`.

If you are also testing Telegram locally, point the Telegram webhook at your ngrok tunnel:

```bash
# Omit secret_token for local testing (or use the same value as TELEGRAM_WEBHOOK_SECRET_TOKEN)
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://YOUR_NGROK_URL/api/webhooks/telegram"
```

Remember to restore the production webhook URL (including the secret token if you use one) when you are done with local testing:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-production-domain.com/api/webhooks/telegram&secret_token=<YOUR_SECRET>"
```

### 8. Install the app to a workspace

Visit `http://localhost:3000` and click **Add to Slack**.

### 9. Connect your Cal.com account

In Slack, run `/cal link` or in Telegram send `/link`. Click the **Continue with Cal.com** button to authorize. You can also @mention the bot — it will prompt you to connect if you haven't already.

### 10. Test the bot

- **Slack:** @mention the bot or run `/cal help`
- **Telegram:** send `/help` or @mention the bot in a group

Run `/cal bookings` (Slack) or `/bookings` (Telegram) to verify Cal.com linking end-to-end.

## Deploy to Vercel

```bash
bun run deploy
# or: npx vercel --prod --yes
```

After deploy, complete this checklist:

1. **Set env vars** — Add all environment variables in the Vercel dashboard (or use the Upstash integration for `REDIS_URL`)
2. **Update Slack app** — Replace `https://your-domain.com` with your Vercel URL in `slack-manifest.yml`, re-paste to Slack, or update Event Subscriptions + Interactivity URLs manually
3. **Update Cal.com OAuth** — Set redirect URI to `https://your-vercel-url.vercel.app/api/auth/calcom/callback`
4. **Update Cal.com webhook** — Set webhook URL to `https://your-vercel-url.vercel.app/api/webhooks/calcom`
5. **Update Telegram webhook** (if enabled) — Point to `https://your-vercel-url.vercel.app/api/webhooks/telegram`

> **Region:** `vercel.json` defaults to `iad1` (US East). Change the `regions` field to deploy closer to your users or your Upstash database region.

## Commands

### Slack

| Command                      | Description                     |
| ---------------------------- | ------------------------------- |
| `/cal link`                  | Connect your Cal.com account    |
| `/cal unlink`                | Disconnect your Cal.com account |
| `/cal availability [@user]`  | Check availability              |
| `/cal book @user`            | Book a meeting                  |
| `/cal bookings`              | View upcoming bookings          |
| `/cal help`                  | Show help                       |

### Telegram

| Command          | Description                     |
| ---------------- | ------------------------------- |
| `/link`          | Connect your Cal.com account    |
| `/unlink`        | Disconnect your Cal.com account |
| `/availability`  | Check your availability         |
| `/bookings`      | View upcoming bookings          |
| `/help`          | Show help                       |
| `@mention`       | Ask anything in natural language |

## Next steps

- [Chat SDK docs](https://chat-sdk.dev/docs) — Cards, Modals, Streaming, Actions
- [Slack adapter](https://chat-sdk.dev/docs/adapters/slack) — Multi-workspace OAuth, token encryption
- [Telegram adapter](https://chat-sdk.dev/docs/adapters/telegram) — Webhook setup, group bots
