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
# iOS
bun run ios

# Android
bun run android

# Web (Expo)
bun run web
```

### Run the browser extension

```sh
# Dev mode (Chrome, hot reload)
bun run ext

# Build for a specific browser
bun run ext:build-chrome
bun run ext:build-firefox
bun run ext:build-safari
bun run ext:build-edge

# Build all browsers
bun run ext:build-all
```

Production builds (for store submission) use the `-prod` variants which point to `https://companion.cal.com`:

```sh
bun run ext:build-chrome-prod
bun run ext:zip-chrome-prod
```

## Project Structure

```
├── app/                  # Expo Router screens (tabs, modals, sheets)
├── components/           # Shared React Native components
├── extension/            # Browser extension source (WXT)
│   ├── entrypoints/      # Background script & content script
│   ├── lib/              # Gmail, LinkedIn, Google Calendar integrations
│   └── public/           # Extension icons & static assets
├── hooks/                # Custom React hooks
├── services/             # Cal.com API client & OAuth service
├── contexts/             # React context providers (Auth, Query, Toast)
├── widgets/              # Android home-screen widget
├── targets/widget/       # iOS WidgetKit target (SwiftUI)
├── utils/                # Shared utilities
├── config/               # Cache configuration
├── constants/            # Colors, timezones
└── types/                # Shared TypeScript types
```

## Scripts

| Command | Description |
|---|---|
| `bun run start` | Start the Expo dev server |
| `bun run ios` | Run on iOS simulator |
| `bun run android` | Run on Android emulator |
| `bun run web` | Run in the browser via Expo |
| `bun run ext` | Start extension dev server (WXT) |
| `bun run ext:build-all` | Build extension for all browsers |
| `bun run typecheck` | Type-check the mobile app |
| `bun run typecheck:extension` | Type-check the browser extension |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format with Biome |
| `bun run check:ci` | Run Biome CI checks |

## Contributing

This repo uses [Biome](https://biomejs.dev/) for linting and formatting, enforced via Husky pre-commit hooks. Before submitting a PR, make sure your changes pass:

```sh
bun run check:ci
bun run typecheck:all
```

## Links

- [Cal.com](https://cal.com)
- [Cal.com Companion landing page](https://cal.com/app)
- [Chrome Web Store](https://chromewebstore.google.com/detail/cal-companion/cbhlgojmamgmdijlkkokcmmjghgckahc)
- [Documentation](https://cal.com/docs)

## License

This project is maintained by [Cal.com, Inc.](https://cal.com)
