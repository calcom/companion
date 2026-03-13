<p align="center">
  <img src="https://cal.com/logo.svg" alt="Cal.com Logo" width="60" />
</p>

<h1 align="center">@calcom/cli</h1>

<p align="center">
  Official command-line interface for Cal.com API v2
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@calcom/cli"><img src="https://img.shields.io/npm/v/@calcom/cli" alt="npm version" /></a>
  <a href="https://cal.com/docs/api-reference/v2"><img src="https://img.shields.io/badge/API-v2-blue" alt="API v2" /></a>
</p>

---

Manage your [Cal.com](https://cal.com) account directly from your terminal. View bookings, manage event types, handle schedules, and more — all without leaving the command line.

## Installation

```sh
npm install -g @calcom/cli
```

Requires Node.js 18+.

## Getting Started

```sh
# Authenticate with Cal.com
calcom login

# View all available commands
calcom --help
```

## Development

```sh
# Install dependencies
bun install

# Run locally
bun run --filter @calcom/cli dev -- --help

# Build
bun run --filter @calcom/cli build

# Type check
bun run --filter @calcom/cli type-check

# Build tarball and install locally
cd packages/cli
npm pack
npm install -g calcom-cli-0.0.1.tgz
```

## Self-hosted Cal.com

Connect to a self-hosted instance:

```sh
calcom login --api-key your_key --api-url https://api.your-cal-instance.com
```

## Links

- [Cal.com](https://cal.com)
- [Cal.com API v2 Documentation](https://cal.com/docs/api-reference/v2)
- [npm Package](https://www.npmjs.com/package/@calcom/cli)
