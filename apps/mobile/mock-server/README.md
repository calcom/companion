# Mock Cal.com backend

A local stand-in for Cal.com production: the web app's OAuth endpoints and every API v2
route the mobile app calls, served from seeded data. Use it to run the app signed in with no
Cal.com account, for screenshots and UI work, and offline.

It is not a Cal.com server. It answers in production's shapes and follows production's rules
where the app depends on them, and the tests hold it to the API v2 contract. Anything else
(availability slots, emails, payments, Cal Video calls) isn't simulated.

## Run it

```sh
bun run mobile:mock             # from the repo root; or `bun run mock:server` in apps/mobile
```

It prints the settings to point the app at it. Put them in `apps/mobile/.env.local` (git
ignores it), then restart Metro with `--clear` or rebuild:

```sh
EXPO_PUBLIC_CAL_APP_URL=http://127.0.0.1:4010
EXPO_PUBLIC_CAL_API_URL=http://127.0.0.1:4010
EXPO_PUBLIC_CALCOM_OAUTH_CLIENT_ID=mock-companion-client
EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI=expo-wxt-app://oauth/callback
```

Remove those lines to go back to production. `EXPO_PUBLIC_CAL_APP_URL` and
`EXPO_PUBLIC_CAL_API_URL` replace both regions' hosts (see `utils/region.ts`), so never set
them for a release build.

Then tap **Continue with Cal.com**. The mock approves at once and you're signed in as the
seeded host, Avery Chen.

| Flag | Default | What it does |
|---|---|---|
| `--port` | `4010` | Port (`MOCK_CAL_PORT`). |
| `--host` | `127.0.0.1` | Interface. Use `0.0.0.0` for a phone or the Android emulator. |
| `--consent` | off | Show an Allow/Deny page instead of approving at once. |
| `--now` | current time | Build the data around another moment, e.g. for stable screenshots. |
| `--time-zone` | `America/New_York` | The host's time zone. |
| `--access-token-ttl` | `1800` | Seconds an access token lasts. Set it low to exercise refresh. |

**Android emulator:** run with `--host 0.0.0.0` and `MOCK_CAL_PUBLIC_URL=http://10.0.2.2:4010`,
and use `http://10.0.2.2:4010` for both app settings. **Physical device:** use your computer's
LAN address the same way.

## What's seeded

All people and emails are fictional, and every time is relative to now.

- **Host:** Avery Chen (`avery`), New York time, 12-hour clock, default schedule "Working hours".
- **Bookings (42):** in every tab. One meeting is happening now and more are later today and
  over the next two weeks. There are 3 waiting for confirmation, a weekly series of 6, 10 past
  meetings (including attendee and host no-shows), cancelled and declined bookings, a
  rescheduled pair, and a seated Office Hours slot. Two past meetings have Cal Video
  recordings, transcripts and session data.
- **Links (9):** free, paid ($120), requires confirmation, recurring, seated, in person, phone,
  multiple durations, and one hidden link with private links.
- **Schedules (3):** working hours with a lunch break and two date overrides, evenings, and
  London weekend workshops.
- **Teams (2)**, **conferencing apps (3)**, **user and link webhooks**.
- **Cal Events (5):** a meetup that requires approval (confirmed, pending, waitlisted and
  declined guests, two locations, speakers, agenda, sent messages, co-hosts), a paid workshop,
  a draft, a past event with check-ins, and a cancelled one. Ticket QR codes check in with
  `ticket:<registrationId>`, e.g. `ticket:evt-design-meetup-reg-00`.

Changes you make in the app (cancel, confirm, edit a link, check in a guest) last until the
server restarts or you reset it.

## How it follows production

- **OAuth** (`/auth/oauth2/authorize`, `/api/auth/oauth/token`, `/api/auth/oauth/refreshToken`)
  works like `apps/web/app/api/auth/oauth/*` in calcom/cal:
  - Authorization code with PKCE, S256 only. A code works once and lasts 10 minutes.
  - Access tokens last 30 minutes. Refresh tokens last 30 days and rotate: once used, the old
    one stops working.
  - Errors use the same `{ error, error_description }` bodies.
  - An unknown client or redirect URI is shown on a page, never redirected to.
- **API v2:**
  - Responses use `{ status: "success", data }`. Errors use the `HttpExceptionFilter` body
    (`{ status: "error", timestamp, path, error: { code, message, details } }`).
  - A missing or expired token gets a 401.
- **Bookings** go into tabs with production's rules (`booking-listing-tabs.ts`). For example, a
  recurring booking shows in Upcoming only once accepted, and a meeting in progress stays in
  Upcoming until it ends. Pages default to `take=100` (max 250), and the
  `PaginationMetaDto` fields are filled in.

Routes the mock doesn't implement answer 404 and are listed in `GET /__mock/state` under
`unhandled`, so gaps show up quickly.

## Mock-only endpoints

| Endpoint | What it does |
|---|---|
| `GET /__mock/state` | Counts, OAuth clients, and requests to unimplemented routes. |
| `GET /__mock/seed` | The whole current data set. |
| `POST /__mock/reset[?now=ISO]` | Rebuild the seed (around now, or the given time). Tokens stay valid. |
| `POST /__mock/expire-tokens` | Expire every access token, to test the app's refresh path. |

## Tests

`mock-server.test.js` (part of `bun run mobile:test`) runs the OAuth flow, including the
failure cases. It also checks the responses of 30+ endpoints against
`docs/api-reference/v2/openapi.json`, and runs the app's own `CalComAPIService` against the
mock, including a token refresh. `contract.ts` lists the few places where the generated spec
contradicts calcom/cal's source types and how each is handled.

## Files

| File | Role |
|---|---|
| `seed.ts` | The data set (`createSeed`). |
| `store.ts` | In-memory state: data, codes, tokens. |
| `handlers.ts` | The `(Request) => Response` handler: OAuth, API v2 routes, mock endpoints. |
| `server.ts` | The HTTP server (`node:http`, so it also runs under Bun or Node). |
| `contract.ts` | Checks a response against the OpenAPI spec. |
| `time.ts` | Wall-clock times in a time zone, for the seed. |
