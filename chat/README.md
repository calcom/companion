# Cal.com for Slack

A multi-workspace Slack app for Cal.com built with [Chat SDK](https://chat-sdk.dev) and Next.js.

## Features

- **Booking notifications** — DMs when someone books, reschedules, or cancels a meeting
- **`/cal availability [@user]`** — check when you or a teammate is free
- **`/cal book @user`** — book a meeting via an interactive modal + slot picker
- **`/cal bookings`** — view upcoming bookings as a Slack card
- **`/cal link`** — connect your Cal.com account via OAuth ("Continue with Cal.com")
- **App Home tab** — see upcoming bookings right in the bot's home tab

## Architecture

```
app/
  api/
    webhooks/[platform]/route.ts   # Chat SDK webhook handler (Slack events, actions, slash cmds)
    webhooks/calcom/route.ts       # Cal.com webhook receiver (booking notifications)
    auth/slack/callback/route.ts   # Slack OAuth callback (workspace install)
    auth/calcom/callback/route.ts  # Cal.com OAuth callback (user account linking)
  auth/calcom/complete/page.tsx    # Post-OAuth success/error page
  page.tsx                         # Install landing page
lib/
  bot.ts                           # Chat instance + all event handlers
  notifications.ts                 # Booking notification card builders
  user-linking.ts                  # Redis: Slack user <-> Cal.com account linking + token refresh
  calcom/
    client.ts                      # Cal.com API v2 typed client
    oauth.ts                       # Cal.com OAuth flow (auth URL, token exchange, refresh, state signing)
    types.ts                       # Cal.com API type definitions
    webhooks.ts                    # Webhook signature verification + parsing
slack-manifest.yml                 # Slack app manifest
```

## Prerequisites

- Node.js 18+
- npm or pnpm
- A Slack workspace
- A Redis instance (Upstash recommended for Vercel)
- A Cal.com account with OAuth client access

## Setup

### 1. Install dependencies

```bash
npm install
# or: pnpm install
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

| Variable                    | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `SLACK_SIGNING_SECRET`      | From Basic Information → App Credentials             |
| `SLACK_CLIENT_ID`           | From Basic Information → App Credentials             |
| `SLACK_CLIENT_SECRET`       | From Basic Information → App Credentials             |
| `SLACK_ENCRYPTION_KEY`      | Generate: `openssl rand -base64 32`                  |
| `REDIS_URL`                 | Redis connection URL (Upstash recommended)           |
| `CALCOM_API_URL`            | `https://api.cal.com`                                |
| `CALCOM_OAUTH_CLIENT_ID`    | From Cal.com OAuth client settings                   |
| `CALCOM_OAUTH_CLIENT_SECRET`| From Cal.com OAuth client settings                   |
| `CALCOM_WEBHOOK_SECRET`     | Set in Cal.com → Settings → Webhooks                 |
| `CALCOM_APP_URL`            | `https://app.cal.com`                                |
| `NEXT_PUBLIC_APP_URL`       | Your deployed app URL                                |
| `GROQ_API_KEY`              | From [console.groq.com](https://console.groq.com) (required for AI features) |

### 5. Set up Redis

**Upstash (recommended for Vercel):**

1. Create a database at [upstash.com](https://upstash.com)
2. Copy the Redis URL to `REDIS_URL`

**Local development:**

```bash
docker run -p 6379:6379 redis
# REDIS_URL=redis://localhost:6379
```

### 6. Set up Cal.com webhooks

1. In Cal.com, go to **Settings** → **Developer** → **Webhooks**
2. Create a new webhook pointing to `https://your-domain.com/api/webhooks/calcom`
3. Enable events: `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`, `BOOKING_CONFIRMED`
4. Add a signing secret and set it as `CALCOM_WEBHOOK_SECRET`
5. (Optional) In the webhook metadata, include `slack_team_id` and `slack_user_id` to route notifications

### Telegram (optional)

To enable the Telegram bot alongside Slack:

1. Create a bot via [@BotFather](https://t.me/BotFather) and get the bot token
2. Set the webhook URL in BotFather or via the Telegram API:
   ```
   https://your-domain.com/api/webhooks/telegram
   ```
3. Add to `.env`:
   - `TELEGRAM_BOT_TOKEN` — from BotFather
   - `TELEGRAM_BOT_USERNAME` — your bot's username (e.g. `CalcomBot`)
   - `TELEGRAM_WEBHOOK_SECRET_TOKEN` — (optional) set in BotFather webhook secret to verify incoming requests

The webhook route at `app/api/webhooks/[platform]/route.ts` supports both Slack and Telegram.

**Limitations:** Streaming uses post+edit fallback (no native streaming). Modals are not supported. Button callback data is limited to 64 bytes — keep action IDs short.

### 7. Run locally

```bash
npm run dev
```

Expose with a tunnel for Slack:

```bash
ngrok http 3000
```

Update your Slack app's **Event Subscriptions** and **Interactivity** request URLs to the ngrok URL. Set the Slack OAuth redirect URL to `https://YOUR_NGROK_URL/api/auth/slack/callback` and the Cal.com OAuth redirect URI to `https://YOUR_NGROK_URL/api/auth/calcom/callback`.

If you are also testing Telegram locally, point the Telegram webhook at your ngrok tunnel:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://YOUR_NGROK_URL/api/webhooks/telegram"
```

Remember to restore the production webhook URL when you are done with local testing:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-production-domain.com/api/webhooks/telegram"
```

### 8. Install the app to a workspace

Visit `http://localhost:3000` and click **Add to Slack**.

### 9. Connect your Cal.com account

In Slack, run:

```
/cal link
```

Click the **Continue with Cal.com** button to authorize the app with your Cal.com account. You can also @mention the bot or open the App Home tab — both will prompt you to connect if you haven't already.

### 10. Test the bot

In a channel, @mention the bot or run `/cal help`. You should see a response. Run `/cal bookings` to verify Cal.com linking.

## Deploy to Vercel

```bash
vercel deploy
```

After deploy, complete this checklist:

1. **Set env vars** — Add all environment variables in the Vercel dashboard
2. **Update Slack app** — Replace `https://your-domain.com` with your Vercel URL in `slack-manifest.yml`, re-paste to Slack, or update Event Subscriptions + Interactivity URLs manually
3. **Update Cal.com OAuth** — Set redirect URI to `https://your-vercel-url.com/api/auth/calcom/callback`
4. **Update Cal.com webhook** — Set webhook URL to `https://your-vercel-url.com/api/webhooks/calcom`

## Commands

| Command                     | Description                     |
| --------------------------- | ------------------------------- |
| `/cal link`                 | Connect your Cal.com account    |
| `/cal unlink`               | Disconnect your Cal.com account |
| `/cal availability [@user]` | Check availability              |
| `/cal book @user`           | Book a meeting                  |
| `/cal bookings`             | View upcoming bookings          |
| `/cal help`                 | Show help                       |

## Next steps

- [Chat SDK docs](https://chat-sdk.dev/docs) — Cards, Modals, Streaming, Actions
- [Slack adapter](https://chat-sdk.dev/docs/adapters/slack) — Multi-workspace OAuth, token encryption
