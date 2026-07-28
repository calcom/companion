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
- **Links** — Browse and edit booking links including duration, recurrence, limits, and availability
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

Copy the example env file and fill in your Cal.com OAuth credentials:

```sh
cp .env.example .env
```

### Run the mobile app

```sh
# Expo dev server
bun run mobile

# iOS
bun run mobile:ios

# Android
bun run mobile:android

# Web (Expo)
bun run mobile:web
```

### Run the browser extension

```sh
# Dev mode (Chrome, hot reload)
bun run ext

# Build the default extension target
bun run ext:build

# Build all browsers
bun run ext:build:all
```

Production builds (for store submission) use the `:prod` variants which point to `https://companion.cal.com`:

```sh
bun run ext:build:prod
bun run ext:zip:prod
```

## Project Structure

```
├── apps/
│   ├── mobile/           # Expo mobile app, native widgets, and mobile services
│   ├── extension/        # Browser extension source (WXT)
│   ├── chat/             # Next.js chat bot app
│   └── mcp-server/       # Cal.com MCP server app
├── packages/
│   └── cli/              # Cal.com CLI (@calcom/cli)
├── package.json          # Root workspace scripts
├── bun.lock              # Bun lockfile
└── biome.json            # Root Biome configuration
```

## Scripts

| Command | Description |
|---|---|
| `bun run mobile` | Start the Expo dev server |
| `bun run mobile:ios` | Run the mobile app on an iOS simulator |
| `bun run mobile:android` | Run the mobile app on an Android emulator |
| `bun run mobile:web` | Run the mobile app in the browser via Expo |
| `bun run mobile:export` | Export the mobile app bundle |
| `bun run mobile:test` | Run the mobile Jest test suite |
| `bun run mobile:e2e` | Run the default Maestro e2e flow |
| `bun run mobile:e2e:check` | Validate Maestro e2e flow files |
| `bun run mobile:e2e:ios` | Run Maestro e2e flows on iOS |
| `bun run mobile:e2e:android` | Run Maestro e2e flows on Android |
| `bun run ext` | Start extension dev server (WXT) |
| `bun run ext:build` | Build the default extension target |
| `bun run ext:build:prod` | Build the default extension target for store submission |
| `bun run ext:zip` | Package the default extension target |
| `bun run ext:zip:prod` | Package the default extension target for store submission |
| `bun run ext:build:all` | Build all configured extension browser targets |
| `bun run ext:build:all:prod` | Build all configured extension targets for store submission |
| `bun run typecheck` | Type-check every workspace that exposes a `typecheck` script |
| `bun run typecheck:chat` | Type-check the chat app only |
| `bun run lint` | Lint with Biome |
| `bun run lint:react-compiler` | Run the mobile React Compiler lint |
| `bun run check:no-cal-hostnames` | Check mobile source for disallowed Cal.com hostnames |
| `bun run lint:all` | Run lint, React Compiler lint, and hostname checks |
| `bun run format` | Format with Biome |
| `bun run format:check` | Check Biome formatting |
| `bun run check` | Run Biome checks and apply safe fixes |
| `bun run check:ci` | Run Biome CI checks |

## Contributing

This repo uses [Biome](https://biomejs.dev/) for linting and formatting, enforced via Husky pre-commit hooks. Before submitting a PR, make sure your changes pass:

```sh
bun run check:ci
bun run typecheck
bun run lint:all
```

## Chat Bot — Telegram Setup

The `apps/chat/` directory contains a multi-platform chat bot. Slack is the primary adapter; Telegram is optional.

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
