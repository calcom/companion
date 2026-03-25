# @calcom/mcp-server

A **Model Context Protocol (MCP)** server that wraps the [Cal.com Platform API v2](https://cal.com/docs/api-reference/v2). Connect it to Claude Desktop, Cursor, or any MCP-compatible client to manage bookings, event types, schedules, and more through natural language.

## Features

- **24 tools** covering Bookings, Event Types, Schedules, Availability, Calendars, Webhooks, and User Profile
- **Two auth modes**: API Key (default) and OAuth with automatic token refresh
- **Structured error handling** with clean MCP error responses
- **Zod-validated inputs** for every tool

## Setup

### Prerequisites

- Node.js >= 18
- [Bun](https://bun.sh/) (for workspace install)
- A Cal.com account with an API key or OAuth credentials

### Install & Build

```bash
# From the repo root
bun install
bun --filter @calcom/mcp-server build
```

### Configure

Copy the example env file and fill in your credentials:

```bash
cp packages/mcp-server/.env.example packages/mcp-server/.env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `CAL_AUTH_MODE` | No | `apikey` | Auth mode: `apikey` or `oauth` |
| `CAL_API_KEY` | If `apikey` mode | — | Your Cal.com API key |
| `CAL_OAUTH_CLIENT_ID` | If `oauth` mode | — | OAuth client ID |
| `CAL_OAUTH_CLIENT_SECRET` | If `oauth` mode | — | OAuth client secret |
| `CAL_OAUTH_ACCESS_TOKEN` | No | — | Seed access token (optional) |
| `CAL_OAUTH_REFRESH_TOKEN` | No | — | Seed refresh token (optional) |
| `CAL_API_BASE_URL` | No | `https://api.cal.com` | Cal.com API base URL |

### Run

```bash
# Production (after build)
bun --filter @calcom/mcp-server start

# Development
bun --filter @calcom/mcp-server dev
```

## Connecting to MCP Clients

### Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "calcom": {
      "command": "node",
      "args": ["<path-to-repo>/packages/mcp-server/dist/index.js"],
      "env": {
        "CAL_AUTH_MODE": "apikey",
        "CAL_API_KEY": "cal_live_xxxx"
      }
    }
  }
}
```

### Cursor / Other MCP Clients

Point your MCP client to the built entry point at `packages/mcp-server/dist/index.js` with the required environment variables.

## Auth Modes

### API Key (default)

Set `CAL_AUTH_MODE=apikey` and provide `CAL_API_KEY`. Every request sends:
- `Authorization: Bearer <CAL_API_KEY>`
- `cal-api-version: 2024-08-13`

This is the simplest mode for server-to-server usage.

### OAuth

Set `CAL_AUTH_MODE=oauth` and provide `CAL_OAUTH_CLIENT_ID` and `CAL_OAUTH_CLIENT_SECRET`. Optionally seed tokens with `CAL_OAUTH_ACCESS_TOKEN` and `CAL_OAUTH_REFRESH_TOKEN`.

- Access tokens are valid ~60 minutes; refresh tokens ~1 year
- Tokens are auto-refreshed when expired
- On 401 responses, the client retries once after refreshing
- Refreshed tokens are persisted to `.cal-oauth-tokens.json` so restarts don't lose tokens

> **Note:** This implements single-account OAuth only. Multi-tenant / managed-user OAuth is out of scope.

## Tools

### Bookings
| Tool | Description |
|---|---|
| `get_bookings` | List bookings with optional filters |
| `get_booking` | Get a specific booking by UID |
| `create_booking` | Create a new booking |
| `reschedule_booking` | Reschedule a booking |
| `cancel_booking` | Cancel a booking |
| `confirm_booking` | Confirm a pending booking |

### Event Types
| Tool | Description |
|---|---|
| `get_event_types` | List all event types |
| `get_event_type` | Get a specific event type |
| `create_event_type` | Create a new event type |
| `update_event_type` | Update an event type |
| `delete_event_type` | Delete an event type |

### Schedules
| Tool | Description |
|---|---|
| `get_schedules` | List all schedules |
| `get_schedule` | Get a specific schedule |
| `create_schedule` | Create a new schedule |
| `update_schedule` | Update a schedule |
| `delete_schedule` | Delete a schedule |

### Availability / Slots
| Tool | Description |
|---|---|
| `get_availability` | Get available time slots (`GET /v2/slots`). Params: `start` (required), `end` (required), `timeZone?`, `eventTypeId?`, `eventTypeSlug?`, `username?`, `teamSlug?`, `organizationSlug?`, `usernames?`, `duration?`, `format?`, `bookingUidToReschedule?`. Uses `cal-api-version: 2024-09-04`. |

### Calendars
| Tool | Description |
|---|---|
| `get_calendars` | List connected calendars |
| `get_busy_times` | Get busy times from calendars |

### Webhooks
| Tool | Description |
|---|---|
| `get_webhooks` | List all webhooks |
| `create_webhook` | Create a webhook |
| `delete_webhook` | Delete a webhook |

### User Profile
| Tool | Description |
|---|---|
| `get_me` | Get authenticated user profile |
| `update_me` | Update user profile |
