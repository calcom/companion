# Cal.com for Slack

A multi-workspace Slack app for Cal.com built with [Chat SDK](https://chat-sdk.dev) and Next.js.

## Features

- **Booking notifications** — DMs when someone books, reschedules, or cancels a meeting
- **`/cal availability [@user]`** — check when you or a teammate is free
- **`/cal book @user`** — book a meeting via an interactive modal + slot picker
- **`/cal my-bookings`** — view upcoming bookings as a Slack card
- **`/cal link <api-key>`** — link your Cal.com account to Slack
- **App Home tab** — see upcoming bookings right in the bot's home tab

## Architecture

```
app/
  api/
    webhooks/[platform]/route.ts   # Chat SDK webhook handler (Slack events, actions, slash cmds)
    webhooks/calcom/route.ts       # Cal.com webhook receiver (booking notifications)
    auth/slack/callback/route.ts   # OAuth callback
  page.tsx                         # Install landing page
lib/
  bot.ts                           # Chat instance + all event handlers
  notifications.ts                 # Booking notification card builders
  user-linking.ts                  # Redis: Slack user <-> Cal.com account linking
  calcom/
    client.ts                      # Cal.com API v2 typed client
    types.ts                       # Cal.com API type definitions
    webhooks.ts                    # Webhook signature verification + parsing
slack-manifest.yml                 # Slack app manifest
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From an app manifest**
3. Select your workspace and paste the contents of `slack-manifest.yml`
4. Replace `https://your-domain.com` with your deployed URL (or ngrok tunnel for local dev)
5. Under **Basic Information** → **App Credentials**, enable **Manage Distribution** for multi-workspace OAuth

### 3. Configure environment variables

Copy `.env.example` and fill in the values:

```bash
cp .env.example .env
```

| Variable                | Description                                |
| ----------------------- | ------------------------------------------ |
| `SLACK_SIGNING_SECRET`  | From Basic Information → App Credentials   |
| `SLACK_CLIENT_ID`       | From Basic Information → App Credentials   |
| `SLACK_CLIENT_SECRET`   | From Basic Information → App Credentials   |
| `SLACK_ENCRYPTION_KEY`  | Generate: `openssl rand -base64 32`        |
| `REDIS_URL`             | Redis connection URL (Upstash recommended) |
| `CALCOM_API_URL`        | `https://api.cal.com`                      |
| `CALCOM_WEBHOOK_SECRET` | Set in Cal.com → Settings → Webhooks       |
| `CALCOM_APP_URL`        | `https://app.cal.com`                      |
| `NEXT_PUBLIC_APP_URL`   | Your deployed app URL                      |

### 4. Set up Redis

**Upstash (recommended for Vercel):**

1. Create a database at [upstash.com](https://upstash.com)
2. Copy the Redis URL to `REDIS_URL`

**Local development:**

```bash
docker run -p 6379:6379 redis
# REDIS_URL=redis://localhost:6379
```

### 5. Set up Cal.com webhooks

1. In Cal.com, go to **Settings** → **Developer** → **Webhooks**
2. Create a new webhook pointing to `https://your-domain.com/api/webhooks/calcom`
3. Enable events: `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`, `BOOKING_CONFIRMED`
4. Add a signing secret and set it as `CALCOM_WEBHOOK_SECRET`
5. (Optional) In the webhook metadata, include `slack_team_id` and `slack_user_id` to route notifications

### 6. Run locally

```bash
npm run dev
```

Expose with a tunnel for Slack:

```bash
ngrok http 3000
```

Update your Slack app's **Event Subscriptions** and **Interactivity** request URLs to the ngrok URL, and set the OAuth redirect URL to `https://YOUR_NGROK_URL/api/auth/slack/callback`.

### 7. Install the app to a workspace

Visit `http://localhost:3000` and click **Add to Slack**.

### 8. Link your Cal.com account

In Slack, run:

```
/cal link YOUR_CALCOM_API_KEY
```

Find your API key at https://app.cal.com/settings/developer/api-keys

## Deploy to Vercel

```bash
vercel deploy
```

Set the environment variables in the Vercel dashboard, then:

1. Update the Slack app manifest URLs to your Vercel deployment URL
2. Update the Cal.com webhook URL

## Commands

| Command                     | Description                 |
| --------------------------- | --------------------------- |
| `/cal link <api-key>`       | Link your Cal.com account   |
| `/cal unlink`               | Unlink your Cal.com account |
| `/cal availability [@user]` | Check availability          |
| `/cal book @user`           | Book a meeting              |
| `/cal my-bookings`          | View upcoming bookings      |
| `/cal help`                 | Show help                   |
