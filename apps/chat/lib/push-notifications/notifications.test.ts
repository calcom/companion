import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { POST } from "../../app/api/notifications/deliver/route";
import { register } from "../../instrumentation";
import { disableChatSubscription, enableChatSubscription } from "../calcom/chat-subscriptions";
import { getRedisClient } from "../redis";
import { linkUser, unlinkUser } from "../user-linking";
import { type DeliveryRequest, deliverySchema } from "./contract";
import { deliverSlackNotification } from "./deliver-slack";
import { deliverTelegramNotification } from "./deliver-telegram";
import { formatNotification, safeUrl } from "./formatter";
import { handleNotifyCommand } from "./notify-command";
import { deliverNotifications } from "./service";
import { verifyDeliverySignature } from "./signature";
import {
  activateBinding,
  beginBinding,
  claimDelivery,
  finishDelivery,
  getBinding,
  isCurrentBinding,
} from "./store";

const now = Date.now();
const sub = {
  identifier: "U123",
  teamId: "T123",
  subscriptionId: 7,
  calcomUserId: 42,
  linkedAt: new Date(now).toISOString(),
};
const linked = {
  calcomUserId: 42,
  linkedAt: new Date(now - 10000).toISOString(),
  accessToken: "fixture-token",
  refreshToken: "fixture-refresh",
  tokenExpiresAt: now + 10000,
  calcomEmail: "host@example.test",
  calcomUsername: "host",
  calcomTimeZone: "UTC",
  calcomOrganizationId: null,
  calcomOrgIsPlatform: null,
};
const binding = {
  calcomUserId: 42,
  oauthLinkedAt: linked.linkedAt,
  enabledAfter: now - 1000,
  active: true,
  pending: false,
  generation: "fixture",
};
const request: DeliveryRequest = {
  contractVersion: 2,
  platform: "SLACK",
  idempotencyKey: "fixture-operation",
  occurredAt: new Date(now).toISOString(),
  subscriptions: [sub],
  payload: {
    title: "Seat: Payment Received",
    body: "Payment received for a seat.",
    notificationType: "PAYMENT_RECEIVED",
    bookingTitle: "Fixture meeting",
    hosts: [{ name: "Host", email: "host@example.test" }],
    attendees: [{ name: "Paying attendee", email: "attendee@example.test" }],
    attendeeCount: 1,
    seatEvent: true,
    start: "2026-09-11T10:00:00Z",
    end: "2026-09-11T10:30:00Z",
    timeZone: "Asia/Kolkata",
    timeFormat: 24,
    payment: { amount: 1500, currency: "usd" },
    data: { url: "https://example.test/booking/fixture" },
  },
};

function signatureHeaders(
  body: string,
  secret: string,
  timestamp = String(Math.floor(Date.now() / 1000))
) {
  return new Headers({
    "x-cal-timestamp": timestamp,
    "x-cal-signature": createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex"),
  });
}

test("signature binds raw bytes and timestamp; shared-secret-only requests cannot send", () => {
  const raw = JSON.stringify(request);
  const headers = signatureHeaders(raw, "fixture-secret");
  assert.equal(verifyDeliverySignature(raw, headers, "fixture-secret"), true);
  assert.equal(verifyDeliverySignature(`${raw} `, headers, "fixture-secret"), false);
  assert.equal(verifyDeliverySignature(raw, headers, "wrong-secret"), false);
  assert.equal(
    verifyDeliverySignature(raw, signatureHeaders(raw, "fixture-secret", "1"), "fixture-secret"),
    false
  );
  assert.equal(
    verifyDeliverySignature(
      raw,
      new Headers({ "x-cal-delivery-secret": "fixture-secret" }),
      "fixture-secret"
    ),
    false
  );
});

test("contract accepts seven events and rejects legacy, duplicate and group destinations", () => {
  for (const event of [
    "BOOKING_REQUESTED",
    "BOOKING_CONFIRMED",
    "BOOKING_RESCHEDULED",
    "BOOKING_CANCELLED",
    "BOOKING_REJECTED",
    "BOOKING_LOCATION_CHANGED",
    "PAYMENT_RECEIVED",
  ]) {
    assert.equal(
      deliverySchema.safeParse({
        ...request,
        payload: { ...request.payload, notificationType: event },
      }).success,
      true
    );
  }
  for (const invalid of [
    { ...request, contractVersion: 1 },
    { ...request, subscriptions: [sub, sub] },
    { ...request, subscriptions: [{ ...sub, teamId: undefined }] },
    {
      ...request,
      platform: "TELEGRAM",
      subscriptions: [{ ...sub, identifier: "-123", teamId: undefined }],
    },
    { ...request, payload: { ...request.payload, notificationType: "PAYMENT_REMINDER" } },
    { ...request, payload: { ...request.payload, timeZone: "invalid" } },
  ])
    assert.equal(deliverySchema.safeParse(invalid).success, false);
});

test("formatting retains seat, payment, timezone, cancellation and hidden-attendee semantics", () => {
  const message = formatNotification(request.payload);
  assert.match(message.text, /Seat: Payment Received/);
  assert.match(message.text, /15:30/);
  assert.match(message.text, /\$15\.00/);
  assert.match(message.text, /Attendee: Paying attendee/);
  assert.equal(message.bookingUrl, request.payload.data?.url);
  const hidden = formatNotification({
    ...request.payload,
    attendees: [],
    attendeeCount: undefined,
    cancellationReason: "Fixture reason",
  });
  assert.doesNotMatch(hidden.text, /Attendee:/);
  assert.match(hidden.text, /Reason: Fixture reason/);
  assert.match(
    formatNotification({ ...request.payload, payment: { amount: 1500, currency: "jpy" } }).text,
    /1,500/
  );
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl("https://user:password@example.test"), undefined);
  assert.equal(
    formatNotification({ ...request.payload, body: "x".repeat(4000) }).text.length,
    2900
  );
});

test("binding rejects old generations, another account, disconnected OAuth and disabled chats", () => {
  assert.equal(isCurrentBinding(binding, linked, sub), true);
  for (const candidate of [
    null,
    { ...binding, active: false },
    { ...binding, calcomUserId: 43 },
    { ...binding, enabledAfter: now + 1 },
  ]) {
    assert.equal(isCurrentBinding(candidate, linked, sub), false);
  }
  assert.equal(
    isCurrentBinding(binding, { ...linked, linkedAt: new Date(now).toISOString() }, sub),
    false
  );
  assert.equal(isCurrentBinding(binding, null, sub), false);
});

test("provider sends plain text once and separates definitive rejection from ambiguous failures", async () => {
  for (const platform of ["SLACK", "TELEGRAM"] as const) {
    const send = platform === "SLACK" ? deliverSlackNotification : deliverTelegramNotification;
    let calls = 0;
    const successFetch: typeof fetch = async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      if (platform === "SLACK") {
        assert.equal(body.mrkdwn, false);
        assert.equal(body.blocks[0].text.type, "plain_text");
      } else {
        assert.equal(body.parse_mode, undefined);
        assert.equal(body.link_preview_options.is_disabled, true);
      }
      return Response.json({ ok: true });
    };
    assert.equal(
      (await send("fixture", "123", formatNotification(request.payload), successFetch)).outcome,
      "delivered"
    );
    assert.equal(calls, 1);
    for (const [response, expected] of [
      [new Response("", { status: 429 }), "retryable"],
      [new Response("unknown", { status: 502 }), "unknown"],
      [Response.json({ ok: false, error: "channel_not_found", error_code: 403 }), "invalid"],
    ] as const) {
      assert.equal(
        (await send("fixture", "123", { text: "Fixture" }, async () => response)).outcome,
        expected
      );
    }
    assert.equal(
      (
        await send("fixture", "123", { text: "Fixture" }, async () => {
          throw new Error("Lost response");
        })
      ).outcome,
      "unknown"
    );
  }
});

function serviceDeps() {
  let sends = 0;
  const deps = {
    getLinkedUser: async () => linked,
    getBinding: async () => binding,
    claimDelivery: async () => ({
      key: "fixture",
      pending: "fixture",
      fingerprint: "fixture",
      outcome: "claimed" as const,
    }),
    finishDelivery: async () => {},
    prepareTransport: async () => async () => {
      sends++;
      return { outcome: "delivered" as const };
    },
  };
  return { deps, sends: () => sends };
}

test("worker echoes Slack workspace, skips stale events and rechecks binding before send", async () => {
  const { deps, sends } = serviceDeps();
  assert.deepEqual(await deliverNotifications(request, deps), [
    {
      identifier: "U123",
      teamId: "T123",
      outcome: "delivered",
      success: true,
      invalidIdentifier: false,
    },
  ]);
  assert.equal(sends(), 1);
  assert.equal(
    (await deliverNotifications({ ...request, occurredAt: "2000-01-01T00:00:00Z" }, deps))[0]
      .outcome,
    "unknown"
  );
  assert.equal(sends(), 1);
  let reads = 0;
  const changed = await deliverNotifications(request, {
    ...deps,
    getBinding: async () => ({ ...binding, active: ++reads === 1 }),
  });
  assert.equal(changed[0].outcome, "invalid");
  assert.equal(sends(), 1);
});

test("pending linking retries without deleting subscription; unknown and finish errors do not resend", async () => {
  const { deps, sends } = serviceDeps();
  assert.equal(
    (
      await deliverNotifications(request, {
        ...deps,
        getBinding: async () => ({ ...binding, active: false, pending: true }),
      })
    )[0].outcome,
    "retryable"
  );
  assert.equal(
    (
      await deliverNotifications(request, {
        ...deps,
        claimDelivery: async () => ({
          key: "fixture",
          pending: "fixture",
          fingerprint: "fixture",
          outcome: "unknown",
        }),
      })
    )[0].outcome,
    "unknown"
  );
  assert.equal(sends(), 0);
  assert.equal(
    (
      await deliverNotifications(request, {
        ...deps,
        finishDelivery: async () => {
          throw new Error("Redis unavailable");
        },
      })
    )[0].outcome,
    "unknown"
  );
  assert.equal(sends(), 1);
});

test("notify commands use verified linking, leave preferences alone, reject groups and fail closed on relink", async () => {
  const calls: string[] = [];
  const deps = {
    getValidAccessToken: async () => "fixture",
    getLinkedUser: async () => linked,
    beginBinding: async () => {
      calls.push("pending");
      return { key: "fixture", pending: "fixture", binding };
    },
    activateBinding: async () => {
      calls.push("active");
      return true;
    },
    enableChatSubscription: async () => {
      calls.push("enable");
    },
    disableChatSubscription: async () => {
      calls.push("disable");
    },
  };
  const input = {
    platform: "SLACK" as const,
    identifier: "U123",
    teamId: "T123",
    argument: "on",
    privateChat: true,
  };
  assert.match(await handleNotifyCommand(input, deps), /existing event preferences/);
  assert.deepEqual(calls, ["pending", "enable", "active"]);
  calls.length = 0;
  assert.match(await handleNotifyCommand({ ...input, argument: "off" }, deps), /off for this chat/);
  assert.deepEqual(calls, ["pending", "disable"]);
  calls.length = 0;
  assert.match(
    await handleNotifyCommand(
      { ...input, argument: "off" },
      {
        ...deps,
        getValidAccessToken: async () => null,
      }
    ),
    /off for this chat/
  );
  assert.deepEqual(calls, ["pending"]);
  calls.length = 0;
  assert.match(
    await handleNotifyCommand({ ...input, platform: "TELEGRAM", privateChat: false }, deps),
    /private chat/
  );
  assert.deepEqual(calls, []);
  assert.match(
    await handleNotifyCommand(input, { ...deps, activateBinding: async () => false }),
    /connection changed/
  );
});

test("HTTP boundary rejects unsigned, malformed and oversized requests before delivery", async () => {
  process.env.CALCOM_DELIVERY_SECRET = "fixture-secret";
  process.env.REDIS_URL ??= "redis://127.0.0.1:6397";
  const raw = JSON.stringify(request);
  assert.equal(
    (await POST(new Request("https://example.test", { method: "POST", body: raw }))).status,
    401
  );
  const invalid = JSON.stringify({ ...request, contractVersion: 1 });
  assert.equal(
    (
      await POST(
        new Request("https://example.test", {
          method: "POST",
          body: invalid,
          headers: signatureHeaders(invalid, "fixture-secret"),
        })
      )
    ).status,
    400
  );
  assert.equal(
    (
      await POST(
        new Request("https://example.test", { method: "POST", body: "x".repeat(129 * 1024) })
      )
    ).status,
    413
  );
});

test("signed delivery responses include the version and destination outcomes expected by Cal", async () => {
  process.env.CALCOM_DELIVERY_SECRET = "fixture-secret";
  process.env.REDIS_URL ??= "redis://127.0.0.1:6397";
  const raw = JSON.stringify({ ...request, occurredAt: "2000-01-01T00:00:00Z" });
  const response = await POST(
    new Request("https://example.test/api/notifications/deliver", {
      method: "POST",
      body: raw,
      headers: signatureHeaders(raw, "fixture-secret"),
    })
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    contractVersion: 2,
    results: [
      {
        identifier: sub.identifier,
        teamId: sub.teamId,
        outcome: "unknown",
        success: false,
        invalidIdentifier: false,
      },
    ],
  });
});

test("formatting failures return 422 without exposing the error or sending", async () => {
  process.env.CALCOM_DELIVERY_SECRET = "fixture-secret";
  process.env.REDIS_URL ??= "redis://127.0.0.1:6397";
  const descriptor = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, "format");
  assert.ok(descriptor);
  const originalFetch = globalThis.fetch;
  let sends = 0;
  globalThis.fetch = async () => {
    sends++;
    return Response.json({ ok: true });
  };
  Object.defineProperty(Intl.DateTimeFormat.prototype, "format", {
    configurable: true,
    get() {
      throw new RangeError("Synthetic sensitive formatting details");
    },
  });
  try {
    const raw = JSON.stringify(request);
    const response = await POST(
      new Request("https://example.test/api/notifications/deliver", {
        method: "POST",
        body: raw,
        headers: signatureHeaders(raw, "fixture-secret"),
      })
    );
    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), { error: "Notification formatting failed" });
    assert.equal(sends, 0);
  } finally {
    Object.defineProperty(Intl.DateTimeFormat.prototype, "format", descriptor);
    globalThis.fetch = originalFetch;
  }
});

test("startup rejects missing delivery secrets in production and warns in development", async () => {
  const keys = ["NODE_ENV", "NEXT_RUNTIME", "CALCOM_DELIVERY_SECRET"] as const;
  const original = keys.map((key) => process.env[key]);
  const originalWarn = console.warn;
  const warnings: unknown[] = [];
  console.warn = (message) => warnings.push(message);
  try {
    Object.assign(process.env, { NEXT_RUNTIME: "nodejs", NODE_ENV: "production" });
    for (const secret of [undefined, "", "   "]) {
      if (secret === undefined) delete process.env.CALCOM_DELIVERY_SECRET;
      else process.env.CALCOM_DELIVERY_SECRET = secret;
      await assert.rejects(register(), /CALCOM_DELIVERY_SECRET is required/);
    }
    Object.assign(process.env, { NODE_ENV: "development" });
    await register();
    assert.deepEqual(warnings, [
      "CALCOM_DELIVERY_SECRET is required for booking notification delivery. Delivery is disabled until it is configured.",
    ]);
    Object.assign(process.env, {
      NODE_ENV: "production",
      CALCOM_DELIVERY_SECRET: "fixture-secret",
    });
    await register();
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
    keys.forEach((key, index) => {
      const value = original[index];
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else Object.assign(process.env, { [key]: value });
    });
  }
});

test("Cal.com linking signs the current canonical contract and off tolerates an absent subscription", async () => {
  const originalFetch = globalThis.fetch;
  process.env.CALCOM_CHAT_LINK_SECRET = "fixture-link-secret";
  const calls: string[] = [];
  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    if (path.endsWith("link-intents")) {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer fixture-oauth");
      assert.deepEqual(JSON.parse(String(init?.body)), {});
      return Response.json({ status: "success", data: { token: "fixture-intent" } });
    }
    if (init?.method === "DELETE") return new Response("", { status: 404 });
    const body = JSON.parse(String(init?.body));
    const headers = new Headers(init?.headers);
    const expected = createHmac("sha256", "fixture-link-secret")
      .update(
        JSON.stringify({
          timestamp: headers.get("x-cal-chat-link-timestamp"),
          platform: "SLACK",
          token: "fixture-intent",
          identifier: "U123",
          workspaceId: "T123",
        })
      )
      .digest("hex");
    assert.equal(headers.get("x-cal-chat-link-signature"), expected);
    assert.deepEqual(body, {
      platform: "SLACK",
      token: "fixture-intent",
      identifier: "U123",
      workspaceId: "T123",
    });
    return Response.json({ status: "success" });
  };
  try {
    await enableChatSubscription("fixture-oauth", "SLACK", "U123", "T123");
    await disableChatSubscription("fixture-oauth", "SLACK", "U123", "T123");
    assert.deepEqual(calls, [
      "/v2/notifications/subscriptions/slack/link-intents",
      "/v2/internal/notifications/subscriptions/verified-links",
      "/v2/notifications/subscriptions/slack",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const redisIntegration = Boolean(process.env.NOTIFICATION_TEST_REDIS_URL);
test(
  "Redis atomically claims concurrent deliveries, retains unknown outcomes, and fences linking",
  { skip: !redisIntegration },
  async () => {
    process.env.REDIS_URL = process.env.NOTIFICATION_TEST_REDIS_URL;
    const unique = { ...request, idempotencyKey: randomUUID() };
    const claims = await Promise.all(Array.from({ length: 20 }, () => claimDelivery(unique, sub)));
    assert.equal(claims.filter((c) => c.outcome === "claimed").length, 1);
    assert.equal(claims.filter((c) => c.outcome === "unknown").length, 19);
    const owner = claims.find((c) => c.outcome === "claimed");
    assert.ok(owner);
    await finishDelivery(owner, "retryable", 60);
    assert.equal((await claimDelivery(unique, sub)).outcome, "retryable");
    await finishDelivery(owner, "delivered"); // an old owner cannot overwrite the stored retryable result
    assert.equal((await claimDelivery(unique, sub)).outcome, "retryable");
    const client = getRedisClient();
    assert.ok((await client.ttl(owner.key)) > 7 * 86400);
    const retryKey = { ...request, idempotencyKey: randomUUID() };
    const retryOwner = await claimDelivery(retryKey, sub);
    await finishDelivery(retryOwner, "retryable");
    const retried = await claimDelivery(retryKey, sub);
    assert.equal(retried.outcome, "claimed");
    await finishDelivery(retried, "delivered");
    assert.equal((await claimDelivery(retryKey, sub)).outcome, "delivered");
    assert.equal(
      (await claimDelivery({ ...retryKey, payload: { ...retryKey.payload, body: "Changed" } }, sub))
        .outcome,
      "unknown"
    );
    const identity = {
      identifier: `U${randomUUID().replaceAll("-", "").toUpperCase()}`,
      teamId: "T123",
    };
    const first = await beginBinding("SLACK", identity, binding);
    const second = await beginBinding("SLACK", identity, binding);
    assert.equal(await activateBinding(first), false);
    assert.equal(await activateBinding(second), true);
    assert.equal((await getBinding("SLACK", identity))?.generation, second.binding.generation);
    await client.del([owner.key, retried.key, second.key]);
  }
);

test(
  "signed HTTP deliveries use real Redis and send once across duplicate requests and lost responses",
  { skip: !redisIntegration },
  async () => {
    process.env.REDIS_URL = process.env.NOTIFICATION_TEST_REDIS_URL;
    process.env.SLACK_ENCRYPTION_KEY = "fixture-encryption-key";
    process.env.TELEGRAM_BOT_TOKEN = "fixture-bot-token";
    process.env.CALCOM_DELIVERY_SECRET = "fixture-secret";
    const identifier = "123456789";
    const recipient = { ...sub, identifier, teamId: undefined };
    await linkUser("telegram", identifier, linked);
    const attempt = await beginBinding("TELEGRAM", recipient, binding);
    await activateBinding(attempt);
    const delivery = {
      ...request,
      platform: "TELEGRAM" as const,
      subscriptions: [recipient],
      idempotencyKey: randomUUID(),
    };
    const originalFetch = globalThis.fetch;
    let sends = 0;
    const post = (body: DeliveryRequest) => {
      const raw = JSON.stringify(body);
      return POST(
        new Request("https://example.test/api/notifications/deliver", {
          method: "POST",
          body: raw,
          headers: signatureHeaders(raw, "fixture-secret"),
        })
      );
    };
    globalThis.fetch = async (url) => {
      assert.match(String(url), /\/sendMessage$/);
      sends++;
      return Response.json({ ok: true });
    };
    try {
      const responses = await Promise.all(Array.from({ length: 10 }, () => post(delivery)));
      assert.equal(
        responses.every((response) => response.status === 200),
        true
      );
      assert.equal(sends, 1);
      assert.equal((await (await post(delivery)).json()).results[0].outcome, "delivered");
      assert.equal(sends, 1);
      const lost = { ...delivery, idempotencyKey: randomUUID() };
      globalThis.fetch = async () => {
        sends++;
        throw new Error("Lost response after send");
      };
      assert.equal((await (await post(lost)).json()).results[0].outcome, "unknown");
      assert.equal((await (await post(lost)).json()).results[0].outcome, "unknown");
      assert.equal(sends, 2);
      await linkUser("telegram", identifier, {
        ...linked,
        calcomUserId: 43,
        linkedAt: new Date().toISOString(),
      });
      assert.equal(
        (await (await post({ ...delivery, idempotencyKey: randomUUID() })).json()).results[0]
          .outcome,
        "invalid"
      );
      assert.equal(sends, 2);
      const client = getRedisClient();
      const deliveredClaim = await claimDelivery(delivery, recipient);
      const lostClaim = await claimDelivery(lost, recipient);
      await client.del([deliveredClaim.key, lostClaim.key]);
    } finally {
      globalThis.fetch = originalFetch;
      await unlinkUser("telegram", identifier);
      const disconnected = await getBinding("TELEGRAM", recipient);
      assert.equal(disconnected?.active, false);
      assert.equal(disconnected?.calcomUserId, 0);
      await getRedisClient().del(attempt.key);
    }
  }
);

after(async () => {
  if (redisIntegration) await getRedisClient().quit();
});
