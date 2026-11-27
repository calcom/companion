import { readFileSync } from "node:fs";
import path from "node:path";

import { createContractCheck } from "./contract";
import { createHandler, tabsForBooking } from "./handlers";
import { MOCK_CLIENT_ID, MOCK_REDIRECT_URIS } from "./seed";
import { MockStore } from "./store";

const BASE = "http://mock.test";
const REDIRECT_URI = MOCK_REDIRECT_URIS[0];
const START = Date.parse("2026-11-25T15:00:00.000Z");

const spec = JSON.parse(
  readFileSync(path.join(__dirname, "../../../docs/api-reference/v2/openapi.json"), "utf8")
);
const contract = createContractCheck(spec);

function setup(options = {}) {
  let now = START;
  const store = new MockStore({
    now: new Date(START),
    appUrl: BASE,
    clock: () => now,
    ...options,
  });
  const handle = createHandler(store);
  const call = async (method, pathname, { token, body, form, headers = {} } = {}) => {
    const init = { method, headers: { ...headers } };
    if (token) init.headers.Authorization = `Bearer ${token}`;
    if (form) {
      init.headers["Content-Type"] = "application/x-www-form-urlencoded";
      init.body = new URLSearchParams(form).toString();
    } else if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const response = await handle(new Request(`${BASE}${pathname}`, init));
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, headers: response.headers, json, text };
  };
  const advance = (ms) => {
    now += ms;
  };
  return { store, handle, call, advance };
}

async function pkcePair() {
  const verifier = "mock-verifier-0123456789-abcdefghijklmnopqrstuvwxyz-ABCDEFG";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = Buffer.from(digest).toString("base64url");
  return { verifier, challenge };
}

async function authorize(call, challenge, overrides = {}) {
  const params = new URLSearchParams({
    client_id: MOCK_CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    state: "state-123",
    code_challenge: challenge,
    code_challenge_method: "S256",
    register: "false",
    ...overrides,
  });
  return call("GET", `/auth/oauth2/authorize?${params}`);
}

async function signIn(call) {
  const { verifier, challenge } = await pkcePair();
  const authorized = await authorize(call, challenge);
  const code = new URL(authorized.headers.get("location")).searchParams.get("code");
  const token = await call("POST", "/api/auth/oauth/token", {
    form: {
      grant_type: "authorization_code",
      client_id: MOCK_CLIENT_ID,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    },
  });
  return token.json;
}

describe("mock Cal.com OAuth", () => {
  it("runs the authorization code + PKCE flow the app uses", async () => {
    const { call } = setup();
    const { verifier, challenge } = await pkcePair();

    const authorized = await authorize(call, challenge);
    expect(authorized.status).toBe(302);
    const callback = new URL(authorized.headers.get("location"));
    expect(`${callback.protocol}//${callback.host}${callback.pathname}`).toBe(REDIRECT_URI);
    expect(callback.searchParams.get("state")).toBe("state-123");
    const code = callback.searchParams.get("code");
    expect(code).toBeTruthy();

    const token = await call("POST", "/api/auth/oauth/token", {
      form: {
        grant_type: "authorization_code",
        client_id: MOCK_CLIENT_ID,
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      },
    });
    expect(token.status).toBe(200);
    expect(token.json).toEqual({
      access_token: expect.stringMatching(/^mock_at_/),
      token_type: "bearer",
      refresh_token: expect.stringMatching(/^mock_rt_/),
      expires_in: 1800,
      scope: "",
    });
    expect(token.headers.get("cache-control")).toBe("no-store");

    const me = await call("GET", "/v2/me", { token: token.json.access_token });
    expect(me.status).toBe(200);
    expect(me.json.data.email).toBe("avery.chen@example.com");

    // A code works once.
    const replay = await call("POST", "/api/auth/oauth/token", {
      form: {
        grant_type: "authorization_code",
        client_id: MOCK_CLIENT_ID,
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      },
    });
    expect(replay.status).toBe(400);
    expect(replay.json).toEqual({
      error: "invalid_grant",
      error_description: "code_invalid_or_expired",
    });
  });

  it("refuses a wrong code verifier, client or redirect URI like production", async () => {
    const { call } = setup();
    const { challenge } = await pkcePair();

    const authorized = await authorize(call, challenge);
    const code = new URL(authorized.headers.get("location")).searchParams.get("code");
    const wrongVerifier = await call("POST", "/api/auth/oauth/token", {
      form: {
        grant_type: "authorization_code",
        client_id: MOCK_CLIENT_ID,
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: "not-the-verifier",
      },
    });
    expect(wrongVerifier.status).toBe(400);
    expect(wrongVerifier.json.error).toBe("invalid_grant");

    expect((await authorize(call, challenge, { client_id: "nope" })).status).toBe(400);
    expect(
      (await authorize(call, challenge, { redirect_uri: "https://evil.example.com/cb" })).status
    ).toBe(400);

    const plainPkce = await authorize(call, challenge, { code_challenge_method: "plain" });
    expect(new URL(plainPkce.headers.get("location")).searchParams.get("error_description")).toBe(
      "invalid_code_challenge_method"
    );

    const missingFields = await call("POST", "/api/auth/oauth/token", {
      form: { grant_type: "authorization_code" },
    });
    expect(missingFields.json).toEqual({ error: "invalid_request" });
  });

  it("expires access tokens after 30 minutes and rotates refresh tokens", async () => {
    const { call, advance } = setup();
    const tokens = await signIn(call);

    advance(31 * 60 * 1000);
    const expired = await call("GET", "/v2/me", { token: tokens.access_token });
    expect(expired.status).toBe(401);
    expect(expired.json).toMatchObject({
      status: "error",
      error: { code: "UnauthorizedException" },
    });

    const refreshed = await call("POST", "/api/auth/oauth/refreshToken", {
      form: {
        grant_type: "refresh_token",
        client_id: MOCK_CLIENT_ID,
        refresh_token: tokens.refresh_token,
      },
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.json.refresh_token).not.toBe(tokens.refresh_token);
    expect((await call("GET", "/v2/me", { token: refreshed.json.access_token })).status).toBe(200);

    const reused = await call("POST", "/api/auth/oauth/refreshToken", {
      form: {
        grant_type: "refresh_token",
        client_id: MOCK_CLIENT_ID,
        refresh_token: tokens.refresh_token,
      },
    });
    expect(reused.status).toBe(400);
    expect(reused.json.error).toBe("invalid_grant");
  });

  it("asks for consent first when started with --consent", async () => {
    const store = new MockStore({ now: new Date(START), appUrl: BASE });
    const handle = createHandler(store, { requireConsent: true });
    const { challenge } = await pkcePair();
    const params = new URLSearchParams({
      client_id: MOCK_CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      state: "s",
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    const consent = await handle(new Request(`${BASE}/auth/oauth2/authorize?${params}`));
    expect(consent.status).toBe(200);
    expect(await consent.text()).toContain("Allow");
    const denied = await handle(
      new Request(`${BASE}/auth/oauth2/authorize?${params}&decision=deny`)
    );
    expect(new URL(denied.headers.get("location")).searchParams.get("error")).toBe("access_denied");
  });
});

describe("mock Cal.com API v2", () => {
  it("answers 401 without a token, in API v2's error envelope", async () => {
    const { call } = setup();
    const response = await call("GET", "/v2/bookings");
    expect(response.status).toBe(401);
    expect(response.json).toEqual({
      status: "error",
      timestamp: expect.any(String),
      path: "/v2/bookings",
      error: expect.objectContaining({ code: "UnauthorizedException" }),
    });
  });

  it("returns production-shaped responses for every endpoint in the API v2 contract", async () => {
    const { call, store } = setup();
    const { access_token: token } = await signIn(call);
    const pastBooking = store.data.bookings.find((b) => store.data.recordings[b.uid]);
    const pending = store.data.bookings.find((b) => b.status === "pending");
    const upcoming = store.data.bookings.find(
      (b) => b.status === "accepted" && !b.recurringBookingUid && Date.parse(b.start) > START
    );

    const requests = [
      ["GET", "/v2/me"],
      ["PATCH", "/v2/me", { bio: "Updated bio" }],
      ["GET", "/v2/teams"],
      ["GET", "/v2/conferencing"],
      ["GET", "/v2/bookings?status=upcoming&limit=50"],
      ["GET", "/v2/bookings?status=recurring"],
      ["GET", "/v2/bookings?status=past"],
      ["GET", "/v2/bookings?status=cancelled"],
      ["GET", "/v2/bookings?status=unconfirmed"],
      ["GET", `/v2/bookings/${upcoming.uid}`],
      ["GET", `/v2/bookings/${pastBooking.uid}/recordings`],
      ["GET", `/v2/bookings/${pastBooking.uid}/transcripts`],
      ["GET", `/v2/bookings/${pastBooking.uid}/conferencing-sessions`],
      [
        "POST",
        `/v2/bookings/${pastBooking.uid}/mark-absent`,
        { attendees: [{ email: pastBooking.attendees[0].email, absent: true }] },
      ],
      [
        "POST",
        `/v2/bookings/${upcoming.uid}/guests`,
        { guests: [{ email: "new.guest@example.com", name: "New Guest" }] },
      ],
      [
        "PATCH",
        `/v2/bookings/${upcoming.uid}/location`,
        { location: { type: "address", address: "1 Main St" } },
      ],
      ["POST", `/v2/bookings/${pending.uid}/confirm`],
      [
        "POST",
        `/v2/bookings/${upcoming.uid}/reschedule`,
        { start: new Date(START + 9 * 86400000).toISOString(), reschedulingReason: "Moved" },
      ],
      ["GET", "/v2/event-types?sortCreatedAt=desc"],
      ["GET", "/v2/event-types/5001"],
      ["POST", "/v2/event-types", { title: "New Link", slug: "new-link", lengthInMinutes: 25 }],
      ["PATCH", "/v2/event-types/5001", { title: "15 Min Hello", hidden: true }],
      ["GET", "/v2/event-types/5009/private-links"],
      ["POST", "/v2/event-types/5009/private-links", { maxUsageCount: 3 }],
      ["GET", "/v2/event-types/5004/webhooks"],
      [
        "POST",
        "/v2/event-types/5004/webhooks",
        { subscriberUrl: "https://hooks.example.com/x", triggers: ["BOOKING_CREATED"] },
      ],
      ["GET", "/v2/schedules"],
      ["GET", "/v2/schedules/2001"],
      [
        "POST",
        "/v2/schedules",
        {
          name: "Mornings",
          timeZone: "America/New_York",
          isDefault: false,
          availability: [{ days: ["Monday"], startTime: "07:00", endTime: "10:00" }],
        },
      ],
      ["PATCH", "/v2/schedules/2002", { name: "Evenings" }],
      ["DELETE", "/v2/schedules/2003"],
      ["GET", "/v2/webhooks"],
      [
        "POST",
        "/v2/webhooks",
        {
          subscriberUrl: "https://hooks.example.com/y",
          triggers: ["BOOKING_CANCELLED"],
          active: true,
        },
      ],
      ["DELETE", "/v2/event-types/5008"],
    ];

    const failures = [];
    let checked = 0;
    for (const [method, url, body] of requests) {
      const response = await call(method, url, { token, body });
      if (response.status >= 400) {
        failures.push(`${method} ${url} -> ${response.status} ${response.text.slice(0, 200)}`);
        continue;
      }
      const errors = contract.validate(
        new URL(`${BASE}${url}`).pathname,
        method,
        response.status,
        response.json
      );
      if (errors === null) continue;
      checked += 1;
      if (errors.length) failures.push(`${method} ${url}:\n  ${errors.slice(0, 6).join("\n  ")}`);
    }
    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThanOrEqual(30);
  });

  it("files bookings into production's tabs and pages them like production", async () => {
    const { call, store } = setup();
    const { access_token: token } = await signIn(call);
    const tabs = ["upcoming", "recurring", "past", "cancelled", "unconfirmed"];
    for (const tab of tabs) {
      const response = await call("GET", `/v2/bookings?status=${tab}`, { token });
      expect(response.json.data.length).toBeGreaterThan(0);
      for (const booking of response.json.data) {
        expect(tabsForBooking(booking, START)).toContain(tab);
      }
    }
    // A recurring series in "upcoming" shows only accepted occurrences; pending ones only in "unconfirmed".
    const unconfirmed = await call("GET", "/v2/bookings?status=unconfirmed", { token });
    expect(unconfirmed.json.data.every((b) => b.status === "pending")).toBe(true);

    const page = await call("GET", "/v2/bookings?take=5&skip=5&sortStart=asc", { token });
    expect(page.json.data).toHaveLength(5);
    expect(page.json.pagination).toMatchObject({
      returnedItems: 5,
      itemsPerPage: 5,
      currentPage: 2,
      totalItems: store.data.bookings.length,
      hasPreviousPage: true,
    });
    expect((await call("GET", "/v2/bookings?take=251", { token })).status).toBe(400);
    expect((await call("GET", "/v2/bookings?status=everything", { token })).status).toBe(400);
  });

  it("changes state on mutations and refuses impossible ones", async () => {
    const { call, store } = setup();
    const { access_token: token } = await signIn(call);
    const pending = store.data.bookings.find((b) => b.status === "pending");

    const declined = await call("POST", `/v2/bookings/${pending.uid}/decline`, {
      token,
      body: { reason: "Busy" },
    });
    expect(declined.json.data.status).toBe("rejected");
    expect((await call("POST", `/v2/bookings/${pending.uid}/confirm`, { token })).status).toBe(400);

    const upcoming = (await call("GET", "/v2/bookings?status=upcoming", { token })).json.data[0];
    const cancelled = await call("POST", `/v2/bookings/${upcoming.uid}/cancel`, {
      token,
      body: { cancellationReason: "Can't make it" },
    });
    expect(cancelled.json.data).toMatchObject({
      status: "cancelled",
      cancellationReason: "Can't make it",
    });
    expect(
      (await call("POST", `/v2/bookings/${upcoming.uid}/cancel`, { token, body: {} })).status
    ).toBe(400);
    const cancelledTab = (await call("GET", "/v2/bookings?status=cancelled", { token })).json.data;
    expect(cancelledTab.map((b) => b.uid)).toContain(upcoming.uid);

    expect((await call("GET", "/v2/bookings/does-not-exist", { token })).json.error.code).toBe(
      "NotFoundException"
    );
    expect((await call("DELETE", "/v2/schedules/2001", { token })).status).toBe(400);
  });

  it("serves Cal Events in the shapes the app reads", async () => {
    const { call } = setup();
    const { access_token: token } = await signIn(call);

    const upcoming = await call("GET", "/v2/events?status=upcoming&limit=25", {
      token,
      headers: { "cal-api-version": "2026-05-01" },
    });
    expect(upcoming.json.data.map((e) => e.uuid)).toEqual(
      expect.arrayContaining(["evt-design-meetup", "evt-paid-workshop", "evt-cancelled-picnic"])
    );
    expect(upcoming.json.pagination).toEqual({ nextCursor: null, hasMore: false });
    expect(
      (await call("GET", "/v2/events?status=draft", { token })).json.data.map((e) => e.uuid)
    ).toEqual(["evt-draft-retreat"]);

    const firstPage = await call(
      "GET",
      "/v2/events/evt-design-meetup/bookings?limit=5&status=CONFIRMED,PENDING_APPROVAL",
      { token }
    );
    expect(firstPage.json.data).toHaveLength(5);
    expect(firstPage.json.pagination.hasMore).toBe(true);
    const secondPage = await call(
      "GET",
      `/v2/events/evt-design-meetup/bookings?limit=5&status=CONFIRMED,PENDING_APPROVAL&cursor=${firstPage.json.pagination.nextCursor}`,
      { token }
    );
    expect(secondPage.json.data).toHaveLength(5);

    const counts = await call("GET", "/v2/events/evt-design-meetup/registrations/counts", {
      token,
    });
    expect(counts.json.data).toMatchObject({
      confirmed: 7,
      pendingApproval: 3,
      waitlisted: 1,
      declined: 1,
    });

    const approved = await call(
      "POST",
      "/v2/events/evt-design-meetup/registrations/evt-design-meetup-reg-07/approve",
      { token }
    );
    expect(approved.json.data.kind).toBe("approved");

    const checkIn = await call("POST", "/v2/events/evt-design-meetup/check-ins", {
      token,
      body: { checkInToken: "ticket:evt-design-meetup-reg-00" },
    });
    expect(checkIn.json.data.kind).toBe("checked_in");
    const again = await call(
      "POST",
      "/v2/events/evt-design-meetup/registrations/evt-design-meetup-reg-00/check-in",
      { token }
    );
    expect(again.json.data.kind).toBe("already_checked_in");

    const created = await call("POST", "/v2/events", {
      token,
      body: {
        title: "Lunch & Learn",
        startTime: new Date(START + 3 * 86400000).toISOString(),
        endTime: new Date(START + 3 * 86400000 + 3600000).toISOString(),
        timeZone: "America/New_York",
        visibility: "PUBLIC",
        requiresApproval: false,
      },
    });
    expect(created.status).toBe(201);
    expect(created.json.data.publishedAt).toBeNull();
    expect(
      (await call("POST", `/v2/events/${created.json.data.uuid}/publish`, { token })).status
    ).toBe(400);
  });

  it("records requests to routes it doesn't implement", async () => {
    const { call, store } = setup();
    const { access_token: token } = await signIn(call);
    const response = await call("GET", "/v2/organizations/1/teams", { token });
    expect(response.status).toBe(404);
    expect(store.unhandled).toEqual([
      expect.objectContaining({ method: "GET", path: "/v2/organizations/1/teams" }),
    ]);
  });
});

describe("the app's API client against the mock", () => {
  let mock;

  beforeAll(async () => {
    mock = setup();
    const tokens = await signIn(mock.call);
    jest.resetModules();
    jest.doMock("@/utils/region", () => ({
      ...jest.requireActual("@/utils/region"),
      getCalApiUrl: () => BASE,
      getCalAppUrl: () => BASE,
    }));
    global.fetch = (input, init) => mock.handle(new Request(input, init));
    const { CalComAPIService } = require("@/services/calcom");
    CalComAPIService.setAccessToken(tokens.access_token, tokens.refresh_token);
    mock.api = CalComAPIService;
  });

  afterAll(() => {
    delete global.fetch;
    jest.dontMock("@/utils/region");
  });

  it("loads every tab's data", async () => {
    const { api } = mock;
    const profile = await api.getUserProfile();
    expect(profile.username).toBe("avery");

    const upcoming = await api.getBookings({ status: ["upcoming"], limit: 50 });
    expect(upcoming.length).toBeGreaterThan(10);
    const unconfirmed = await api.getBookings({ status: ["unconfirmed"], limit: 50 });
    expect(unconfirmed.every((b) => b.status === "pending")).toBe(true);
    const between = await api.getBookingsBetween({
      afterStart: new Date(START - 7 * 86400000).toISOString(),
      beforeEnd: new Date(START + 14 * 86400000).toISOString(),
    });
    expect(between.length).toBeGreaterThan(upcoming.length / 2);

    const eventTypes = await api.getEventTypes();
    expect(eventTypes[0].id).toBe(5009); // sortCreatedAt=desc
    expect((await api.getSchedules()).length).toBe(3);
    expect((await api.getTeams()).length).toBe(2);

    const events = await api.getCalEvents(null, "upcoming");
    expect(events.events.find((e) => e.uuid === "evt-cancelled-picnic").status).toBe("cancelled");
    const roster = await api.getCalEventRoster("evt-design-meetup");
    expect(roster).toHaveLength(12);
  });

  it("refreshes an expired token through the app's own refresh path", async () => {
    const { api, store, call } = mock;
    api.setRefreshTokenFunction(async (refreshToken) => {
      const refreshed = await call("POST", "/api/auth/oauth/refreshToken", {
        form: {
          grant_type: "refresh_token",
          client_id: MOCK_CLIENT_ID,
          refresh_token: refreshToken,
        },
      });
      return {
        accessToken: refreshed.json.access_token,
        refreshToken: refreshed.json.refresh_token,
        expiresAt: Date.now() + refreshed.json.expires_in * 1000,
      };
    });
    const persisted = [];
    api.setTokenRefreshCallback(async (accessToken) => {
      persisted.push(accessToken);
    });
    store.expireAccessTokens();
    const schedules = await api.getSchedules();
    expect(persisted).toEqual([expect.stringMatching(/^mock_at_/)]);
    expect(schedules.length).toBe(3);
  });
});
