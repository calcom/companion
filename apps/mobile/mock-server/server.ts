/**
 * Runs the mock Cal.com backend.
 *
 *   bun run mock:server [--port 4010] [--host 127.0.0.1] [--consent] [--now 2026-11-27T15:00:00Z]
 *                       [--time-zone America/New_York] [--access-token-ttl 1800]
 *
 * Point the app at it with EXPO_PUBLIC_CAL_APP_URL / EXPO_PUBLIC_CAL_API_URL (see README.md).
 */
import { createServer, type IncomingMessage } from "node:http";
import { createHandler } from "./handlers.ts";
import { MOCK_CLIENT_ID, MOCK_REDIRECT_URIS } from "./seed.ts";
import { MockStore } from "./store.ts";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : "true";
}

const port = Number(flag("port") ?? process.env.MOCK_CAL_PORT ?? 4010);
const host = flag("host") ?? process.env.MOCK_CAL_HOST ?? "127.0.0.1";
const origin = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
const now = flag("now");
const ttl = flag("access-token-ttl");

const store = new MockStore({
  appUrl: process.env.MOCK_CAL_PUBLIC_URL ?? origin,
  timeZone: flag("time-zone"),
  now: now ? new Date(now) : undefined,
  accessTokenTtlSeconds: ttl ? Number(ttl) : undefined,
});
const handle = createHandler(store, {
  requireConsent: flag("consent") === "true",
  log: (line) => console.log(line),
});

async function toRequest(incoming: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(key, item);
    else if (value !== undefined) headers.set(key, value);
  }
  const method = incoming.method ?? "GET";
  return new Request(new URL(incoming.url ?? "/", origin), {
    method,
    headers,
    body:
      method === "GET" || method === "HEAD" || chunks.length === 0
        ? undefined
        : Buffer.concat(chunks),
  });
}

const server = createServer(async (incoming, outgoing) => {
  const started = Date.now();
  const response = await handle(await toRequest(incoming));
  const body = Buffer.from(await response.arrayBuffer());
  outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  outgoing.end(body);
  console.log(
    `${incoming.method} ${incoming.url} -> ${response.status} (${Date.now() - started}ms)`
  );
});

server.listen(port, host, () => {
  console.log(`Mock Cal.com backend on ${origin}
  Seeded host: ${String(store.data.me.name)} <${String(store.data.me.email)}>, time zone ${store.data.meta.timeZone}
  ${store.data.bookings.length} bookings, ${store.data.eventTypes.length} links, ${store.data.schedules.length} schedules, ${store.data.calEvents.length} Cal Events

Put these in apps/mobile/.env.local, then rebuild or restart Metro:
  EXPO_PUBLIC_CAL_APP_URL=${origin}
  EXPO_PUBLIC_CAL_API_URL=${origin}
  EXPO_PUBLIC_CALCOM_OAUTH_CLIENT_ID=${MOCK_CLIENT_ID}
  EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI=${MOCK_REDIRECT_URIS[0]}

Mock endpoints: GET /__mock/state, POST /__mock/reset, POST /__mock/expire-tokens, GET /__mock/seed`);
});
