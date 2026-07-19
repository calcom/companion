<p align="center">
  <img src="https://cal.com/logo.svg" alt="Cal.com Logo" width="60" />
</p>

<h1 align="center">Cal.com Companion</h1>

<p align="center">
  Your scheduling companion — in your pocket or your browser.
</p>

<p align="center">
  <a href="https://cal.com/app">Website</a> ·
  <a href="https://apps.apple.com/app/cal-com-companion/id6746080498">App Store</a> ·
  <a href="https://play.google.com/store/apps/details?id=com.calcom.companion">Google Play</a> ·
  <a href="https://chromewebstore.google.com/detail/cal-companion/cbhlgojmamgmdijlkkokcmmjghgckahc">Chrome Web Store</a>
</p>

---

Cal.com Companion lets you manage your [Cal.com](https://cal.com) schedule from anywhere. It ships as a **mobile app** (iOS & Android), a set of **browser extensions** (Chrome, Firefox, Safari, Edge), and **home-screen widgets** — all from a single codebase.

## Mobile App

A native companion app built with [Expo](https://expo.dev) and React Native.

- **Bookings** — View, cancel, reschedule, add guests, and mark no-shows
- **Event Types** — Browse and edit event types including duration, recurrence, limits, and availability
- **Availability** — Manage schedules, working hours, and date overrides
- **Widgets** — Home-screen widgets for iOS (WidgetKit) and Android show your upcoming bookings at a glance
- **Dark mode** — Full light/dark theme support that follows your system preference
- **OAuth** — Secure sign-in via Cal.com OAuth with PKCE

## CLI

A command-line interface for Cal.com API v2 — manage your account directly from the terminal.

```sh
npm install -g @calcom/cli

calcom login    # Authenticate with Cal.com
calcom --help   # View all available commands
```

## Browser Extensions

A cross-browser extension built with [WXT](https://wxt.dev) that brings Cal.com into the pages you already use.

- **Sidebar** — Click the Cal.com icon in your browser toolbar to open a sidebar with your full bookings, event types, and availability
- **Gmail integration** — A Cal.com button appears in the Gmail compose toolbar so you can insert a scheduling link directly into an email
- **LinkedIn integration** — A Cal.com button is injected into the LinkedIn messaging composer for quick link sharing
- **Google Calendar no-show** — Adds a "No Show" toggle next to attendees in Google Calendar event popups for Cal.com bookings
- **Supported browsers** — Chrome, Brave, Firefox, Safari, and Microsoft Edge

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile app | [Expo](https://expo.dev) (React Native) with [Expo Router](https://docs.expo.dev/router/introduction/) |
| Styling | [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native) |
| Browser extension | [WXT](https://wxt.dev) (next-gen web extension framework) |
| CLI | [Commander.js](https://github.com/tj/commander.js) with auto-generated API client |
| Data fetching | [TanStack Query](https://tanstack.com/query) with persistent cache |
| iOS widget | SwiftUI + WidgetKit |
| Android widget | [react-native-android-widget](https://github.com/nickkraakman/react-native-android-widget) |
| Auth | Cal.com OAuth 2.0 with PKCE |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Bun](https://bun.sh/) (recommended) or npm
- For mobile development: Xcode (iOS) or Android Studio (Android)

### Install dependencies

```sh
bun install
```

### Environment

Copy the example env files and fill in your Cal.com OAuth credentials (or API keys where noted):

```sh
cp .env.example .env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/extension/.env.example apps/extension/.env
# Optional surfaces:
cp apps/chat/.env.example apps/chat/.env
cp apps/mcp-server/.env.example apps/mcp-server/.env
```

### Run the mobile app

```sh
# Expo dev server
bun run mobile

# iOS (macOS + Xcode)
bun run mobile:ios

# Android (Android Studio / emulator)
bun run mobile:android

# Web (Expo)
bun run mobile:web
```

### Run the browser extension

```sh
# Dev mode (Chrome, hot reload)
bun run ext

# Build default target
bun run ext:build

# Build all browsers
bun run ext:build:all

# Per-browser builds (via the extension workspace)
bun --filter extension build:chrome
bun --filter extension build:firefox
bun --filter extension build:safari
bun --filter extension build:edge
```

Production / store builds use the `:prod` variants (points to `https://companion.cal.com`):

```sh
bun run ext:build:prod
bun run ext:zip:prod
bun --filter extension build:chrome:prod
bun --filter extension zip:chrome:prod
```

### Other workspaces

```sh
# CLI
bun run --filter @calcom/cli dev -- --help

# MCP server (set CAL_API_KEY in apps/mcp-server/.env for stdio mode)
bun --filter @calcom/mcp-server build
bun --filter @calcom/mcp-server start

# Chat bot (see apps/chat/README.md)
bun --filter @calcom/chat dev
```

## Project Structure

```
├── apps/
│   ├── mobile/           # Expo (React Native) app + widgets
│   ├── extension/        # Browser extension (WXT)
│   ├── chat/             # Slack / Telegram bot gateway
│   └── mcp-server/       # Cal.com API v2 MCP server
├── packages/
│   └── cli/              # Cal.com CLI (@calcom/cli)
├── docs/
│   └── api-reference/    # Local OpenAPI reference material
└── package.json          # Root workspace scripts (Bun)
```

Mobile app source (screens, components, hooks, services, widgets) lives under `apps/mobile/`.

## Scripts

| Command | Description |
|---|---|
| `bun run mobile` | Start the Expo dev server |
| `bun run mobile:ios` | Run on iOS simulator |
| `bun run mobile:android` | Run on Android emulator |
| `bun run mobile:web` | Run in the browser via Expo |
| `bun run ext` | Start extension dev server (WXT) |
| `bun run ext:build` | Build the extension (default browser) |
| `bun run ext:build:all` | Build extension for all browsers |
| `bun run ext:build:prod` | Production extension build |
| `bun run typecheck` | Type-check all workspaces |
| `bun run typecheck:chat` | Type-check the chat app |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format with Biome |
| `bun run check:ci` | Run Biome CI checks |

## Contributing

This repo uses [Biome](https://biomejs.dev/) for linting and formatting, enforced via Husky pre-commit hooks. Before submitting a PR, make sure your changes pass:

```sh
bun run check:ci
bun run typecheck
```

## Chat Bot — Telegram Setup

The `apps/chat/` directory contains a multi-platform chat bot. Slack is the primary adapter; Telegram is optional. See [`apps/chat/README.md`](apps/chat/README.md) for full setup.

### Prerequisites

1. Create a bot with [BotFather](https://t.me/BotFather) on Telegram (`/newbot`)
2. Copy the bot token and username

### Environment Variables

Add to your `apps/chat/.env`:

```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_BOT_USERNAME=YourBotName
```

### Register the Webhook

Point Telegram at your deployed chat app:

```sh
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://your-domain.com/api/webhooks/telegram"
```

### Supported Commands

| Command | Description |
|---------|-------------|
| `/start` | Show help card |
| `/help` | Show help card |
| `/link` | Connect your Cal.com account |
| `/unlink` | Disconnect your Cal.com account |

Any other message mentioning the bot triggers the AI scheduling assistant.

## Links

- [Cal.com](https://cal.com)
- [Cal.com Companion landing page](https://cal.com/app)
- [Chrome Web Store](https://chromewebstore.google.com/detail/cal-companion/cbhlgojmamgmdijlkkokcmmjghgckahc)
- [@calcom/cli on npm](https://www.npmjs.com/package/@calcom/cli)
- [Documentation](https://cal.com/docs)
