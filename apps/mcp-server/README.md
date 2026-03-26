# @calcom/mcp-server

A **Model Context Protocol (MCP)** server that wraps the [Cal.com Platform API v2](https://cal.com/docs/api-reference/v2). Connect it to Claude Desktop, Cursor, or any MCP-compatible client to manage bookings, event types, schedules, and more through natural language.

## Features

- **~263 tools** covering Bookings, Event Types, Schedules, Availability, Calendars, Webhooks, User Profile, Teams, Organizations, Conferencing, Stripe, Routing Forms, and more
- **Three auth modes**: API Key (local/dev), single-account OAuth (stdio), and multi-tenant hosted OAuth with per-connection token storage
- **Multi-tenant OAuth**: Authorization Code + PKCE flow with encrypted token storage (AES-256-GCM) in SQLite
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
cp apps/mcp-server/.env.example apps/mcp-server/.env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `CAL_AUTH_MODE` | No | `apikey` | Auth mode: `apikey`, `oauth`, or `hosted` |
| `CAL_API_KEY` | If `apikey` mode | — | Your Cal.com API key |
| `CAL_OAUTH_CLIENT_ID` | If `oauth`/`hosted` | — | OAuth client ID |
| `CAL_OAUTH_CLIENT_SECRET` | If `oauth`/`hosted` | — | OAuth client secret |
| `CAL_OAUTH_ACCESS_TOKEN` | No | — | Seed access token (oauth mode only) |
| `CAL_OAUTH_REFRESH_TOKEN` | No | — | Seed refresh token (oauth mode only) |
| `CAL_TOKEN_ENCRYPTION_KEY` | If `hosted` mode | — | 64 hex chars (32 bytes) for AES-256-GCM token encryption |
| `DATABASE_PATH` | No | `mcp-server.db` | SQLite database file path (hosted mode) |
| `PORT` | No | `3100` | HTTP server port for OAuth endpoints (hosted mode) |
| `OAUTH_CALLBACK_URL` | No | `http://localhost:3100` | Public base URL for OAuth callback (hosted mode) |
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
      "args": ["<path-to-repo>/apps/mcp-server/dist/index.js"],
      "env": {
        "CAL_AUTH_MODE": "apikey",
        "CAL_API_KEY": "cal_live_xxxx"
      }
    }
  }
}
```

### Cursor / Other MCP Clients

Point your MCP client to the built entry point at `apps/mcp-server/dist/index.js` with the required environment variables.

## Auth Modes

### API Key (default)

Set `CAL_AUTH_MODE=apikey` and provide `CAL_API_KEY`. Every request sends:
- `Authorization: Bearer <CAL_API_KEY>`
- `cal-api-version: 2024-08-13`

This is the simplest mode for server-to-server usage.

### OAuth (single-account, stdio mode)

Set `CAL_AUTH_MODE=oauth` and provide `CAL_OAUTH_CLIENT_ID` and `CAL_OAUTH_CLIENT_SECRET`. Optionally seed tokens with `CAL_OAUTH_ACCESS_TOKEN` and `CAL_OAUTH_REFRESH_TOKEN`.

- Access tokens are valid ~60 minutes; refresh tokens ~1 year
- Tokens are auto-refreshed when expired
- On 401 responses, the client retries once after refreshing
- Refreshed tokens are persisted to `.cal-oauth-tokens.json` so restarts don't lose tokens

### Hosted (multi-tenant OAuth)

Set `CAL_AUTH_MODE=hosted` for multi-tenant deployments where multiple customers connect their own Cal.com accounts.

**Setup:**

1. Generate an encryption key: `openssl rand -hex 32` (produces 64 hex chars)
2. Configure environment variables:
   ```bash
   CAL_AUTH_MODE=hosted
   CAL_OAUTH_CLIENT_ID=your-client-id
   CAL_OAUTH_CLIENT_SECRET=your-client-secret
   CAL_TOKEN_ENCRYPTION_KEY=<64-hex-chars>
   DATABASE_PATH=mcp-server.db
   PORT=3100
   OAUTH_CALLBACK_URL=https://your-host.com
   ```
3. Start the server — it will run both the MCP stdio transport and an HTTP server for OAuth endpoints.

**OAuth flow:**

1. Redirect a tenant to `GET /oauth/start?tenantId=xxx` → redirects to Cal.com with PKCE challenge
2. Cal.com redirects back to `GET /oauth/callback?code=xxx&state=xxx` → exchanges code for tokens, stores encrypted in SQLite
3. Returns `{ connectionId, tenantId }` — use `connectionId` to execute MCP tools against that tenant's Cal.com account

**HTTP endpoints:**

| Endpoint | Method | Description |
|---|---|---|
| `/oauth/start?tenantId=xxx` | GET | Start OAuth flow for a tenant |
| `/oauth/callback` | GET | OAuth callback (Cal.com redirects here) |
| `/oauth/connections?tenantId=xxx` | GET | List connections for a tenant (no tokens exposed) |
| `/oauth/connections/:id` | DELETE | Disconnect and delete a connection |
| `/health` | GET | Health check |

**Security:**

- Tokens are encrypted at rest using AES-256-GCM with a random IV per encryption
- State parameters expire after 10 minutes and are single-use (CSRF protection)
- PKCE (S256) prevents authorization code interception
- Token values are never logged or exposed in API responses

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
