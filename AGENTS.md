# Companion Development Guide for AI Agents

Companion is a Bun-based monorepo for Cal.com's mobile app, browser extension, and
AI-driven interfaces (chat gateway, MCP server, CLI). This file is the main entry
point for AI agents working in this repo.

## Repo Areas

| Path | What it is |
|------|------------|
| `apps/mobile` | Expo (React Native) mobile app for iOS/Android. |
| `apps/extension` | WXT-based browser extension. |
| `apps/chat` | Multi-protocol bot gateway (Slack/Telegram) with an AI agent. |
| `packages/cli` | Command-line interface for Cal.com API interactions. |

## Tooling

- **Runtime / package manager**: Bun (workspaces in `apps/*`, `packages/*`).
- **Lint & format**: Biome (`bun run lint`, `bun run format`, `bun run check`).
- **Type check**: `bun run typecheck`.
- **Git hooks**: Husky + lint-staged run `biome format --write` on staged files.

Note: Biome's `files.includes` in `biome.json` only covers `js/jsx/ts/tsx/json`,
so `bun run format` / `format:check` do **not** touch Markdown. Validate docs with
`git diff --check` (whitespace) and a manual read.

## When Touching Mobile App Tests

Before adding or changing tests for `apps/mobile`, start with
[.agents/rules/testing-mobile.md](.agents/rules/testing-mobile.md). It routes
agents to the correct Jest, Maestro, or AI-assisted authoring rule.

## Scope of These Rules

The `.agents/rules` here are intentionally narrow and scoped by area.

The mobile testing rules apply to `apps/mobile` test strategy, Jest
unit/component tests, Maestro E2E flows, and AI-assisted mobile test authoring.

## Extended Documentation

- **[.agents/README.md](.agents/README.md)** — agent docs index and rules list.
- **[.agents/rules/](.agents/rules/)** — modular engineering rules.
