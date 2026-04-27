# @calcom/mcp-server

A **Model Context Protocol (MCP)** server that wraps the [Cal.com Platform API v2](https://cal.com/docs/api-reference/v2). Connect it to Claude Desktop, Cursor, or any MCP-compatible client to manage bookings, event types, schedules, and more through natural language.

## Features

- **35 tools** covering Bookings, Event Types, Schedules, Availability, Calendars, Conferencing, Routing Forms, Organizations, and User Profile (each with MCP tool annotations: `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
- **Dual transport** — stdio for local dev tooling, StreamableHTTP for remote/production
- **Dual auth** — API key for stdio (local dev), OAuth 2.1 Authorization Code + PKCE for HTTP (production)
- **Per-user token storage** — encrypted at rest with AES-256-GCM in SQLite
- **Structured error handling** with clean MCP error responses
- **Zod-validated inputs** for every tool

## Setup

### Prerequisites

- Node.js >= 18
- [Bun](https://bun.sh/) (for workspace install)
- A Cal.com API key ([get one here](https://app.cal.com/settings/developer/api-keys))

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

**Common:**

| Variable | Required | Default | Description |
|---|---|---|---|
| `MCP_TRANSPORT` | No | `stdio` | Transport mode: `stdio` or `http` |
| `CAL_API_BASE_URL` | No | `https://api.cal.com` | Cal.com API base URL |
| `PORT` | No | `3100` | HTTP server port (only when `MCP_TRANSPORT=http`) |

**stdio mode (local dev):**

| Variable | Required | Default | Description |
|---|---|---|---|
| `CAL_API_KEY` | Yes | — | Your Cal.com API key |

**HTTP mode (remote/production with OAuth 2.1):**

| Variable | Required | Default | Description |
|---|---|---|---|
| `CAL_OAUTH_CLIENT_ID` | Yes | — | Cal.com OAuth client ID |
| `CAL_OAUTH_CLIENT_SECRET` | Yes | — | Cal.com OAuth client secret |
| `TOKEN_ENCRYPTION_KEY` | Yes | — | 64-char hex string (32 bytes) for AES-256-GCM token encryption |
| `MCP_SERVER_URL` | Yes | — | Public URL of this server (e.g. `https://mcp.example.com`) |
| `DATABASE_PATH` | No | `mcp-server.db` | SQLite database file path |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window in ms (per IP) |
| `RATE_LIMIT_MAX` | No | `30` | Max OAuth requests per window per IP |
| `OPENAI_APPS_CHALLENGE_TOKEN` | No | — | Token served at `/.well-known/openai-apps-challenge` for OpenAI Apps domain verification. When unset, the endpoint returns 404. |

## Transport Modes

The server supports two transport modes selected via the `MCP_TRANSPORT` environment variable.

### stdio (default) — Local Developer Tooling

Best for: **Claude Desktop, Cursor, VS Code**, and any MCP client that spawns the server as a subprocess.

```bash
# Start via stdio (default)
bun --filter @calcom/mcp-server start

# Or explicitly
MCP_TRANSPORT=stdio node apps/mcp-server/dist/index.js
```

The MCP client communicates over stdin/stdout. No HTTP server is started.

### http — Remote / Production

Best for: **Hosted deployments, shared services, remote MCP clients** that connect over the network.

```bash
# Generate an encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Start HTTP server with OAuth 2.1
MCP_TRANSPORT=http \
  CAL_OAUTH_CLIENT_ID=your_client_id \
  CAL_OAUTH_CLIENT_SECRET=your_client_secret \
  TOKEN_ENCRYPTION_KEY=<64-hex-chars> \
  MCP_SERVER_URL=https://your-host.com \
  PORT=3100 \
  node apps/mcp-server/dist/index.js
```

This starts a StreamableHTTP server with OAuth 2.1 authentication:

**MCP endpoints** (require `Authorization: Bearer <token>`):
- `POST /mcp` — JSON-RPC over Streamable HTTP (creates a new session on first request)
- `GET  /mcp` — SSE stream for server-initiated messages (requires `mcp-session-id` header)
- `DELETE /mcp` — Terminate a session (requires `mcp-session-id` header)

**OAuth 2.1 endpoints:**
- `GET  /.well-known/oauth-authorization-server` — Authorization server metadata (RFC 8414)
- `GET  /.well-known/oauth-protected-resource` — Protected resource metadata (RFC 9728)
- `POST /oauth/register` — Dynamic client registration (RFC 7591)
- `GET  /oauth/authorize` — Start authorization flow (redirects to Cal.com)
- `GET  /oauth/callback` — Cal.com OAuth callback (exchanges code for tokens)
- `POST /oauth/token` — Token exchange (`authorization_code` or `refresh_token` grant)
- `POST /oauth/revoke` — Token revocation (RFC 7009)

**Other:**
- `GET  /health` — Health check (returns `{ "status": "ok", "sessions": <count> }`)
- `GET  /.well-known/openai-apps-challenge` — OpenAI Apps domain verification token (plain text). Returns 404 unless `OPENAI_APPS_CHALLENGE_TOKEN` is set.

Each HTTP session gets its own `McpServer` instance with a unique session ID, so multiple clients can connect concurrently.

## Connecting to MCP Clients

### Claude Desktop (stdio)

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "calcom": {
      "command": "node",
      "args": ["<path-to-repo>/apps/mcp-server/dist/index.js"],
      "env": {
        "CAL_API_KEY": "cal_live_xxxx"
      }
    }
  }
}
```

### Cursor / VS Code (stdio)

Point your MCP client to `apps/mcp-server/dist/index.js` with the required environment variables.

### Remote MCP Clients (http)

Start the server with `MCP_TRANSPORT=http` and point your client to `http://<host>:3100/mcp`.

## Authentication

### stdio mode — API Key

Every request to Cal.com includes:
- `Authorization: Bearer <CAL_API_KEY>`
- `cal-api-version: 2024-08-13`

### HTTP mode — OAuth 2.1 Authorization Code + PKCE

The HTTP server implements a full OAuth 2.1 Authorization Server. MCP clients connect through a standard OAuth flow:

1. **Client registers** → `POST /oauth/register` with `redirect_uris` → receives `client_id`
2. **Client starts auth** → `GET /oauth/authorize` with `client_id`, `redirect_uri`, `code_challenge` (S256), `state`
3. **Server redirects to Cal.com** → user authorizes on Cal.com
4. **Cal.com redirects back** → `GET /oauth/callback` with `code` + `state`
5. **Server exchanges code** → calls Cal.com token endpoint, stores encrypted Cal.com tokens in SQLite
6. **Server redirects to client** → with an authorization `code` + original `state`
7. **Client exchanges code** → `POST /oauth/token` with `code`, `code_verifier`, `redirect_uri` → receives `access_token` + `refresh_token`
8. **Client uses token** → `POST /mcp` with `Authorization: Bearer <access_token>`

The server acts as an intermediary: it issues its own access tokens to MCP clients, and each token maps to encrypted Cal.com credentials stored in SQLite. When Cal.com tokens expire, the server auto-refreshes them transparently.

**Security:**
- All Cal.com tokens are encrypted at rest with AES-256-GCM (via `TOKEN_ENCRYPTION_KEY`)
- PKCE (S256) is required on both legs (client→server and server→Cal.com)
- Auth codes are single-use
- Expired tokens are cleaned up automatically every 5 minutes
- In-process rate limiting on all OAuth endpoints (token bucket per IP, configurable via `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX`)

## Tools (35)

Each tool exposes MCP [tool annotations](https://modelcontextprotocol.io/specification/draft/server/tools#tool-annotations) — a human-readable `title` plus behaviour hints (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) so MCP clients can render them appropriately and apply safety policies.

| Hint preset | `readOnlyHint` | `destructiveHint` | `idempotentHint` | Used for |
|---|---|---|---|---|
| **Read** | `true` | — | — | All `get_*` / list endpoints |
| **Create** | `false` | `false` | `false` | New resources (`create_*`, `add_*`, `calculate_routing_form_slots`) |
| **Update** | `false` | `false` | `true` | Mutations (`update_*`, `reschedule_*`, `confirm_*`, `mark_*`) |
| **Destructive** | `false` | `true` | `true` | `delete_*`, `cancel_booking` |

`openWorldHint` is `true` for every tool — they all call the external Cal.com API.

### User Profile (2)
| Tool | Title | Hint | Description |
|---|---|---|---|
| `get_me` | Get My Profile | Read | Get authenticated user profile |
| `update_me` | Update My Profile | Update | Update user profile |

### Event Types (5)
| Tool | Title | Hint | Description |
|---|---|---|---|
| `get_event_types` | List Event Types | Read | List all event types |
| `get_event_type` | Get Event Type | Read | Get a specific event type by ID |
| `create_event_type` | Create Event Type | Create | Create a new event type |
| `update_event_type` | Update Event Type | Update | Update an event type |
| `delete_event_type` | Delete Event Type | Destructive | Delete an event type |

### Bookings (10)
| Tool | Title | Hint | Description |
|---|---|---|---|
| `get_bookings` | List Bookings | Read | List bookings with optional filters |
| `get_booking` | Get Booking | Read | Get a specific booking by UID |
| `create_booking` | Create Booking | Create | Create a new booking |
| `reschedule_booking` | Reschedule Booking | Update | Reschedule a booking |
| `cancel_booking` | Cancel Booking | Destructive | Cancel a booking |
| `confirm_booking` | Confirm Booking | Update | Confirm a pending booking |
| `mark_booking_absent` | Mark Booking Absent | Update | Mark a booking absence |
| `get_booking_attendees` | List Booking Attendees | Read | Get all attendees for a booking |
| `add_booking_attendee` | Add Booking Attendee | Create | Add an attendee to a booking |
| `get_booking_attendee` | Get Booking Attendee | Read | Get a specific attendee for a booking |

### Schedules (6)
| Tool | Title | Hint | Description |
|---|---|---|---|
| `get_schedules` | List Schedules | Read | List all schedules |
| `get_schedule` | Get Schedule | Read | Get a specific schedule by ID |
| `create_schedule` | Create Schedule | Create | Create a new schedule |
| `update_schedule` | Update Schedule | Update | Update a schedule |
| `delete_schedule` | Delete Schedule | Destructive | Delete a schedule |
| `get_default_schedule` | Get Default Schedule | Read | Get default schedule |

### Availability / Slots (1)
| Tool | Title | Hint | Description |
|---|---|---|---|
| `get_availability` | Get Availability | Read | Get available time slots (`GET /v2/slots`). Uses `cal-api-version: 2024-09-04`. |

### Calendars (2)
| Tool | Title | Hint | Description |
|---|---|---|---|
| `get_connected_calendars` | List Connected Calendars | Read | List calendar integrations connected to the user (returns `credentialId` + `externalId` for `get_busy_times`) |
| `get_busy_times` | Get Busy Times | Read | Get busy/blocked time blocks from a connected calendar |

### Conferencing (1)
| Tool | Title | Hint | Description |
|---|---|---|---|
| `get_conferencing_apps` | List Conferencing Apps | Read | List conferencing applications |

### Routing Forms (1)
| Tool | Title | Hint | Description |
|---|---|---|---|
| `calculate_routing_form_slots` | Calculate Routing Form Slots | Create | Submit a routing form response and get available slots |

### Organizations: Memberships (5)
| Tool | Title | Hint | Description |
|---|---|---|---|
| `get_org_memberships` | List Org Memberships | Read | Get all organization memberships |
| `create_org_membership` | Create Org Membership | Create | Create an organization membership |
| `get_org_membership` | Get Org Membership | Read | Get an organization membership |
| `update_org_membership` | Update Org Membership | Update | Update an organization membership (role, accepted, impersonation) |
| `delete_org_membership` | Delete Org Membership | Destructive | Delete an organization membership |

### Organizations: Routing Forms (2)
| Tool | Title | Hint | Description |
|---|---|---|---|
| `get_org_routing_forms` | List Org Routing Forms | Read | Get organization routing forms |
| `get_org_routing_form_responses` | List Org Routing Form Responses | Read | Get routing form responses |

### API Version Notes

- Default API version: `2024-08-13`
- `/v2/slots` endpoint uses: `2024-09-04` (automatically applied)
