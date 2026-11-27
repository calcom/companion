/**
 * Request handling for the mock Cal.com backend, as plain Fetch API `(Request) => Response`
 * so it runs under Bun, Node and Jest alike.
 *
 * One origin serves both what the app reads from the web app (`EXPO_PUBLIC_CAL_APP_URL`: the
 * OAuth authorize page and token endpoints) and API v2 (`EXPO_PUBLIC_CAL_API_URL` + `/v2`).
 * Behavior follows production:
 * - OAuth: authorization code + PKCE (S256 only), 30-minute access tokens, 30-day refresh tokens
 *   that rotate (the old one stops working), `{ error, error_description }` errors.
 * - API v2: `{ status, data }` envelopes, `{ status: "error", timestamp, path, error }` errors,
 *   401 without a valid token, bookings filtered with production's tab rules.
 */

import type { Json, JsonObject, SeedData } from "./seed.ts";
import { AUTHORIZATION_CODE_TTL_SECONDS, type MockStore } from "./store.ts";
import { addMinutes, iso } from "./time.ts";

type Params = Record<string, string>;

interface Context {
  req: Request;
  url: URL;
  params: Params;
  store: MockStore;
  data: SeedData;
  userId: number;
  body: () => Promise<JsonObject>;
}

type Handler = (ctx: Context) => Response | Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
  /** API v2 routes need a bearer token; app routes don't. */
  auth: boolean;
}

// ----------------------------------------------------------------------------------------------
// Responses
// ----------------------------------------------------------------------------------------------

const JSON_HEADERS = { "Content-Type": "application/json;charset=UTF-8" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function ok(data: unknown, status = 200): Response {
  return json({ status: "success", data }, status);
}

const EXCEPTION_NAMES: Record<number, string> = {
  400: "BadRequestException",
  401: "UnauthorizedException",
  403: "ForbiddenException",
  404: "NotFoundException",
  409: "ConflictException",
  501: "NotImplementedException",
};

/** API v2's error envelope (apps/api/v2 HttpExceptionFilter). */
function apiError(url: URL, status: number, message: string): Response {
  const code = EXCEPTION_NAMES[status] ?? "HttpException";
  return json(
    {
      status: "error",
      timestamp: new Date().toISOString(),
      path: url.pathname + url.search,
      error: {
        code,
        message,
        details: { message, error: code.replace("Exception", ""), statusCode: status },
      },
    },
    status
  );
}

/** The OAuth endpoints' error shape (apps/web/app/api/auth/oauth/*). */
function oauthError(status: number, error: string, description?: string): Response {
  return json(description ? { error, error_description: description } : { error }, status, {
    "Cache-Control": "no-store",
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { Location: location } });
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function notFound(what: string): never {
  throw new HttpError(404, what);
}

function badRequest(message: string): never {
  throw new HttpError(400, message);
}

// ----------------------------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------------------------

async function readBody(req: Request): Promise<JsonObject> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(await req.text()));
  }
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const out: JsonObject = {};
    form.forEach((value, key) => {
      out[key] = typeof value === "string" ? value : `[file ${key}]`;
    });
    return out;
  }
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    badRequest("Request body is not valid JSON.");
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function nowIso(store: MockStore): string {
  return iso(new Date(store.clock()));
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Every value of a query param, splitting comma-separated lists (`status=a,b&status=c`). */
function listParam(url: URL, name: string): string[] {
  return url.searchParams
    .getAll(name)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function numberParam(url: URL, name: string): number | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) badRequest(`${name} must be a number`);
  return value;
}

/** Opaque cursor pagination for Cal Events lists (`{ nextCursor, hasMore }`). */
function cursorPage<T>(items: T[], url: URL, defaultLimit: number, maxLimit: number) {
  const limit = Math.min(numberParam(url, "limit") ?? defaultLimit, maxLimit);
  if (limit < 1) badRequest("limit must not be less than 1");
  const cursor = url.searchParams.get("cursor");
  let offset = 0;
  if (cursor) {
    const decoded = Number(atob(cursor.replace(/-/g, "+").replace(/_/g, "/")).replace("o:", ""));
    if (!Number.isInteger(decoded) || decoded < 0) badRequest("Invalid cursor");
    offset = decoded;
  }
  const page = items.slice(offset, offset + limit);
  const hasMore = offset + limit < items.length;
  return {
    page,
    pagination: { nextCursor: hasMore ? btoa(`o:${offset + limit}`) : null, hasMore },
  };
}

// ----------------------------------------------------------------------------------------------
// Bookings, with production's listing rules
// (packages/infra/adapters/database/repositories/booking-listing/booking-listing-tabs.ts)
// ----------------------------------------------------------------------------------------------

const BOOKING_TABS = ["upcoming", "recurring", "past", "cancelled", "unconfirmed"] as const;
type BookingTab = (typeof BOOKING_TABS)[number];
const TERMINAL = ["cancelled", "rejected"];
const LOOKBEHIND_MS = 24 * 60 * 60 * 1000;
const TAB_ORDER: Record<BookingTab, "asc" | "desc"> = {
  upcoming: "asc",
  recurring: "asc",
  unconfirmed: "asc",
  past: "desc",
  cancelled: "desc",
};

export function tabsForBooking(booking: JsonObject, now: number): BookingTab[] {
  const start = Date.parse(booking.start as string);
  const end = Date.parse(booking.end as string);
  const status = booking.status as string;
  const recurring = Boolean(booking.recurringBookingUid);
  const bounded = start >= now - LOOKBEHIND_MS && end >= now;
  const terminal = TERMINAL.includes(status);
  const tabs: BookingTab[] = [];
  const upcomingStatusMatches = recurring ? status === "accepted" : !terminal;
  if (bounded && upcomingStatusMatches) tabs.push("upcoming");
  if (bounded && recurring && !terminal) tabs.push("recurring");
  if (bounded && status === "pending") tabs.push("unconfirmed");
  if (end <= now && !terminal) tabs.push("past");
  if (terminal) tabs.push("cancelled");
  return tabs;
}

function listBookings(ctx: Context): Response {
  const { url, data, store } = ctx;
  const now = store.clock();
  const statuses = listParam(url, "status");
  for (const status of statuses) {
    if (!BOOKING_TABS.includes(status as BookingTab)) {
      badRequest(
        `each value in status must be one of the following values: ${BOOKING_TABS.join(", ")}`
      );
    }
  }
  const take = numberParam(url, "take") ?? 100;
  const skip = numberParam(url, "skip") ?? 0;
  if (take < 1) badRequest("take must not be less than 1");
  if (take > 250) badRequest("take must not be greater than 250");
  if (skip < 0) badRequest("skip must not be less than 0");

  const attendeeEmail = url.searchParams.get("attendeeEmail")?.toLowerCase();
  const attendeeName = url.searchParams.get("attendeeName")?.toLowerCase();
  const bookingUid = url.searchParams.get("bookingUid");
  const eventTypeIds = [...listParam(url, "eventTypeIds"), ...listParam(url, "eventTypeId")].map(
    Number
  );
  const teamFilter = listParam(url, "teamsIds").length > 0 || url.searchParams.has("teamId");
  const time = (name: string) => {
    const raw = url.searchParams.get(name);
    if (!raw) return undefined;
    const value = Date.parse(raw);
    if (Number.isNaN(value)) badRequest(`${name} must be a valid ISO 8601 date string`);
    return value;
  };
  const afterStart = time("afterStart");
  const beforeEnd = time("beforeEnd");
  const afterCreatedAt = time("afterCreatedAt");
  const beforeCreatedAt = time("beforeCreatedAt");
  const afterUpdatedAt = time("afterUpdatedAt");
  const beforeUpdatedAt = time("beforeUpdatedAt");

  let rows = data.bookings.filter((booking) => {
    if (statuses.length) {
      const tabs = tabsForBooking(booking, now);
      if (!statuses.some((status) => tabs.includes(status as BookingTab))) return false;
    }
    const attendees = booking.attendees as JsonObject[];
    if (attendeeEmail && !attendees.some((a) => String(a.email).toLowerCase() === attendeeEmail))
      return false;
    if (attendeeName && !attendees.some((a) => String(a.name).toLowerCase().includes(attendeeName)))
      return false;
    if (bookingUid && booking.uid !== bookingUid) return false;
    if (eventTypeIds.length && !eventTypeIds.includes(booking.eventTypeId as number)) return false;
    if (teamFilter) return false; // the seeded host's bookings are all personal
    const start = Date.parse(booking.start as string);
    const end = Date.parse(booking.end as string);
    if (afterStart !== undefined && start < afterStart) return false;
    if (beforeEnd !== undefined && end > beforeEnd) return false;
    const createdAt = Date.parse(booking.createdAt as string);
    const updatedAt = Date.parse(booking.updatedAt as string);
    if (afterCreatedAt !== undefined && createdAt < afterCreatedAt) return false;
    if (beforeCreatedAt !== undefined && createdAt > beforeCreatedAt) return false;
    if (afterUpdatedAt !== undefined && updatedAt < afterUpdatedAt) return false;
    if (beforeUpdatedAt !== undefined && updatedAt > beforeUpdatedAt) return false;
    return true;
  });

  const sorts: Array<[string, string]> = [
    ["sortStart", "start"],
    ["sortEnd", "end"],
    ["sortCreated", "createdAt"],
    ["sortUpdatedAt", "updatedAt"],
  ];
  const explicit = sorts.find(([param]) => url.searchParams.get(param));
  const key = explicit ? explicit[1] : "start";
  const order =
    (explicit ? url.searchParams.get(explicit[0]) : null) ??
    (statuses.length ? TAB_ORDER[statuses[0] as BookingTab] : "asc");
  if (order !== "asc" && order !== "desc") badRequest("sort order must be asc or desc");
  rows = [...rows].sort((a, b) => {
    const diff = Date.parse(a[key] as string) - Date.parse(b[key] as string);
    return (order === "asc" ? diff : -diff) || (a.id as number) - (b.id as number);
  });

  const page = rows.slice(skip, skip + take);
  const totalItems = rows.length;
  return json({
    status: "success",
    data: page,
    pagination: {
      totalItems,
      remainingItems: Math.max(0, totalItems - skip - page.length),
      returnedItems: page.length,
      itemsPerPage: take,
      currentPage: Math.floor(skip / take) + 1,
      totalPages: Math.ceil(totalItems / take),
      hasNextPage: skip + page.length < totalItems,
      hasPreviousPage: skip > 0,
    },
  });
}

function findBooking(data: SeedData, uid: string): JsonObject {
  return (
    data.bookings.find((booking) => booking.uid === uid) ??
    notFound(`Booking with uid=${uid} was not found in the database`)
  );
}

function touch(store: MockStore, booking: JsonObject) {
  booking.updatedAt = nowIso(store);
}

function getBooking(ctx: Context): Response {
  const { data, params } = ctx;
  const series = data.bookings.filter((booking) => booking.recurringBookingUid === params.uid);
  // Like production, a recurring series' uid returns every occurrence.
  if (series.length && !data.bookings.some((booking) => booking.uid === params.uid)) {
    return ok(series);
  }
  return ok(findBooking(data, params.uid));
}

async function cancelBooking(ctx: Context): Promise<Response> {
  const { data, params, store } = ctx;
  const body = await ctx.body();
  const reason = typeof body.cancellationReason === "string" ? body.cancellationReason : undefined;
  const series = data.bookings.filter((booking) => booking.recurringBookingUid === params.uid);
  const targets = series.length
    ? series.filter((booking) => Date.parse(booking.start as string) >= store.clock())
    : [findBooking(data, params.uid)];
  if (!series.length && body.cancelSubsequentBookings === true) {
    const first = targets[0];
    if (first.recurringBookingUid) {
      for (const booking of data.bookings) {
        if (
          booking.recurringBookingUid === first.recurringBookingUid &&
          booking !== first &&
          Date.parse(booking.start as string) > Date.parse(first.start as string)
        ) {
          targets.push(booking);
        }
      }
    }
  }
  for (const booking of targets) {
    if (TERMINAL.includes(booking.status as string))
      badRequest("This booking has already been cancelled.");
  }
  for (const booking of targets) {
    booking.status = "cancelled";
    if (reason) booking.cancellationReason = reason;
    booking.cancelledByEmail = data.me.email as string;
    touch(store, booking);
  }
  return ok(series.length ? targets : targets[0]);
}

function confirmBooking(ctx: Context): Response {
  const booking = findBooking(ctx.data, ctx.params.uid);
  if (booking.status !== "pending") badRequest(`Booking with uid=${booking.uid} is not pending.`);
  booking.status = "accepted";
  touch(ctx.store, booking);
  return ok(booking);
}

async function declineBooking(ctx: Context): Promise<Response> {
  const booking = findBooking(ctx.data, ctx.params.uid);
  if (booking.status !== "pending") badRequest(`Booking with uid=${booking.uid} is not pending.`);
  const body = await ctx.body();
  booking.status = "rejected";
  if (typeof body.reason === "string" && body.reason) booking.cancellationReason = body.reason;
  touch(ctx.store, booking);
  return ok(booking);
}

async function rescheduleBooking(ctx: Context): Promise<Response> {
  const { data, params, store } = ctx;
  const original = findBooking(data, params.uid);
  if (TERMINAL.includes(original.status as string))
    badRequest("Can't reschedule a cancelled booking.");
  const body = await ctx.body();
  const start = typeof body.start === "string" ? Date.parse(body.start) : Number.NaN;
  if (Number.isNaN(start)) badRequest("start must be a valid ISO 8601 date string");
  const duration = original.duration as number;
  const uid = store.newToken("rs").slice(0, 22);
  const reason = typeof body.reschedulingReason === "string" ? body.reschedulingReason : undefined;
  const next: JsonObject = {
    ...clone(original),
    id: store.nextId(data.bookings),
    uid,
    start: iso(new Date(start)),
    end: iso(addMinutes(new Date(start), duration)),
    status: "accepted",
    createdAt: nowIso(store),
    updatedAt: nowIso(store),
    rescheduledFromUid: original.uid as string,
    icsUid: `${uid}@Cal.com`,
  };
  delete next.rescheduledToUid;
  delete next.cancellationReason;
  delete next.cancelledByEmail;
  if (reason) next.reschedulingReason = reason;
  if (typeof original.location === "string" && original.location.includes("/video/")) {
    next.location = `${data.meta.appUrl}/video/${uid}`;
    next.meetingUrl = next.location;
  }
  original.status = "cancelled";
  original.rescheduledToUid = uid;
  original.cancellationReason = reason ?? "Rescheduled";
  original.rescheduledByEmail = data.me.email as string;
  touch(store, original);
  data.bookings.push(next);
  return ok(next, 201);
}

async function markAbsent(ctx: Context): Promise<Response> {
  const booking = findBooking(ctx.data, ctx.params.uid);
  const body = await ctx.body();
  if (typeof body.host === "boolean") booking.absentHost = body.host;
  const updates = Array.isArray(body.attendees) ? (body.attendees as JsonObject[]) : [];
  for (const update of updates) {
    const attendee = (booking.attendees as JsonObject[]).find(
      (item) => String(item.email).toLowerCase() === String(update.email).toLowerCase()
    );
    if (!attendee)
      badRequest(`Attendee with email ${String(update.email)} is not part of this booking.`);
    attendee.absent = Boolean(update.absent);
  }
  touch(ctx.store, booking);
  return ok(booking);
}

async function addGuests(ctx: Context): Promise<Response> {
  const booking = findBooking(ctx.data, ctx.params.uid);
  const body = await ctx.body();
  const guests = Array.isArray(body.guests) ? (body.guests as JsonObject[]) : [];
  if (!guests.length) badRequest("guests must contain at least 1 element");
  const attendees = booking.attendees as JsonObject[];
  for (const guest of guests) {
    const email = String(guest.email ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      badRequest(`${email || "(empty)"} is not a valid email`);
    if (attendees.some((item) => String(item.email).toLowerCase() === email.toLowerCase())) {
      badRequest(`${email} is already an attendee of this booking`);
    }
    attendees.push({
      name: typeof guest.name === "string" && guest.name ? guest.name : email.split("@")[0],
      email,
      displayEmail: email,
      timeZone: (attendees[0]?.timeZone as string) ?? "UTC",
      language: "en",
      absent: false,
    });
    (booking.guests as string[]).push(email);
  }
  touch(ctx.store, booking);
  return ok(booking);
}

function locationToString(location: Json | undefined): string {
  if (typeof location === "string") return location;
  if (location && typeof location === "object" && !Array.isArray(location)) {
    const value =
      location.address ?? location.link ?? location.phone ?? location.integration ?? location.type;
    if (typeof value === "string") return value;
  }
  badRequest("location must be provided");
}

async function updateLocation(ctx: Context): Promise<Response> {
  const booking = findBooking(ctx.data, ctx.params.uid);
  const body = await ctx.body();
  const location = locationToString(body.location);
  booking.location = location;
  if (location.startsWith("http")) booking.meetingUrl = location;
  else delete booking.meetingUrl;
  touch(ctx.store, booking);
  return ok(booking);
}

// ----------------------------------------------------------------------------------------------
// Event types, private links, webhooks
// ----------------------------------------------------------------------------------------------

function findEventType(data: SeedData, id: string): JsonObject {
  return (
    data.eventTypes.find((item) => String(item.id) === id) ??
    notFound(`Event type with id=${id} not found`)
  );
}

async function createEventType(ctx: Context): Promise<Response> {
  const { data, store } = ctx;
  const body = await ctx.body();
  if (typeof body.title !== "string" || !body.title.trim()) badRequest("title should not be empty");
  if (typeof body.slug !== "string" || !body.slug.trim()) badRequest("slug should not be empty");
  if (typeof body.lengthInMinutes !== "number" || body.lengthInMinutes < 1) {
    badRequest("lengthInMinutes must be a positive number");
  }
  if (data.eventTypes.some((item) => item.slug === body.slug)) {
    badRequest(
      `User with id=${String(data.me.id)} already has event type with slug=${String(body.slug)}`
    );
  }
  const template = clone(data.eventTypes[0]);
  const created: JsonObject = {
    ...template,
    title: "",
    description: "",
    hidden: false,
    price: 0,
    metadata: {},
    recurrence: null,
    lengthInMinutesOptions: [],
    ...body,
    id: store.nextId(data.eventTypes),
    ownerId: data.me.id as number,
    users: [data.me.username as string],
    bookingUrl: `${data.meta.appUrl}/${String(data.me.username)}/${String(body.slug)}`,
  };
  data.eventTypes.push(created);
  return ok(created, 201);
}

async function updateEventType(ctx: Context): Promise<Response> {
  const { data, params } = ctx;
  const eventType = findEventType(data, params.id);
  const body = await ctx.body();
  if (
    typeof body.slug === "string" &&
    data.eventTypes.some((item) => item !== eventType && item.slug === body.slug)
  ) {
    badRequest(`User with id=${String(data.me.id)} already has event type with slug=${body.slug}`);
  }
  Object.assign(eventType, body, { id: eventType.id, ownerId: eventType.ownerId });
  eventType.bookingUrl = `${data.meta.appUrl}/${String(data.me.username)}/${String(eventType.slug)}`;
  return ok(eventType);
}

function deleteEventType(ctx: Context): Response {
  const { data, params } = ctx;
  const eventType = findEventType(data, params.id);
  data.eventTypes = data.eventTypes.filter((item) => item !== eventType);
  return ok({
    id: eventType.id,
    lengthInMinutes: eventType.lengthInMinutes,
    title: eventType.title,
    slug: eventType.slug,
  });
}

function findPrivateLink(data: SeedData, eventTypeId: string, linkId: string): JsonObject {
  return (
    data.privateLinks.find(
      (link) => String(link.eventTypeId) === eventTypeId && link.linkId === linkId
    ) ?? notFound(`Private link ${linkId} not found`)
  );
}

function refreshPrivateLink(link: JsonObject, now: number) {
  if (typeof link.expiresAt === "string") link.isExpired = Date.parse(link.expiresAt) <= now;
  if (typeof link.maxUsageCount === "number")
    link.isExpired = (link.usageCount as number) >= link.maxUsageCount;
}

async function createPrivateLink(ctx: Context): Promise<Response> {
  const { data, params, store } = ctx;
  const eventType = findEventType(data, params.id);
  const body = await ctx.body();
  const linkId = store.newToken("pl").slice(0, 16);
  const link: JsonObject = {
    linkId,
    eventTypeId: eventType.id as number,
    isExpired: false,
    bookingUrl: `${data.meta.appUrl}/d/${linkId}/${String(eventType.slug)}`,
  };
  if (typeof body.expiresAt === "string") link.expiresAt = iso(new Date(body.expiresAt));
  else {
    link.maxUsageCount = typeof body.maxUsageCount === "number" ? body.maxUsageCount : 1;
    link.usageCount = 0;
  }
  refreshPrivateLink(link, store.clock());
  data.privateLinks.push(link);
  return ok(link, 201);
}

async function updatePrivateLink(ctx: Context): Promise<Response> {
  const link = findPrivateLink(ctx.data, ctx.params.id, ctx.params.linkId);
  const body = await ctx.body();
  if (typeof body.expiresAt === "string") {
    link.expiresAt = iso(new Date(body.expiresAt));
    delete link.maxUsageCount;
    delete link.usageCount;
  }
  if (typeof body.maxUsageCount === "number") {
    link.maxUsageCount = body.maxUsageCount;
    link.usageCount = (link.usageCount as number | undefined) ?? 0;
    delete link.expiresAt;
  }
  refreshPrivateLink(link, ctx.store.clock());
  return ok(link);
}

function deletePrivateLink(ctx: Context): Response {
  const link = findPrivateLink(ctx.data, ctx.params.id, ctx.params.linkId);
  ctx.data.privateLinks = ctx.data.privateLinks.filter((item) => item !== link);
  return ok({ linkId: link.linkId, message: "Private link deleted successfully" });
}

async function webhookInput(ctx: Context, existing?: JsonObject): Promise<JsonObject> {
  const body = await ctx.body();
  const next: JsonObject = existing
    ? { ...existing }
    : { active: true, payloadTemplate: "", triggers: [] };
  if (typeof body.subscriberUrl === "string") {
    if (!/^https?:\/\//.test(body.subscriberUrl)) badRequest("subscriberUrl must be a URL address");
    next.subscriberUrl = body.subscriberUrl;
  } else if (!existing) badRequest("subscriberUrl must be a URL address");
  if (Array.isArray(body.triggers)) next.triggers = body.triggers;
  if (typeof body.active === "boolean") next.active = body.active;
  if (typeof body.payloadTemplate === "string") next.payloadTemplate = body.payloadTemplate;
  if (typeof body.secret === "string") next.secret = body.secret;
  return next;
}

// ----------------------------------------------------------------------------------------------
// Schedules
// ----------------------------------------------------------------------------------------------

function findSchedule(data: SeedData, id: string): JsonObject {
  return (
    data.schedules.find((item) => String(item.id) === id) ??
    notFound(`Schedule with id=${id} not found`)
  );
}

function makeDefaultSchedule(data: SeedData, schedule: JsonObject) {
  for (const item of data.schedules) item.isDefault = item === schedule;
  data.me.defaultScheduleId = schedule.id as number;
}

function validateAvailability(value: Json | undefined) {
  if (value === undefined) return;
  if (!Array.isArray(value)) badRequest("availability must be an array");
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  for (const slot of value as JsonObject[]) {
    if (!Array.isArray(slot.days) || slot.days.some((day) => !days.includes(String(day)))) {
      badRequest(`each value in days must be one of the following values: ${days.join(", ")}`);
    }
    for (const key of ["startTime", "endTime"]) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(slot[key])))
        badRequest(`${key} must be a valid time format HH:MM`);
    }
  }
}

async function createSchedule(ctx: Context): Promise<Response> {
  const { data, store } = ctx;
  const body = await ctx.body();
  if (typeof body.name !== "string" || !body.name.trim()) badRequest("name should not be empty");
  if (typeof body.timeZone !== "string") badRequest("timeZone must be a string");
  validateAvailability(body.availability);
  const schedule: JsonObject = {
    id: store.nextId(data.schedules),
    ownerId: data.me.id as number,
    name: body.name,
    timeZone: body.timeZone,
    isDefault: false,
    availability: (body.availability as Json[] | undefined) ?? [
      {
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        startTime: "09:00",
        endTime: "17:00",
      },
    ],
    overrides: (body.overrides as Json[] | undefined) ?? [],
  };
  data.schedules.push(schedule);
  if (body.isDefault === true) makeDefaultSchedule(data, schedule);
  return ok(schedule, 201);
}

async function updateSchedule(ctx: Context): Promise<Response> {
  const { data, params } = ctx;
  const schedule = findSchedule(data, params.id);
  const body = await ctx.body();
  validateAvailability(body.availability);
  for (const key of ["name", "timeZone", "availability", "overrides"]) {
    if (body[key] !== undefined) schedule[key] = body[key];
  }
  if (body.isDefault === true) makeDefaultSchedule(data, schedule);
  return ok(schedule);
}

function deleteSchedule(ctx: Context): Response {
  const { data, params } = ctx;
  const schedule = findSchedule(data, params.id);
  if (schedule.isDefault)
    badRequest("Cannot delete the default schedule. Make another schedule the default first.");
  data.schedules = data.schedules.filter((item) => item !== schedule);
  return json({ status: "success" });
}

function duplicateSchedule(ctx: Context): Response {
  const { data, params, store } = ctx;
  const schedule = findSchedule(data, params.id);
  const copy: JsonObject = {
    ...clone(schedule),
    id: store.nextId(data.schedules),
    name: `${String(schedule.name)} (copy)`,
    isDefault: false,
  };
  data.schedules.push(copy);
  return ok(copy, 201);
}

// ----------------------------------------------------------------------------------------------
// Cal Events
// ----------------------------------------------------------------------------------------------

function findCalEvent(data: SeedData, uuid: string): JsonObject {
  return data.calEvents.find((event) => event.uuid === uuid) ?? notFound(`Event ${uuid} not found`);
}

function listingStatus(event: JsonObject, now: number): "draft" | "upcoming" | "past" {
  if (!event.publishedAt && !event.cancelledAt) return "draft";
  return Date.parse(event.endTime as string) < now ? "past" : "upcoming";
}

function registrations(data: SeedData, uuid: string): JsonObject[] {
  data.calEventRegistrations[uuid] ??= [];
  return data.calEventRegistrations[uuid];
}

function findRegistration(data: SeedData, uuid: string, registrationId: string): JsonObject {
  return (
    registrations(data, uuid).find((item) => item.registrationId === registrationId) ??
    notFound(`Registration ${registrationId} not found`)
  );
}

/** The API's `CalEventRegistrationApi` view of a roster row. */
function registrationView(row: JsonObject): JsonObject {
  return {
    id: row.registrationId,
    name: row.name,
    email: row.email,
    phoneNumber: row.phoneNumber ?? null,
    status: row.status,
    rsvpResponse: row.rsvpResponse,
    responses: row.responses ?? {},
    locationId: row.locationId ?? null,
    createdAt: row.createdAt,
    checkedInAt: row.checkedInAt ?? null,
    checkedInByUserId: row.checkedInByUserId ?? null,
  };
}

function recountCalEvent(data: SeedData, uuid: string) {
  const event = findCalEvent(data, uuid);
  event.confirmedCount = registrations(data, uuid).filter(
    (item) => item.status === "CONFIRMED"
  ).length;
}

function listCalEvents(ctx: Context, teamId?: number): Response {
  const { data, url, store } = ctx;
  const status = url.searchParams.get("status") ?? "upcoming";
  if (!["draft", "upcoming", "past"].includes(status)) {
    badRequest("status must be one of the following values: draft, upcoming, past");
  }
  if (teamId !== undefined && !data.teams.some((team) => team.id === teamId)) {
    throw new HttpError(403, "You are not a member of this team.");
  }
  const now = store.clock();
  const events = data.calEvents
    .filter((event) => (teamId === undefined ? true : event.teamId === teamId))
    .filter((event) => listingStatus(event, now) === status)
    .sort((a, b) => {
      const diff = Date.parse(a.startTime as string) - Date.parse(b.startTime as string);
      return status === "past" ? -diff : diff;
    });
  const { page, pagination } = cursorPage(events, url, 50, 100);
  return json({ status: "success", data: page, pagination });
}

async function createCalEvent(ctx: Context, teamId: number | null): Promise<Response> {
  const { data, store } = ctx;
  const body = await ctx.body();
  if (typeof body.title !== "string" || !body.title.trim()) badRequest("title should not be empty");
  for (const key of ["startTime", "endTime"]) {
    if (typeof body[key] !== "string" || Number.isNaN(Date.parse(body[key] as string))) {
      badRequest(`${key} must be a valid ISO 8601 date string`);
    }
  }
  if (Date.parse(body.endTime as string) <= Date.parse(body.startTime as string)) {
    badRequest("endTime must be after startTime");
  }
  const template = clone(data.calEvents[0]);
  const uuid = `evt-${store.newToken("n").slice(2, 14)}`;
  const slug = String(body.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const locations = Array.isArray(body.locations)
    ? (body.locations as JsonObject[]).map((location, index) => ({
        id: `loc-${uuid}-${index}`,
        ...location,
      }))
    : [];
  const event: JsonObject = {
    ...template,
    uuid,
    slug: data.calEvents.some((item) => item.slug === slug) ? `${slug}-${uuid.slice(-4)}` : slug,
    title: body.title,
    description: null,
    startTime: iso(new Date(body.startTime as string)),
    endTime: iso(new Date(body.endTime as string)),
    timeZone: (body.timeZone as string) ?? data.me.timeZone,
    visibility: (body.visibility as string) ?? "PUBLIC",
    requiresApproval: Boolean(body.requiresApproval),
    publishedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    locations,
    coverImageUrl: null,
    lineup: null,
    schedule: null,
    registrationFields: [],
    confirmedCount: 0,
    capacity: null,
    price: null,
    currency: null,
    paymentsEnabled: false,
    waitlistEnabled: false,
    userId: teamId ? null : (data.me.id as number),
    teamId,
  };
  delete event.checkInOpensAt;
  delete event.checkInClosesAt;
  data.calEvents.push(event);
  data.calEventRegistrations[uuid] = [];
  return ok(event, 201);
}

async function updateCalEvent(ctx: Context): Promise<Response> {
  const event = findCalEvent(ctx.data, ctx.params.uuid);
  const body = await ctx.body();
  const { uuid: _uuid, publishedAt: _published, cancelledAt: _cancelled, ...changes } = body;
  if (Array.isArray(changes.hosts)) {
    const candidates = [
      {
        userId: ctx.data.me.id,
        name: ctx.data.me.name,
        username: ctx.data.me.username,
        avatarUrl: ctx.data.me.avatarUrl,
      },
      ...ctx.data.hostCandidates,
    ];
    changes.hosts = (changes.hosts as JsonObject[])
      .map(
        (h) =>
          (candidates.find((c) => c.userId === h.userId) as JsonObject | undefined) ??
          badRequest(`User ${String(h.userId)} can't host this event`)
      )
      .map((c) => ({
        userId: c.userId,
        name: c.name,
        username: c.username ?? null,
        avatarUrl: c.avatarUrl,
      }));
  }
  Object.assign(event, changes);
  return ok(event);
}

function publishCalEvent(ctx: Context): Response {
  const event = findCalEvent(ctx.data, ctx.params.uuid);
  if (event.cancelledAt) badRequest("A cancelled event can't be published.");
  if (!(event.locations as Json[]).length) badRequest("Add a location before publishing.");
  event.publishedAt = event.publishedAt ?? nowIso(ctx.store);
  return ok(event);
}

async function cancelCalEvent(ctx: Context): Promise<Response> {
  const event = findCalEvent(ctx.data, ctx.params.uuid);
  if (event.cancelledAt) badRequest("This event has already been cancelled.");
  const body = await ctx.body();
  event.cancelledAt = nowIso(ctx.store);
  event.cancellationReason =
    typeof body.reason === "string" ? body.reason : ((body.cancellationReason as string) ?? null);
  for (const row of registrations(ctx.data, ctx.params.uuid)) {
    if (row.status !== "DECLINED") row.status = "CANCELLED";
  }
  recountCalEvent(ctx.data, ctx.params.uuid);
  return ok(event);
}

function deleteCalEvent(ctx: Context): Response {
  const event = findCalEvent(ctx.data, ctx.params.uuid);
  if (event.publishedAt)
    badRequest("Only draft events can be deleted. Cancel a published event instead.");
  ctx.data.calEvents = ctx.data.calEvents.filter((item) => item !== event);
  delete ctx.data.calEventRegistrations[ctx.params.uuid];
  return json({ status: "success" });
}

async function addCalEventLocation(ctx: Context): Promise<Response> {
  const event = findCalEvent(ctx.data, ctx.params.uuid);
  const body = await ctx.body();
  if (body.type === "address" && typeof body.address !== "string")
    badRequest("address should not be empty");
  if (body.type === "link" && typeof body.link !== "string")
    badRequest("link must be a URL address");
  if (body.type !== "address" && body.type !== "link")
    badRequest("type must be one of the following values: address, link");
  const location: JsonObject = { id: ctx.store.newToken("loc").slice(0, 14), ...body };
  (event.locations as JsonObject[]).push(location);
  return ok(location, 201);
}

function findCalEventLocation(event: JsonObject, locationId: string): JsonObject {
  return (
    (event.locations as JsonObject[]).find((location) => location.id === locationId) ??
    notFound(`Location ${locationId} not found`)
  );
}

async function updateCalEventLocation(ctx: Context): Promise<Response> {
  const event = findCalEvent(ctx.data, ctx.params.uuid);
  const location = findCalEventLocation(event, ctx.params.locationId);
  Object.assign(location, await ctx.body(), { id: location.id });
  return ok(location);
}

function removeCalEventLocation(ctx: Context): Response {
  const event = findCalEvent(ctx.data, ctx.params.uuid);
  const location = findCalEventLocation(event, ctx.params.locationId);
  event.locations = (event.locations as JsonObject[]).filter((item) => item !== location);
  return ok(event.locations);
}

function listCalEventBookings(ctx: Context): Response {
  const { data, params, url } = ctx;
  findCalEvent(data, params.uuid);
  const statuses = listParam(url, "status");
  const search = url.searchParams.get("search")?.toLowerCase();
  const locationId = url.searchParams.get("locationId");
  const rows = registrations(data, params.uuid)
    .filter((row) =>
      statuses.length ? statuses.includes(row.status as string) : row.status === "CONFIRMED"
    )
    .filter((row) =>
      search ? `${String(row.name)} ${String(row.email)}`.toLowerCase().includes(search) : true
    )
    .filter((row) => (locationId ? row.locationId === locationId : true));
  const { page, pagination } = cursorPage(rows, url, 50, 250);
  return json({ status: "success", data: page, pagination });
}

function registrationCounts(ctx: Context): Response {
  const rows = registrations(ctx.data, findCalEvent(ctx.data, ctx.params.uuid).uuid as string);
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  const confirmed = rows.filter((row) => row.status === "CONFIRMED");
  const byLocation = new Map<string | null, number>();
  for (const row of confirmed) {
    const key = (row.locationId as string | null) ?? null;
    byLocation.set(key, (byLocation.get(key) ?? 0) + 1);
  }
  return ok({
    pendingApproval: count("PENDING_APPROVAL"),
    waitlisted: count("WAITLISTED"),
    pendingPayment: count("PENDING_PAYMENT"),
    offerExpired: count("OFFER_EXPIRED"),
    declined: count("DECLINED"),
    cancelled: count("CANCELLED"),
    confirmed: confirmed.length,
    going: confirmed.filter((row) => row.rsvpResponse !== "NO").length,
    checkedIn: confirmed.filter((row) => row.checkedInAt).length,
    rsvpResponses: {
      yes: rows.filter((row) => row.rsvpResponse === "YES").length,
      no: rows.filter((row) => row.rsvpResponse === "NO").length,
      maybe: rows.filter((row) => row.rsvpResponse === "MAYBE").length,
    },
    byLocation: [...byLocation.entries()].map(([id, total]) => ({ locationId: id, count: total })),
  });
}

function decideRegistration(ctx: Context): Response {
  const { data, params, store } = ctx;
  const event = findCalEvent(data, params.uuid);
  const row = findRegistration(data, params.uuid, params.registrationId);
  if (params.decision !== "approve" && params.decision !== "decline") notFound("Unknown decision");
  if (!["PENDING_APPROVAL", "WAITLISTED"].includes(row.status as string)) {
    return ok({ kind: "not_pending" });
  }
  if (params.decision === "decline") {
    row.status = "DECLINED";
    row.rsvpResponse = "NO";
    row.decidedAt = nowIso(store);
    return ok({ kind: "declined" });
  }
  const capacity = event.capacity as number | null;
  if (capacity !== null && (event.confirmedCount as number) >= capacity)
    return ok({ kind: "full" });
  row.status = event.paymentsEnabled ? "PENDING_PAYMENT" : "CONFIRMED";
  row.decidedAt = nowIso(store);
  recountCalEvent(data, params.uuid);
  return ok({ kind: row.status === "CONFIRMED" ? "approved" : "payment_requested" });
}

function approveAll(ctx: Context): Response {
  const { data, params, store } = ctx;
  const event = findCalEvent(data, params.uuid);
  let approvedCount = 0;
  let notSeatedCount = 0;
  for (const row of registrations(data, params.uuid)) {
    if (row.status !== "PENDING_APPROVAL") continue;
    const capacity = event.capacity as number | null;
    if (capacity !== null && (event.confirmedCount as number) >= capacity) {
      notSeatedCount += 1;
      continue;
    }
    row.status = "CONFIRMED";
    row.decidedAt = nowIso(store);
    approvedCount += 1;
    recountCalEvent(data, params.uuid);
  }
  return ok({ kind: "completed", approvedCount, notSeatedCount });
}

function checkIn(data: SeedData, row: JsonObject, store: MockStore): JsonObject {
  if (row.status !== "CONFIRMED") return { kind: "not_confirmed", status: row.status };
  if (row.checkedInAt) {
    return {
      kind: "already_checked_in",
      registration: registrationView(row),
      checkedInAt: row.checkedInAt,
    };
  }
  row.checkedInAt = nowIso(store);
  row.checkedInByUserId = data.me.id as number;
  row.noShow = false;
  return { kind: "checked_in", registration: registrationView(row) };
}

async function checkInByTicket(ctx: Context): Promise<Response> {
  const { data, params, store } = ctx;
  findCalEvent(data, params.uuid);
  const body = await ctx.body();
  const token = String(body.checkInToken ?? "");
  // Seeded tickets encode the registration: "ticket:<registrationId>".
  const registrationId = token.startsWith("ticket:") ? token.slice(7) : token;
  const row = registrations(data, params.uuid).find(
    (item) => item.registrationId === registrationId
  );
  if (!row) badRequest("This ticket isn't valid for this event.");
  return ok(checkIn(data, row, store));
}

function checkInRegistration(ctx: Context): Response {
  const row = findRegistration(ctx.data, ctx.params.uuid, ctx.params.registrationId);
  return ok(checkIn(ctx.data, row, ctx.store));
}

function undoCheckIn(ctx: Context): Response {
  const row = findRegistration(ctx.data, ctx.params.uuid, ctx.params.registrationId);
  if (!row.checkedInAt) return ok({ kind: "not_checked_in" });
  row.checkedInAt = null;
  row.checkedInByUserId = null;
  return ok({ kind: "undone", registration: registrationView(row) });
}

async function inviteGuests(ctx: Context): Promise<Response> {
  const { data, params } = ctx;
  findCalEvent(data, params.uuid);
  const body = await ctx.body();
  const emails = Array.isArray(body.emails)
    ? body.emails.map(String)
    : badRequest("emails must be an array");
  const seen = new Set<string>();
  const registered = new Set(
    registrations(data, params.uuid).map((row) => String(row.email).toLowerCase())
  );
  const outcomes = emails.map((raw) => {
    const email = raw.trim().toLowerCase();
    let reason = "invited";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) reason = "invalid-format";
    else if (seen.has(email)) reason = "duplicate";
    else if (registered.has(email)) reason = "already-registered";
    seen.add(email);
    return { email: raw, reason };
  });
  const countOf = (reason: string) =>
    outcomes.filter((outcome) => outcome.reason === reason).length;
  return ok({
    invitedCount: countOf("invited"),
    skippedAlreadyInvited: 0,
    skippedAlreadyRegistered: countOf("already-registered"),
    skippedOnCooldown: 0,
    skippedInvalid: countOf("invalid-format") + countOf("duplicate"),
    failedCount: 0,
    outcomes,
  });
}

async function sendMessage(ctx: Context): Promise<Response> {
  const { data, params, store } = ctx;
  findCalEvent(data, params.uuid);
  const body = await ctx.body();
  if (typeof body.body !== "string" && typeof body.message !== "string")
    badRequest("body should not be empty");
  const segment = (body.segment as string) ?? "GOING";
  const rows = registrations(data, params.uuid).filter((row) =>
    segment === "PENDING"
      ? row.status === "PENDING_APPROVAL"
      : row.status === "CONFIRMED" && row.rsvpResponse === (segment === "MAYBE" ? "MAYBE" : "YES")
  );
  const id = store.newToken("msg").slice(0, 14);
  data.calEventMessages[params.uuid] ??= [];
  data.calEventMessages[params.uuid].unshift({
    id,
    segment,
    createdAt: nowIso(store),
    sender: { id: data.me.id as number, name: data.me.name as string },
    status: "SENT",
    counts: {
      sentCount: rows.length,
      failedCount: 0,
      skippedPhoneCount: 0,
      skippedUnsubscribedCount: 0,
    },
  });
  return ok(
    {
      id,
      status: "QUEUED",
      recipientCount: rows.length,
      textRecipientCount: 0,
      skippedPhoneCount: 0,
    },
    201
  );
}

async function addCoHost(ctx: Context): Promise<Response> {
  const { data, params, store } = ctx;
  findCalEvent(data, params.uuid);
  const body = await ctx.body();
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) badRequest("email must be an email");
  data.calEventCoHosts[params.uuid] ??= [];
  const list = data.calEventCoHosts[params.uuid];
  if (list.some((item) => item.email === email)) badRequest(`${email} is already a co-host.`);
  const candidate = data.hostCandidates.find((item) => item.email === email);
  const coHost: JsonObject = {
    id: store.newToken("cohost").slice(0, 14),
    email,
    status: "PENDING",
    name: (candidate?.name as string) ?? null,
    avatarUrl: (candidate?.avatarUrl as string) ?? null,
  };
  list.push(coHost);
  return ok(coHost, 201);
}

// ----------------------------------------------------------------------------------------------
// OAuth (the web app's endpoints)
// ----------------------------------------------------------------------------------------------

export interface HandlerOptions {
  /** Show a consent page instead of approving at once (the simulator can't tap "Allow"). */
  requireConsent?: boolean;
  /** Where unmocked assets (app icons, avatars) come from. */
  assetOrigin?: string;
  log?: (line: string) => void;
}

function authorizeError(
  redirectUri: string,
  state: string | null,
  error: string,
  description: string
) {
  const target = new URL(redirectUri);
  target.searchParams.set("error", error);
  target.searchParams.set("error_description", description);
  if (state) target.searchParams.set("state", state);
  return redirect(target.toString());
}

function issueCode(store: MockStore, query: URLSearchParams): Response {
  const redirectUri = query.get("redirect_uri") as string;
  const code = store.newToken("mock_code");
  store.codes.set(code, {
    code,
    clientId: query.get("client_id") as string,
    redirectUri,
    codeChallenge: query.get("code_challenge") as string,
    codeChallengeMethod: query.get("code_challenge_method") as string,
    scope: query.get("scope") ?? "",
    expiresAt: store.clock() + AUTHORIZATION_CODE_TTL_SECONDS * 1000,
  });
  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  const state = query.get("state");
  if (state) target.searchParams.set("state", state);
  return redirect(target.toString());
}

function authorize(store: MockStore, url: URL, options: HandlerOptions): Response {
  const query = url.searchParams;
  const clientId = query.get("client_id");
  const redirectUri = query.get("redirect_uri");
  const client = store.data.oauthClients.find((item) => item.clientId === clientId);
  // Like production, a bad client or redirect URI is shown, never redirected to.
  if (!client)
    return html(
      page("Unknown app", `No OAuth client with id <code>${escapeHtml(clientId ?? "")}</code>.`),
      400
    );
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return html(
      page(
        "Redirect URI mismatch",
        `<code>${escapeHtml(redirectUri ?? "")}</code> isn't registered for ${escapeHtml(client.name)}.`
      ),
      400
    );
  }
  const state = query.get("state");
  if (query.get("response_type") !== "code") {
    return authorizeError(
      redirectUri,
      state,
      "unsupported_response_type",
      "response_type must be code"
    );
  }
  if (!query.get("code_challenge"))
    return authorizeError(redirectUri, state, "invalid_request", "pkce_required");
  if (query.get("code_challenge_method") !== "S256") {
    return authorizeError(redirectUri, state, "invalid_request", "invalid_code_challenge_method");
  }
  if (query.get("decision") === "deny")
    return authorizeError(redirectUri, state, "access_denied", "The user denied access.");
  if (!options.requireConsent || query.get("decision") === "allow") return issueCode(store, query);

  const allow = new URL(url);
  allow.searchParams.set("decision", "allow");
  const deny = new URL(url);
  deny.searchParams.set("decision", "deny");
  const me = store.data.me;
  return html(
    page(
      `${escapeHtml(client.name)} wants to access your Cal.com account`,
      `<p>Signed in as <strong>${escapeHtml(String(me.name))}</strong> (${escapeHtml(String(me.email))}).</p>
       <p>It will be able to read and change your bookings, links, availability and events.</p>
       <p class="actions"><a class="button" href="${escapeHtml(allow.pathname + allow.search)}">Allow</a>
       <a class="button secondary" href="${escapeHtml(deny.pathname + deny.search)}">Deny</a></p>`
    )
  );
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
body{font:17px -apple-system,system-ui,sans-serif;margin:0;padding:48px 24px;color:#111;background:#fff}
@media (prefers-color-scheme:dark){body{background:#000;color:#f5f5f5}}
main{max-width:420px;margin:0 auto}h1{font-size:24px;line-height:1.25}
.badge{display:inline-block;font-size:12px;padding:2px 8px;border-radius:99px;background:#fde68a;color:#78350f;margin-bottom:16px}
.actions{display:flex;gap:12px;margin-top:32px}.button{flex:1;text-align:center;padding:14px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:600}
.button.secondary{background:#e5e5e5;color:#111}code{font-size:14px}</style></head>
<body><main><span class="badge">Mock Cal.com</span><h1>${title}</h1>${body}</main></body></html>`;
}

async function exchangeCode(store: MockStore, req: Request): Promise<Response> {
  const body = await readBody(req);
  const {
    code,
    client_id: clientId,
    grant_type: grantType,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  } = body as Record<string, string | undefined>;
  if (!clientId || !code || !redirectUri) return oauthError(400, "invalid_request");
  if (grantType !== "authorization_code") return oauthError(400, "invalid_request");
  const client = store.data.oauthClients.find((item) => item.clientId === clientId);
  if (!client) return oauthError(401, "invalid_client", "client_not_found");
  if (!client.redirectUris.includes(redirectUri))
    return oauthError(400, "invalid_grant", "redirect_uri_mismatch");
  const record = store.codes.get(code);
  if (!record || record.clientId !== clientId || record.expiresAt <= store.clock()) {
    return oauthError(400, "invalid_grant", "code_invalid_or_expired");
  }
  if (record.redirectUri !== redirectUri)
    return oauthError(400, "invalid_grant", "redirect_uri_mismatch");
  // A code works once, whatever happens next.
  store.codes.delete(code);
  if (!verifier) return oauthError(400, "invalid_request", "code_verifier_required");
  if ((await sha256Base64Url(verifier)) !== record.codeChallenge) {
    return oauthError(400, "invalid_grant", "invalid_code_verifier");
  }
  return tokenResponse(store, clientId, store.data.me.id as number, record.scope);
}

async function refresh(store: MockStore, req: Request): Promise<Response> {
  const body = (await readBody(req)) as Record<string, string | undefined>;
  if (!body.client_id) return oauthError(400, "invalid_request");
  if (body.grant_type !== "refresh_token") return oauthError(400, "invalid_request");
  const client = store.data.oauthClients.find((item) => item.clientId === body.client_id);
  if (!client) return oauthError(401, "invalid_client", "client_not_found");
  const token = body.refresh_token || req.headers.get("authorization")?.split(" ")[1] || "";
  const record = store.refreshTokens.get(token);
  if (!record || record.expiresAt <= store.clock())
    return oauthError(400, "invalid_grant", "invalid_refresh_token");
  if (record.clientId !== body.client_id)
    return oauthError(400, "invalid_grant", "client_id_mismatch");
  // Rotation: the old refresh token stops working.
  store.refreshTokens.delete(token);
  return tokenResponse(store, record.clientId, record.userId, "");
}

function tokenResponse(
  store: MockStore,
  clientId: string,
  userId: number,
  scope: string
): Response {
  const { access, refresh: refreshToken } = store.issueTokens(clientId, userId);
  return json(
    {
      access_token: access.token,
      token_type: "bearer",
      refresh_token: refreshToken.token,
      expires_in: store.accessTokenTtlSeconds,
      scope,
    },
    200,
    { "Cache-Control": "no-store", Pragma: "no-cache" }
  );
}

async function revoke(store: MockStore, req: Request): Promise<Response> {
  const body = (await readBody(req)) as Record<string, string | undefined>;
  if (body.token) {
    store.accessTokens.delete(body.token);
    store.refreshTokens.delete(body.token);
  }
  return new Response(null, { status: 200 });
}

// ----------------------------------------------------------------------------------------------
// Routing
// ----------------------------------------------------------------------------------------------

function route(method: string, path: string, handler: Handler, auth = true): Route {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^${path.replace(/:(\w+)/g, (_match, key: string) => {
      keys.push(key);
      return "([^/]+)";
    })}/?$`
  );
  return { method, pattern, keys, handler, auth };
}

const listOf = (pick: (data: SeedData) => JsonObject[]) => (ctx: Context) => ok(pick(ctx.data));

const ROUTES: Route[] = [
  // Profile
  route("GET", "/v2/me", (ctx) => ok(ctx.data.me)),
  route("PATCH", "/v2/me", async (ctx) => {
    const body = await ctx.body();
    const editable = [
      "name",
      "email",
      "bio",
      "timeZone",
      "weekStart",
      "timeFormat",
      "defaultScheduleId",
      "locale",
      "avatarUrl",
      "brandColor",
      "darkBrandColor",
      "theme",
    ];
    for (const key of editable) if (body[key] !== undefined) ctx.data.me[key] = body[key];
    if (body.defaultScheduleId !== undefined)
      makeDefaultSchedule(ctx.data, findSchedule(ctx.data, String(body.defaultScheduleId)));
    return ok(ctx.data.me);
  }),
  route(
    "GET",
    "/v2/teams",
    listOf((data) => data.teams)
  ),
  route(
    "GET",
    "/v2/conferencing",
    listOf((data) => data.conferencing)
  ),

  // Bookings
  route("GET", "/v2/bookings", listBookings),
  route("GET", "/v2/bookings/:uid", getBooking),
  route("POST", "/v2/bookings/:uid/cancel", cancelBooking),
  route("POST", "/v2/bookings/:uid/confirm", confirmBooking),
  route("POST", "/v2/bookings/:uid/decline", declineBooking),
  route("POST", "/v2/bookings/:uid/reschedule", rescheduleBooking),
  route("POST", "/v2/bookings/:uid/mark-absent", markAbsent),
  route("POST", "/v2/bookings/:uid/guests", addGuests),
  route("PATCH", "/v2/bookings/:uid/location", updateLocation),
  route("GET", "/v2/bookings/:uid/recordings", (ctx) =>
    ok(ctx.data.recordings[findBooking(ctx.data, ctx.params.uid).uid as string] ?? [])
  ),
  route("GET", "/v2/bookings/:uid/transcripts", (ctx) =>
    ok(ctx.data.transcripts[findBooking(ctx.data, ctx.params.uid).uid as string] ?? [])
  ),
  route("GET", "/v2/bookings/:uid/conferencing-sessions", (ctx) =>
    ok(ctx.data.conferencingSessions[findBooking(ctx.data, ctx.params.uid).uid as string] ?? [])
  ),

  // Links (event types)
  route("GET", "/v2/event-types", (ctx) => {
    const sort = ctx.url.searchParams.get("sortCreatedAt");
    const rows = [...ctx.data.eventTypes].sort((a, b) => (a.id as number) - (b.id as number));
    return ok(sort === "desc" ? rows.reverse() : rows);
  }),
  route("POST", "/v2/event-types", createEventType),
  route("GET", "/v2/event-types/:id", (ctx) => ok(findEventType(ctx.data, ctx.params.id))),
  route("PATCH", "/v2/event-types/:id", updateEventType),
  route("DELETE", "/v2/event-types/:id", deleteEventType),
  route("GET", "/v2/event-types/:id/private-links", (ctx) => {
    findEventType(ctx.data, ctx.params.id);
    const links = ctx.data.privateLinks.filter(
      (link) => String(link.eventTypeId) === ctx.params.id
    );
    for (const link of links) refreshPrivateLink(link, ctx.store.clock());
    return ok(links);
  }),
  route("POST", "/v2/event-types/:id/private-links", createPrivateLink),
  route("PATCH", "/v2/event-types/:id/private-links/:linkId", updatePrivateLink),
  route("DELETE", "/v2/event-types/:id/private-links/:linkId", deletePrivateLink),
  route("GET", "/v2/event-types/:id/webhooks", (ctx) => {
    findEventType(ctx.data, ctx.params.id);
    return ok(
      ctx.data.eventTypeWebhooks.filter((hook) => String(hook.eventTypeId) === ctx.params.id)
    );
  }),
  route("POST", "/v2/event-types/:id/webhooks", async (ctx) => {
    const eventType = findEventType(ctx.data, ctx.params.id);
    const hook = {
      ...(await webhookInput(ctx)),
      id: ctx.store.nextId([...ctx.data.webhooks, ...ctx.data.eventTypeWebhooks]),
      eventTypeId: eventType.id as number,
    };
    ctx.data.eventTypeWebhooks.push(hook);
    return ok(hook, 201);
  }),
  route("PATCH", "/v2/event-types/:id/webhooks/:webhookId", async (ctx) => {
    const index = ctx.data.eventTypeWebhooks.findIndex(
      (hook) =>
        String(hook.id) === ctx.params.webhookId && String(hook.eventTypeId) === ctx.params.id
    );
    if (index < 0) notFound(`Webhook ${ctx.params.webhookId} not found`);
    ctx.data.eventTypeWebhooks[index] = await webhookInput(ctx, ctx.data.eventTypeWebhooks[index]);
    return ok(ctx.data.eventTypeWebhooks[index]);
  }),
  route("DELETE", "/v2/event-types/:id/webhooks/:webhookId", (ctx) => {
    const hook =
      ctx.data.eventTypeWebhooks.find(
        (item) =>
          String(item.id) === ctx.params.webhookId && String(item.eventTypeId) === ctx.params.id
      ) ?? notFound(`Webhook ${ctx.params.webhookId} not found`);
    ctx.data.eventTypeWebhooks = ctx.data.eventTypeWebhooks.filter((item) => item !== hook);
    return ok(hook);
  }),

  // Schedules
  route(
    "GET",
    "/v2/schedules",
    listOf((data) => data.schedules)
  ),
  route("POST", "/v2/schedules", createSchedule),
  route("GET", "/v2/schedules/:id", (ctx) => ok(findSchedule(ctx.data, ctx.params.id))),
  route("PATCH", "/v2/schedules/:id", updateSchedule),
  route("DELETE", "/v2/schedules/:id", deleteSchedule),
  route("POST", "/v2/atoms/schedules/:id/duplicate", duplicateSchedule),

  // User webhooks
  route(
    "GET",
    "/v2/webhooks",
    listOf((data) => data.webhooks)
  ),
  route("POST", "/v2/webhooks", async (ctx) => {
    const hook = {
      ...(await webhookInput(ctx)),
      id: ctx.store.nextId([...ctx.data.webhooks, ...ctx.data.eventTypeWebhooks]),
      userId: ctx.data.me.id as number,
    };
    ctx.data.webhooks.push(hook);
    return ok(hook, 201);
  }),
  route("PATCH", "/v2/webhooks/:webhookId", async (ctx) => {
    const index = ctx.data.webhooks.findIndex((hook) => String(hook.id) === ctx.params.webhookId);
    if (index < 0) notFound(`Webhook ${ctx.params.webhookId} not found`);
    ctx.data.webhooks[index] = await webhookInput(ctx, ctx.data.webhooks[index]);
    return ok(ctx.data.webhooks[index]);
  }),
  route("DELETE", "/v2/webhooks/:webhookId", (ctx) => {
    const hook =
      ctx.data.webhooks.find((item) => String(item.id) === ctx.params.webhookId) ??
      notFound(`Webhook ${ctx.params.webhookId} not found`);
    ctx.data.webhooks = ctx.data.webhooks.filter((item) => item !== hook);
    return ok(hook);
  }),

  // Push notifications
  route("POST", "/v2/notifications/subscriptions/app-push", (ctx) =>
    ok({ id: ctx.store.nextId([]) + 7000 }, 201)
  ),
  route("DELETE", "/v2/notifications/subscriptions/app-push", () => json({ status: "success" })),

  // Cal Events
  route("GET", "/v2/events", (ctx) => listCalEvents(ctx)),
  route("POST", "/v2/events", (ctx) => createCalEvent(ctx, null)),
  route("GET", "/v2/teams/:teamId/events", (ctx) => listCalEvents(ctx, Number(ctx.params.teamId))),
  route("POST", "/v2/teams/:teamId/events", (ctx) => {
    const teamId = Number(ctx.params.teamId);
    if (!ctx.data.teams.some((team) => team.id === teamId))
      throw new HttpError(403, "You are not a member of this team.");
    return createCalEvent(ctx, teamId);
  }),
  route("GET", "/v2/events/:uuid", (ctx) => ok(findCalEvent(ctx.data, ctx.params.uuid))),
  route("PATCH", "/v2/events/:uuid", updateCalEvent),
  route("DELETE", "/v2/events/:uuid", deleteCalEvent),
  route("POST", "/v2/events/:uuid/publish", publishCalEvent),
  route("POST", "/v2/events/:uuid/cancel", cancelCalEvent),
  route("GET", "/v2/events/:uuid/locations", (ctx) =>
    ok(findCalEvent(ctx.data, ctx.params.uuid).locations)
  ),
  route("POST", "/v2/events/:uuid/locations", addCalEventLocation),
  route("PATCH", "/v2/events/:uuid/locations/:locationId", updateCalEventLocation),
  route("DELETE", "/v2/events/:uuid/locations/:locationId", removeCalEventLocation),
  route("POST", "/v2/events/:uuid/cover-image", (ctx) => {
    const event = findCalEvent(ctx.data, ctx.params.uuid);
    event.coverImageUrl = `${ctx.data.meta.appUrl}/__mock/media/cover-${String(event.uuid)}.jpg?v=${ctx.store.clock()}`;
    return ok({ coverImageUrl: event.coverImageUrl }, 201);
  }),
  route("DELETE", "/v2/events/:uuid/cover-image", (ctx) => {
    findCalEvent(ctx.data, ctx.params.uuid).coverImageUrl = null;
    return json({ status: "success" });
  }),
  route("POST", "/v2/events/:uuid/person-avatar", (ctx) => {
    findCalEvent(ctx.data, ctx.params.uuid);
    return ok(
      { avatarUrl: `${ctx.data.meta.appUrl}/__mock/media/avatar-${ctx.store.clock()}.png` },
      201
    );
  }),
  route("GET", "/v2/events/:uuid/co-hosts", (ctx) => {
    findCalEvent(ctx.data, ctx.params.uuid);
    return ok(ctx.data.calEventCoHosts[ctx.params.uuid] ?? []);
  }),
  route("POST", "/v2/events/:uuid/co-hosts", addCoHost),
  route("PATCH", "/v2/events/:uuid/co-hosts/order", async (ctx) => {
    findCalEvent(ctx.data, ctx.params.uuid);
    const body = await ctx.body();
    const order = Array.isArray(body.ids)
      ? body.ids.map(String)
      : Array.isArray(body.order)
        ? body.order.map(String)
        : [];
    const list = ctx.data.calEventCoHosts[ctx.params.uuid] ?? [];
    list.sort((a, b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)));
    return ok(list);
  }),
  route("DELETE", "/v2/events/:uuid/co-hosts/:coHostId", (ctx) => {
    const list = ctx.data.calEventCoHosts[ctx.params.uuid] ?? [];
    if (!list.some((item) => item.id === ctx.params.coHostId))
      notFound(`Co-host ${ctx.params.coHostId} not found`);
    ctx.data.calEventCoHosts[ctx.params.uuid] = list.filter(
      (item) => item.id !== ctx.params.coHostId
    );
    return json({ status: "success" });
  }),
  route("GET", "/v2/events/:uuid/host-candidates", (ctx) => {
    findCalEvent(ctx.data, ctx.params.uuid);
    const { page, pagination } = cursorPage(ctx.data.hostCandidates, ctx.url, 50, 100);
    return json({ status: "success", data: page, pagination });
  }),
  route("GET", "/v2/events/:uuid/bookings", listCalEventBookings),
  route("GET", "/v2/events/:uuid/registrations/counts", registrationCounts),
  route("POST", "/v2/events/:uuid/registrations/approve-all", approveAll),
  route("POST", "/v2/events/:uuid/registrations/:registrationId/check-in", checkInRegistration),
  route("DELETE", "/v2/events/:uuid/registrations/:registrationId/check-in", undoCheckIn),
  route("POST", "/v2/events/:uuid/registrations/:registrationId/:decision", decideRegistration),
  route("POST", "/v2/events/:uuid/check-ins", checkInByTicket),
  route("POST", "/v2/events/:uuid/invitations", inviteGuests),
  route("GET", "/v2/events/:uuid/messages", (ctx) => {
    findCalEvent(ctx.data, ctx.params.uuid);
    const { page, pagination } = cursorPage(
      ctx.data.calEventMessages[ctx.params.uuid] ?? [],
      ctx.url,
      20,
      20
    );
    return json({ status: "success", data: page, pagination });
  }),
  route("POST", "/v2/events/:uuid/messages", sendMessage),
];

/** Mock-only endpoints for tests and scripts. */
function adminRoute(store: MockStore, url: URL, method: string): Response | null {
  if (url.pathname === "/__mock/health") return json({ ok: true });
  if (url.pathname === "/__mock/state" && method === "GET") {
    const data = store.data;
    return json({
      meta: data.meta,
      counts: {
        bookings: data.bookings.length,
        eventTypes: data.eventTypes.length,
        schedules: data.schedules.length,
        calEvents: data.calEvents.length,
        activeAccessTokens: [...store.accessTokens.values()].filter(
          (t) => t.expiresAt > store.clock()
        ).length,
      },
      oauthClients: data.oauthClients,
      unhandled: store.unhandled,
    });
  }
  if (url.pathname === "/__mock/reset" && method === "POST") {
    const nowParam = url.searchParams.get("now");
    store.reset(nowParam ? new Date(nowParam) : undefined);
    return json({ ok: true, now: store.data.meta.now });
  }
  if (url.pathname === "/__mock/expire-tokens" && method === "POST") {
    return json({ ok: true, expired: store.expireAccessTokens() });
  }
  if (url.pathname === "/__mock/seed" && method === "GET") return json(store.data);
  if (url.pathname.startsWith("/__mock/media/")) {
    return new Response(`Mock media file: ${url.pathname.slice("/__mock/media/".length)}\n`, {
      headers: { "Content-Type": "text/plain" },
    });
  }
  return null;
}

export function createHandler(store: MockStore, options: HandlerOptions = {}) {
  const assetOrigin = (options.assetOrigin ?? "https://app.cal.com").replace(/\/+$/, "");

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    try {
      const admin = adminRoute(store, url, method);
      if (admin) return admin;

      // The web app's OAuth endpoints.
      if (url.pathname === "/auth/oauth2/authorize" && method === "GET")
        return authorize(store, url, options);
      if (url.pathname === "/api/auth/oauth/token" && method === "POST")
        return exchangeCode(store, req);
      if (url.pathname === "/api/auth/oauth/refreshToken" && method === "POST")
        return refresh(store, req);
      if (url.pathname === "/api/auth/oauth/revoke" && method === "POST") return revoke(store, req);

      if (url.pathname.startsWith("/v2/")) {
        const match = ROUTES.map((candidate) => ({
          candidate,
          found: candidate.pattern.exec(url.pathname),
        })).find(({ candidate, found }) => found && candidate.method === method);
        if (!match?.found) {
          store.unhandled.push({
            method,
            path: url.pathname,
            at: new Date(store.clock()).toISOString(),
          });
          options.log?.(`UNHANDLED ${method} ${url.pathname}`);
          return apiError(url, 404, `Cannot ${method} ${url.pathname}`);
        }
        const header = req.headers.get("authorization") ?? "";
        const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
        const userId = token ? store.userForAccessToken(token) : null;
        if (match.candidate.auth && userId === null) {
          return apiError(url, 401, "ApiAuthStrategy - access token - Invalid Access Token.");
        }
        const params: Params = {};
        match.candidate.keys.forEach((key, index) => {
          params[key] = decodeURIComponent(match.found?.[index + 1] ?? "");
        });
        let parsed: Promise<JsonObject> | null = null;
        const ctx: Context = {
          req,
          url,
          params,
          store,
          data: store.data,
          userId: userId ?? 0,
          body: () => {
            parsed ??= readBody(req);
            return parsed;
          },
        };
        return await match.candidate.handler(ctx);
      }

      // Cal Video 2.0 needs the real video service; answer like an unavailable one.
      if (url.pathname.startsWith("/api/video/")) {
        return json({ message: "Cal Video isn't available on the mock server." }, 503);
      }

      // Web pages the app opens in a browser (booking pages, settings, video rooms).
      if (method === "GET" && !/\.(svg|png|jpe?g|webp|ico)$/i.test(url.pathname)) {
        return html(
          page(
            "Cal.com web page",
            `<p>The app opened <code>${escapeHtml(url.pathname + url.search)}</code>.</p><p>The mock server only stands in for the API; this page exists so links have somewhere to land.</p>`
          )
        );
      }

      // App-store icons and other static assets come from production.
      return redirect(`${assetOrigin}${url.pathname}${url.search}`);
    } catch (error) {
      if (error instanceof HttpError) return apiError(url, error.status, error.message);
      options.log?.(
        `ERROR ${method} ${url.pathname}: ${error instanceof Error ? error.stack : String(error)}`
      );
      return apiError(url, 500, "Internal server error");
    }
  };
}
