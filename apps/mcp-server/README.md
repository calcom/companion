# @calcom/mcp-server

A **Model Context Protocol (MCP)** server that wraps the [Cal.com Platform API v2](https://cal.com/docs/api-reference/v2). Connect it to Claude Desktop, Cursor, or any MCP-compatible client to manage bookings, event types, schedules, and more through natural language.

## Features

- **34 tools** covering Bookings, Event Types, Schedules, Availability, Calendars, Conferencing, Routing Forms, Organizations, and User Profile
- **API key authentication** — simple Bearer token auth
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

| Variable | Required | Default | Description |
|---|---|---|---|
| `CAL_API_KEY` | Yes | — | Your Cal.com API key |
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
        "CAL_API_KEY": "cal_live_xxxx"
      }
    }
  }
}
```

### Cursor / Other MCP Clients

Point your MCP client to the built entry point at `apps/mcp-server/dist/index.js` with the required environment variables.

## Authentication

The server uses **API key** authentication. Every request to Cal.com includes:
- `Authorization: Bearer <CAL_API_KEY>`
- `cal-api-version: 2024-08-13`

## Tools (34)

### User Profile (2)
| Tool | Description |
|---|---|
| `get_me` | Get authenticated user profile |
| `update_me` | Update user profile |

### Event Types (5)
| Tool | Description |
|---|---|
| `get_event_types` | List all event types |
| `get_event_type` | Get a specific event type by ID |
| `create_event_type` | Create a new event type |
| `update_event_type` | Update an event type |
| `delete_event_type` | Delete an event type |

### Bookings (10)
| Tool | Description |
|---|---|
| `get_bookings` | List bookings with optional filters |
| `get_booking` | Get a specific booking by UID |
| `create_booking` | Create a new booking |
| `reschedule_booking` | Reschedule a booking |
| `cancel_booking` | Cancel a booking |
| `confirm_booking` | Confirm a pending booking |
| `mark_booking_absent` | Mark a booking absence |
| `get_booking_attendees` | Get all attendees for a booking |
| `add_booking_attendee` | Add an attendee to a booking |
| `get_booking_attendee` | Get a specific attendee for a booking |

### Schedules (6)
| Tool | Description |
|---|---|
| `get_schedules` | List all schedules |
| `get_schedule` | Get a specific schedule by ID |
| `create_schedule` | Create a new schedule |
| `update_schedule` | Update a schedule |
| `delete_schedule` | Delete a schedule |
| `get_default_schedule` | Get default schedule |

### Availability / Slots (2)
| Tool | Description |
|---|---|
| `get_availability` | Get available time slots (`GET /v2/slots`). Uses `cal-api-version: 2024-09-04`. |
| `get_busy_times` | Get busy times from calendars |

### Conferencing (1)
| Tool | Description |
|---|---|
| `get_conferencing_apps` | List conferencing applications |

### Routing Forms (1)
| Tool | Description |
|---|---|
| `calculate_routing_form_slots` | Calculate slots based on routing form response |

### Organizations: Memberships (4)
| Tool | Description |
|---|---|
| `get_org_memberships` | Get all organization memberships |
| `create_org_membership` | Create an organization membership |
| `get_org_membership` | Get an organization membership |
| `delete_org_membership` | Delete an organization membership |

### Organizations: Routing Forms (2)
| Tool | Description |
|---|---|
| `get_org_routing_forms` | Get organization routing forms |
| `get_org_routing_form_responses` | Get routing form responses |

### API Version Notes

- Default API version: `2024-08-13`
- `/v2/slots` endpoint uses: `2024-09-04` (automatically applied)
