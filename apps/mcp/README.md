# @calcom/mcp

Cal.com MCP (Model Context Protocol) Server — exposes Cal.com API v2 endpoints as tools for AI assistants.

Generated from the Cal.com API v2 OpenAPI spec using [openapi-mcp-generator](https://www.npmjs.com/package/openapi-mcp-generator) with `stdio` transport.

## Setup

```bash
cd apps/mcp
npm install
npm run build
```

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```env
API_BASE_URL=https://api.cal.com
CAL_API_KEY=cal_your_api_key_here
```

- **API_BASE_URL**: Cal.com API v2 base URL (default: `https://api.cal.com`)
- **CAL_API_KEY**: Your Cal.com API key (get one from https://app.cal.com/settings/developer/api-keys)

## Usage

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "calcom": {
      "command": "node",
      "args": ["/path/to/companion/apps/mcp/build/index.js"],
      "env": {
        "CAL_API_KEY": "cal_your_api_key_here"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "calcom": {
      "command": "node",
      "args": ["/path/to/companion/apps/mcp/build/index.js"],
      "env": {
        "CAL_API_KEY": "cal_your_api_key_here"
      }
    }
  }
}
```

### VS Code

Add to your VS Code settings (`.vscode/mcp.json`):

```json
{
  "servers": {
    "calcom": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/companion/apps/mcp/build/index.js"],
      "env": {
        "CAL_API_KEY": "cal_your_api_key_here"
      }
    }
  }
}
```

## What's Included

- **260 tools** covering all non-deprecated Cal.com API v2 endpoints
- Bookings, Event Types, Schedules, Slots, Calendars, Webhooks, Teams, Organizations, and more
- Auth via `CAL_API_KEY` environment variable (auto-injected into all API requests)
- Configurable API base URL

## What's Excluded

18 deprecated platform-related endpoints across these tags:
- `Deprecated: Platform / Managed Users`
- `Deprecated: Platform / Webhooks`
- `Deprecated: Platform OAuth Clients`

## Testing

```bash
npm test
```

## Transport

Uses `stdio` transport (stdin/stdout), matching the pattern used by Stripe, GitHub, and Shopify MCP servers. Compatible with Claude Desktop, Cursor, VS Code, and Claude Code.
