/**
 * The edit screen's logic: the form an event prefills, what a save sends (only what changed, as
 * `PATCH /v2/events/{uuid}` takes it), and the web editor's validation
 * (`packages/features/cal-events/lib/cal-event-form.ts`) so both surfaces accept the same edits.
 */

import type {
  AddCalEventLocationInput,
  CalEvent,
  CalEventBackground,
  CalEventCategory,
  CalEventCustomFieldType,
  CalEventGuestList,
  CalEventLineupPerson,
  CalEventLocation,
  CalEventRegistrationField,
  CalEventScheduleItem,
  CalEventSchedulePerson,
  CalEventShaderId,
  CalEventTheme,
  UpdateCalEventInput,
  UpdateCalEventLocationInput,
} from "@/services/types/cal-events.types";
import {
  CAL_EVENT_MIN_DURATION_MS,
  CAL_EVENT_NAME_MAX_LENGTH,
  type CreateCalEventFormValues,
  parseLocationInput,
} from "@/utils/cal-event-create";
import {
  canManageCalEventLifecycle,
  formatCalEventPrice,
  getCalEventPriceDecimals,
  isPaidCalEvent,
} from "@/utils/cal-events";
import {
  isStartTimeInPast,
  splitWallTimeParts,
  utcToWallTime,
  wallTimeDiffMs,
  wallTimeToUtc,
} from "@/utils/wall-time";

export const CAL_EVENT_DESCRIPTION_MAX_LENGTH = 5000;
export const CAL_EVENT_SLUG_MIN_LENGTH = 10;
export const CAL_EVENT_SLUG_MAX_LENGTH = 100;
const CAL_EVENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CAL_EVENT_MAX_CAPACITY = 100_000;
export const CAL_EVENT_PAYMENT_TIMEOUT_MIN = 10;
export const CAL_EVENT_PAYMENT_TIMEOUT_MAX = 10_080;
export const CAL_EVENT_LIVE_STREAM_LIMIT = 5;
const CAL_EVENT_LIVE_STREAM_URL_MAX_LENGTH = 2048;
export const MAX_LINEUP_PEOPLE = 30;
export const MAX_LINEUP_LINKS_PER_PERSON = 5;
export const MAX_LINEUP_MEDIA_PER_PERSON = 6;
export const MAX_SCHEDULE_ITEMS = 50;
export const MAX_SCHEDULE_PEOPLE_PER_ITEM = 10;
export const MAX_SCHEDULE_LINKS_PER_PERSON = 5;

export const CAL_EVENT_CATEGORIES: { value: CalEventCategory; label: string; hint: string }[] = [
  {
    value: "meetup",
    label: "Meetup",
    hint: "A community gathering, workshop, or casual in-person event.",
  },
  {
    value: "conference",
    label: "Conference",
    hint: "A structured event with speakers, sessions, or an agenda.",
  },
  {
    value: "music",
    label: "Music",
    hint: "A performance, concert, showcase, or artist-led event.",
  },
  { value: "sports", label: "Sports", hint: "A match, class, race, tournament, or team activity." },
];

/** The web's "Public guests" choices, in its order. */
export const CAL_EVENT_GUEST_LISTS: { value: CalEventGuestList; label: string; hint: string }[] = [
  {
    value: "hidden",
    label: "Don't show guests",
    hint: "Hide the guest section on the public event page.",
  },
  {
    value: "names",
    label: "Show guest names",
    hint: "A paginated public list of confirmed guests. Guests can hide their name when they register.",
  },
  {
    value: "count",
    label: "Show going count only",
    hint: "Show how many people are going, without names.",
  },
];

export const CAL_EVENT_SHADERS: { value: CalEventShaderId; label: string }[] = [
  { value: "aurora", label: "Aurora" },
  { value: "tide", label: "Tide" },
  { value: "halftone", label: "Halftone" },
  { value: "strata", label: "Strata" },
  { value: "recess", label: "Recess" },
  { value: "contour", label: "Contour" },
  { value: "satin", label: "Satin" },
  { value: "veil", label: "Veil" },
  { value: "resonance", label: "Resonance" },
  { value: "lumen", label: "Lumen" },
  { value: "facet", label: "Facet" },
];

/** The web's palettes (`apps/web/modules/shaders/shader-palettes.ts`). */
export const CAL_EVENT_SHADER_PALETTES: { label: string; colors: [string, string, string] }[] = [
  { label: "Mono", colors: ["#FAFAFA", "#D4D4D8", "#09090B"] },
  { label: "Porcelain", colors: ["#D2AB79", "#F3DCAD", "#B7DCE3"] },
  { label: "Ember", colors: ["#FF682C", "#FFAE56", "#FFE1A3"] },
  { label: "Terra", colors: ["#ED8061", "#FFAF83", "#F7D2AD"] },
  { label: "Rosé", colors: ["#F06F9D", "#FFADC7", "#FFD0B4"] },
  { label: "Dusk", colors: ["#FFB66B", "#B593EC", "#87BEF0"] },
  { label: "Orchard", colors: ["#A0C95A", "#DAE890", "#62CBA5"] },
  { label: "Petrol", colors: ["#35BBC4", "#F99B86", "#F4D294"] },
  { label: "Lagoon", colors: ["#17BFDD", "#34D9BD", "#B3F0CE"] },
  { label: "Borealis", colors: ["#43D7AC", "#78BAFF", "#C2A3F3"] },
  { label: "Cobalt", colors: ["#669BFF", "#A0C5FF", "#7DDFE7"] },
  { label: "Iris", colors: ["#AA7AF9", "#E8A0DD", "#FFD1CC"] },
];

export const DEFAULT_CAL_EVENT_BACKGROUND: CalEventBackground = {
  effect: "aurora",
  colors: CAL_EVENT_SHADER_PALETTES[0].colors,
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** The currencies Cal Pay charges in (`packages/lib/currency-options.ts`), as the API takes them. */
export const CAL_EVENT_CURRENCIES = [
  "usd",
  "eur",
  "gbp",
  "cad",
  "aud",
  "chf",
  "nzd",
  "jpy",
  "brl",
  "mxn",
  "inr",
  "sgd",
  "hkd",
  "dkk",
  "nok",
  "sek",
  "pln",
  "czk",
  "huf",
  "ron",
  "bgn",
  "krw",
  "thb",
  "php",
  "myr",
  "idr",
  "try",
  "zar",
  "aed",
  "cop",
].map((value) => ({ value, label: value.toUpperCase() }));

/** Cal Pay's minimum charge per currency, in its main unit (`cal-payments-minimum-charge.ts`). */
const CAL_PAY_MINIMUM_CHARGES: Record<string, number> = {
  usd: 1,
  eur: 1,
  gbp: 1,
  chf: 1,
  cad: 1.5,
  sgd: 1.5,
  aud: 2,
  nzd: 2,
  bgn: 2,
  pln: 4,
  ron: 5,
  myr: 5,
  brl: 6,
  dkk: 7,
  hkd: 8,
  nok: 11,
  sek: 11,
  mxn: 20,
  zar: 20,
  czk: 24,
  thb: 35,
  try: 35,
  aed: 4,
  php: 60,
  inr: 100,
  jpy: 150,
  huf: 400,
  krw: 1400,
  cop: 4500,
  idr: 16000,
};

export const CAL_EVENT_CUSTOM_FIELD_TYPES: {
  value: CalEventCustomFieldType;
  label: string;
  hasOptions: boolean;
}[] = [
  { value: "email", label: "Email", hasOptions: false },
  { value: "phone", label: "Phone", hasOptions: false },
  { value: "address", label: "Address", hasOptions: false },
  { value: "shortText", label: "Short Text", hasOptions: false },
  { value: "number", label: "Number", hasOptions: false },
  { value: "longText", label: "Long Text", hasOptions: false },
  { value: "select", label: "Select", hasOptions: true },
  { value: "multiSelect", label: "MultiSelect", hasOptions: true },
  { value: "multiEmail", label: "Multiple Emails", hasOptions: false },
  { value: "checkboxGroup", label: "Checkbox Group", hasOptions: true },
  { value: "radioGroup", label: "Radio Group", hasOptions: true },
  { value: "checkbox", label: "Checkbox", hasOptions: false },
  { value: "url", label: "URL", hasOptions: false },
];

export function customFieldTypeHasOptions(type: CalEventCustomFieldType | undefined): boolean {
  return CAL_EVENT_CUSTOM_FIELD_TYPES.some((option) => option.value === type && option.hasOptions);
}

/** A schedule item as the form holds it: times are wall times in the event's timezone. */
export interface CalEventEditScheduleItem {
  /** Null for an item that has a time label instead (the API can set one; the editors can't). */
  startWallTime: string | null;
  endWallTime: string | null;
  timeLabel: string;
  content: string;
  people: CalEventSchedulePerson[];
}

export interface CalEventEditFormValues extends Omit<CreateCalEventFormValues, "location"> {
  description: string;
  slug: string;
  category: CalEventCategory;
  /** null follows the visitor's system setting. */
  theme: CalEventTheme | null;
  background: CalEventBackground | null;
  /** One URL per row; empty rows are dropped on save. */
  liveStreams: string[];
  /** Creator first. */
  hostUserIds: number[];
  showPresentedBy: boolean;
  capacityEnabled: boolean;
  /** Typed text, so a half-typed number can be shown and flagged. */
  capacity: string;
  waitlistEnabled: boolean;
  guestList: CalEventGuestList;
  showOrganizerEmail: boolean;
  /** Empty = the 10-minute default. */
  paymentTimeoutMinutes: string;
  /** The Payment tab's "Paid event" toggle. */
  paymentEnabled: boolean;
  /** An event without locations has one price, in the currency's main unit ("15.50"). */
  price: string;
  /** Lowercase, as Cal Pay takes it. */
  currency: string;
  /**
   * Prices typed in the Payment tab, by location id. A location missing here shows its saved
   * price. Locations change outside the form, so a save compares these with the saved ones.
   */
  locationPrices: Record<string, CalEventPriceValues>;
  registrationFields: CalEventRegistrationField[];
  lineupTitle: string;
  lineupPeople: CalEventLineupPerson[];
  schedule: CalEventEditScheduleItem[];
}

/** The form for an event, as `GET /v2/events/{uuid}` returns it. */
export function buildEditFormValues(event: CalEvent): CalEventEditFormValues {
  const toWall = (iso: string | null | undefined) =>
    iso ? utcToWallTime(new Date(iso), event.timeZone) : null;
  return {
    name: event.title,
    startWallTime: toWall(event.startTime) ?? "",
    endWallTime: toWall(event.endTime) ?? "",
    timeZone: event.timeZone,
    isPrivate: event.visibility === "UNLISTED",
    requiresApproval: event.requiresApproval,
    description: event.description ?? "",
    slug: event.slug,
    category: event.category ?? "meetup",
    theme: event.theme ?? null,
    background: event.background ?? null,
    liveStreams: (event.liveStreams ?? []).map((stream) => stream.url),
    hostUserIds: event.hosts.map((host) => host.userId),
    showPresentedBy: event.showPresentedBy ?? false,
    capacityEnabled: event.capacity !== null,
    capacity: event.capacity === null ? "" : String(event.capacity),
    waitlistEnabled: event.waitlistEnabled,
    guestList: event.guestList ?? "names",
    showOrganizerEmail: event.showOrganizerEmail ?? false,
    paymentTimeoutMinutes:
      event.paymentTimeoutMinutes == null ? "" : String(event.paymentTimeoutMinutes),
    paymentEnabled: isPaidCalEvent(event),
    ...calEventPriceValues(event.price, event.currency),
    locationPrices: {},
    registrationFields: event.registrationFields ?? [],
    lineupTitle: event.lineup?.title ?? "",
    lineupPeople: event.lineup?.people ?? [],
    schedule: (event.schedule ?? []).map((item) => ({
      startWallTime: toWall(item.startTime),
      endWallTime: toWall(item.endTime),
      timeLabel: item.timeLabel ?? "",
      content: item.content,
      people: item.people ?? [],
    })),
  };
}

const trimToNull = (value: string | null | undefined) => value?.trim() || null;

function cleanLinks(links: { url: string }[] | undefined) {
  return (links ?? [])
    .map((link) => ({ url: link.url.trim() }))
    .filter((link) => link.url.length > 0);
}

function cleanSchedulePerson(person: CalEventSchedulePerson): CalEventSchedulePerson {
  return {
    name: person.name.trim(),
    role: trimToNull(person.role),
    avatarUrl: person.avatarUrl ?? null,
    links: cleanLinks(person.links),
  };
}

function cleanLineupPerson(person: CalEventLineupPerson): CalEventLineupPerson {
  return {
    ...cleanSchedulePerson(person),
    media: (person.media ?? [])
      .map((item) => ({ url: item.url.trim(), label: trimToNull(item.label) }))
      .filter((item) => item.url.length > 0),
  };
}

function lineupInput(values: CalEventEditFormValues): UpdateCalEventInput["lineup"] {
  const title = trimToNull(values.lineupTitle);
  if (!title && values.lineupPeople.length === 0) return null;
  return { title, people: values.lineupPeople.map(cleanLineupPerson) };
}

function scheduleInput(values: CalEventEditFormValues): CalEventScheduleItem[] {
  const toIso = (wall: string | null) =>
    wall ? wallTimeToUtc(wall, values.timeZone).toISOString() : null;
  return values.schedule.map((item) => ({
    ...(item.startWallTime
      ? { startTime: toIso(item.startWallTime), endTime: toIso(item.endWallTime) }
      : { timeLabel: item.timeLabel.trim() }),
    content: item.content.trim(),
    people: item.people.map(cleanSchedulePerson),
  }));
}

function backgroundsEqual(a: CalEventBackground | null, b: CalEventBackground | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.effect === b.effect &&
    a.colors.every((color, index) => color.toLowerCase() === b.colors[index]?.toLowerCase())
  );
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What a save sends: every field that differs from the prefilled form, and nothing else, so a
 * field the editor didn't touch is never overwritten. Lists go whole, since they replace the
 * stored list. An empty result means there is nothing to save.
 */
export function buildCalEventUpdateInput(
  initial: CalEventEditFormValues,
  current: CalEventEditFormValues,
  event: Pick<CalEvent, "publishedAt" | "price" | "currency" | "locations">
): UpdateCalEventInput {
  const input: UpdateCalEventInput = {};
  const published = event.publishedAt !== null;

  if (current.name.trim() !== initial.name.trim()) input.title = current.name.trim();
  if (current.description.trim() !== initial.description.trim()) {
    input.description = trimToNull(current.description);
  }

  const startUtc = wallTimeToUtc(current.startWallTime, current.timeZone).toISOString();
  const endUtc = wallTimeToUtc(current.endWallTime, current.timeZone).toISOString();
  const timesChanged =
    startUtc !== wallTimeToUtc(initial.startWallTime, initial.timeZone).toISOString() ||
    endUtc !== wallTimeToUtc(initial.endWallTime, initial.timeZone).toISOString();
  // Both together: the server checks the end against the start it is given.
  if (timesChanged) {
    input.startTime = startUtc;
    input.endTime = endUtc;
  }
  if (current.timeZone !== initial.timeZone) input.timeZone = current.timeZone;

  if (!published && current.slug.trim() !== initial.slug) input.slug = current.slug.trim();
  if (current.isPrivate !== initial.isPrivate) {
    input.visibility = current.isPrivate ? "UNLISTED" : "PUBLIC";
  }
  if (current.requiresApproval !== initial.requiresApproval) {
    input.requiresApproval = current.requiresApproval;
  }
  if (current.category !== initial.category) input.category = current.category;
  if (current.theme !== initial.theme) input.theme = current.theme;
  if (!backgroundsEqual(current.background, initial.background)) {
    input.background = current.background;
  }

  const capacity = current.capacityEnabled ? Number(current.capacity) : null;
  const initialCapacity = initial.capacityEnabled ? Number(initial.capacity) : null;
  if (capacity !== initialCapacity) input.capacity = capacity;
  if (current.waitlistEnabled !== initial.waitlistEnabled) {
    input.waitlistEnabled = current.waitlistEnabled;
  }
  if (!published && current.guestList !== initial.guestList) input.guestList = current.guestList;
  if (current.showOrganizerEmail !== initial.showOrganizerEmail) {
    input.showOrganizerEmail = current.showOrganizerEmail;
  }
  if (current.showPresentedBy !== initial.showPresentedBy) {
    input.showPresentedBy = current.showPresentedBy;
  }
  // Like the web: turning payments off clears the deadline, so a paid event starts over from
  // the default when it's turned back on.
  const timeoutOf = (values: CalEventEditFormValues) =>
    values.paymentEnabled ? values.paymentTimeoutMinutes.trim() : "";
  const timeout = timeoutOf(current);
  if (timeout !== timeoutOf(initial)) {
    input.paymentTimeoutMinutes = timeout ? Number(timeout) : null;
  }
  // The event-level price is only for an event without locations (the server rejects it on one
  // with locations, which is priced per location: buildCalEventLocationPriceUpdates).
  if (getAdmissionLocations(event.locations).length === 0 && sendsPrices(initial, current)) {
    const price = current.paymentEnabled ? toMinorUnits(current.price, current.currency) : null;
    if (
      price !== (event.price || null) ||
      (price !== null && current.currency !== (event.currency ?? "").toLowerCase())
    ) {
      input.price = price;
      if (price !== null) input.currency = current.currency;
    }
  }

  if (!sameJson(current.hostUserIds, initial.hostUserIds)) {
    input.hosts = current.hostUserIds.map((userId) => ({ userId }));
  }
  const streams = current.liveStreams.map((url) => url.trim()).filter(Boolean);
  if (!sameJson(streams, initial.liveStreams.map((url) => url.trim()).filter(Boolean))) {
    input.liveStreams = streams.map((url) => ({ url }));
  }
  if (!sameJson(current.registrationFields, initial.registrationFields)) {
    input.registrationFields = current.registrationFields;
  }
  const lineup = lineupInput(current);
  if (!sameJson(lineup, lineupInput(initial))) input.lineup = lineup;
  // Schedule times follow a timezone change, like the event's own, so compare in UTC.
  const schedule = scheduleInput(current);
  if (!sameJson(schedule, scheduleInput(initial))) input.schedule = schedule;

  return input;
}

export type CalEventEditErrorKey =
  | "name"
  | "time"
  | "description"
  | "slug"
  | "capacity"
  | "paymentTimeoutMinutes"
  | "price"
  | "locationPrices"
  | "requiresApproval"
  | "liveStreams"
  | "background"
  | "lineup"
  | "schedule"
  | "registrationFields";

export type CalEventEditErrors = Partial<Record<CalEventEditErrorKey, string>>;

const isWholeNumberIn = (text: string, min: number, max: number) => {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const value = Number(trimmed);
  return value >= min && value <= max;
};

const isHttpUrl = (url: string) => /^https?:\/\/[^\s/?#]+\.[^\s]+$/i.test(url.trim());

function personError(
  person: CalEventSchedulePerson & { media?: CalEventLineupPerson["media"] },
  maxLinks: number,
  maxMedia: number
): string | null {
  if (!person.name.trim()) return "Every person needs a name";
  const links = cleanLinks(person.links);
  if (links.length > maxLinks) return `A person can have up to ${maxLinks} links`;
  if (links.some((link) => !isHttpUrl(link.url)))
    return "Links must start with http:// or https://";
  const media = (person.media ?? []).filter((item) => item.url.trim());
  if (media.length > maxMedia) return `A person can have up to ${maxMedia} players`;
  if (media.some((item) => !isHttpUrl(item.url))) {
    return "Players must start with http:// or https://";
  }
  return null;
}

/** The registration questions' first problem, if any. */
export function getRegistrationFieldsError(fields: CalEventRegistrationField[]): string | null {
  const slugs = new Set<string>();
  for (const field of fields) {
    if (field.field !== "custom") continue;
    if (!field.label?.trim()) return "Every question needs a label";
    if (!field.slug || !/^[A-Za-z0-9_-]+$/.test(field.slug)) {
      return `"${field.label}" needs an identifier of letters, numbers, - or _`;
    }
    if (slugs.has(field.slug)) return `Two questions share the identifier "${field.slug}"`;
    slugs.add(field.slug);
    if (customFieldTypeHasOptions(field.type) && !field.options?.some((option) => option.trim())) {
      return `"${field.label}" needs at least one option`;
    }
  }
  return null;
}

/**
 * The web editor's rules, each under the field it belongs to. A start that has passed only
 * counts when the start was moved, so a live event can still be edited.
 */
export function getEditCalEventErrors(
  values: CalEventEditFormValues,
  initial: CalEventEditFormValues,
  event: Pick<CalEvent, "publishedAt" | "confirmedCount" | "locations" | "paymentsEnabled">,
  now: Date = new Date()
): CalEventEditErrors {
  const errors: CalEventEditErrors = {};

  if (!values.name.trim()) errors.name = "Required";
  else if (values.name.trim().length > CAL_EVENT_NAME_MAX_LENGTH) {
    errors.name = `Use at most ${CAL_EVENT_NAME_MAX_LENGTH} characters`;
  }

  const startMoved =
    values.startWallTime !== initial.startWallTime || values.timeZone !== initial.timeZone;
  if (wallTimeDiffMs(values.startWallTime, values.endWallTime) < CAL_EVENT_MIN_DURATION_MS) {
    errors.time = "End must be at least 15 minutes after the start";
  } else if (
    startMoved &&
    isStartTimeInPast(wallTimeToUtc(values.startWallTime, values.timeZone), now)
  ) {
    errors.time = "Start date must be in the future";
  }

  if (values.description.length > CAL_EVENT_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Use at most ${CAL_EVENT_DESCRIPTION_MAX_LENGTH} characters`;
  }

  const slug = values.slug.trim();
  if (
    event.publishedAt === null &&
    slug !== initial.slug &&
    (slug.length < CAL_EVENT_SLUG_MIN_LENGTH ||
      slug.length > CAL_EVENT_SLUG_MAX_LENGTH ||
      !CAL_EVENT_SLUG_PATTERN.test(slug))
  ) {
    errors.slug = `Use ${CAL_EVENT_SLUG_MIN_LENGTH}-${CAL_EVENT_SLUG_MAX_LENGTH} lowercase letters, digits and single hyphens`;
  }

  if (values.capacityEnabled) {
    if (!isWholeNumberIn(values.capacity, 1, CAL_EVENT_MAX_CAPACITY)) {
      errors.capacity = `Enter a number from 1 to ${CAL_EVENT_MAX_CAPACITY}`;
    } else if (
      event.confirmedCount !== undefined &&
      Number(values.capacity) < event.confirmedCount
    ) {
      errors.capacity = `${event.confirmedCount} guests are already confirmed`;
    }
  }

  const paymentErrors = event.paymentsEnabled ? getPaymentErrors(values, event.locations) : {};
  Object.assign(errors, paymentErrors);
  if (
    values.paymentEnabled &&
    values.paymentTimeoutMinutes.trim() &&
    !isWholeNumberIn(
      values.paymentTimeoutMinutes,
      CAL_EVENT_PAYMENT_TIMEOUT_MIN,
      CAL_EVENT_PAYMENT_TIMEOUT_MAX
    )
  ) {
    errors.paymentTimeoutMinutes = `Enter ${CAL_EVENT_PAYMENT_TIMEOUT_MIN} to ${CAL_EVENT_PAYMENT_TIMEOUT_MAX} minutes, or leave it empty`;
  }

  const streams = values.liveStreams.map((url) => url.trim()).filter(Boolean);
  if (streams.length > CAL_EVENT_LIVE_STREAM_LIMIT) {
    errors.liveStreams = `Add up to ${CAL_EVENT_LIVE_STREAM_LIMIT} live streams`;
  } else if (
    streams.some((url) => url.length > CAL_EVENT_LIVE_STREAM_URL_MAX_LENGTH || !isHttpUrl(url))
  ) {
    errors.liveStreams = "Live streams must be links starting with http:// or https://";
  }

  if (values.background && !values.background.colors.every((color) => HEX_COLOR.test(color))) {
    errors.background = "Colors must be hex codes like #FF682C";
  }

  if (values.lineupPeople.length > MAX_LINEUP_PEOPLE) {
    errors.lineup = `Add up to ${MAX_LINEUP_PEOPLE} people`;
  } else {
    for (const person of values.lineupPeople) {
      const error = personError(person, MAX_LINEUP_LINKS_PER_PERSON, MAX_LINEUP_MEDIA_PER_PERSON);
      if (error) {
        errors.lineup = error;
        break;
      }
    }
  }

  const scheduleError = getScheduleError(values);
  if (scheduleError) errors.schedule = scheduleError;

  const fieldsError = getRegistrationFieldsError(values.registrationFields);
  if (fieldsError) errors.registrationFields = fieldsError;

  return errors;
}

/** Rows of the Payment tab: the locations a guest picks at registration. */
export function getAdmissionLocations(locations: CalEventLocation[]): CalEventLocation[] {
  return locations.filter((location) => location.type !== "unknown");
}

/** A price as typed: the amount in the currency's main unit (empty = free), and the currency. */
export interface CalEventPriceValues {
  price: string;
  currency: string;
}

/** The fields for a saved price, in the smallest unit. */
export function calEventPriceValues(
  price: number | null | undefined,
  currency: string | null | undefined
): CalEventPriceValues {
  const code = (currency || "usd").toLowerCase();
  return {
    price: price ? String(price / 10 ** getCalEventPriceDecimals(code)) : "",
    currency: code,
  };
}

/** A typed price in the currency's smallest unit; null when empty. Validate it first. */
function toMinorUnits(price: string, currency: string): number | null {
  const trimmed = price.trim();
  if (!trimmed) return null;
  return Math.round(Number(trimmed) * 10 ** getCalEventPriceDecimals(currency));
}

/** "$1.00": Cal Pay's minimum charge in the currency, or null when it has none. */
export function formatCalPayMinimumCharge(currency: string): string | null {
  const minimum = CAL_PAY_MINIMUM_CHARGES[currency.toLowerCase()];
  if (minimum === undefined) return null;
  return formatCalEventPrice(
    Math.round(minimum * 10 ** getCalEventPriceDecimals(currency)),
    currency
  );
}

/**
 * A typed price's problem, if any: the web's checks plus Cal Pay's minimum charge, which the web
 * shows under the field and the server enforces. An empty price is free and has none.
 */
export function getCalEventPriceError({ price, currency }: CalEventPriceValues): string | null {
  const trimmed = price.trim();
  if (!trimmed) return null;
  if (!CAL_EVENT_CURRENCIES.some((option) => option.value === currency)) {
    return "Pick a currency";
  }
  const amount = Number(trimmed);
  if (!/^\d+(\.\d+)?$/.test(trimmed) || !Number.isFinite(amount) || amount <= 0) {
    return "Enter a price like 15 or 15.50";
  }
  const digits = getCalEventPriceDecimals(currency);
  const scaled = amount * 10 ** digits;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6) {
    return digits === 0
      ? "This currency does not support decimals — enter a whole number."
      : "Enter a price like 15 or 15.50";
  }
  return getCalPayMinimumChargeError({ price, currency });
}

/** The web's live error under a price below Cal Pay's minimum charge for its currency. */
export function getCalPayMinimumChargeError({
  price,
  currency,
}: CalEventPriceValues): string | null {
  const amount = Number(price.trim());
  const minimum = CAL_PAY_MINIMUM_CHARGES[currency];
  if (!price.trim() || !Number.isFinite(amount) || minimum === undefined || amount >= minimum) {
    return null;
  }
  return `Price is below the minimum charge amount of ${formatCalPayMinimumCharge(currency)} for this currency.`;
}

/** What a location's Payment tab row holds: what was typed, or its saved price. */
export function calEventLocationPriceValues(
  values: Pick<CalEventEditFormValues, "locationPrices">,
  location: CalEventLocation
): CalEventPriceValues {
  return (
    (location.id ? values.locationPrices[location.id] : undefined) ??
    calEventPriceValues(location.price, location.currency)
  );
}

function getPaymentErrors(
  values: CalEventEditFormValues,
  locations: CalEventLocation[]
): CalEventEditErrors {
  const errors: CalEventEditErrors = {};
  if (values.paymentEnabled && values.waitlistEnabled && values.requiresApproval) {
    errors.requiresApproval = "Paid waitlists cannot require approval.";
  }
  if (!values.paymentEnabled) return errors;
  const admission = getAdmissionLocations(locations);
  if (admission.length === 0) {
    if (!values.price.trim()) errors.price = "Enter a price for your paid event.";
    else {
      const error = getCalEventPriceError(values);
      if (error) errors.price = error;
    }
    return errors;
  }
  const rows = admission.map((location) => calEventLocationPriceValues(values, location));
  const rowError = rows.map(getCalEventPriceError).find(Boolean);
  if (rowError) errors.locationPrices = rowError;
  else if (!rows.some((row) => row.price.trim())) {
    errors.locationPrices = "Set a price on at least one location, or turn off payments.";
  }
  return errors;
}

/**
 * Whether a save sends prices: payments are on, or were on when the form opened and were turned
 * off here, which makes the event free. A form that opened free and stayed free sends none, so a
 * price set since outside it (the Locations tab applies at once, as does the web) stays.
 */
function sendsPrices(
  initial: Pick<CalEventEditFormValues, "paymentEnabled">,
  current: Pick<CalEventEditFormValues, "paymentEnabled">
): boolean {
  return initial.paymentEnabled || current.paymentEnabled;
}

/**
 * The location PATCHes a save sends for the Payment tab: each location whose price or currency
 * differs from its saved one. Turning payments off here makes every location free.
 */
export function buildCalEventLocationPriceUpdates(
  initial: Pick<CalEventEditFormValues, "paymentEnabled">,
  values: Pick<CalEventEditFormValues, "paymentEnabled" | "locationPrices">,
  locations: CalEventLocation[]
): { locationId: string; patch: UpdateCalEventLocationInput }[] {
  const updates: { locationId: string; patch: UpdateCalEventLocationInput }[] = [];
  if (!sendsPrices(initial, values)) return updates;
  for (const location of getAdmissionLocations(locations)) {
    if (!location.id || location.type === "unknown") continue;
    const row = calEventLocationPriceValues(values, location);
    const price = values.paymentEnabled ? toMinorUnits(row.price, row.currency) : null;
    const changed =
      price !== (location.price || null) ||
      (price !== null && row.currency !== (location.currency ?? "").toLowerCase());
    if (!changed) continue;
    updates.push({
      locationId: location.id,
      patch: { type: location.type, price, ...(price !== null ? { currency: row.currency } : {}) },
    });
  }
  return updates;
}

function getScheduleError(values: CalEventEditFormValues): string | null {
  if (values.schedule.length > MAX_SCHEDULE_ITEMS) {
    return `Add up to ${MAX_SCHEDULE_ITEMS} schedule items`;
  }
  for (const item of values.schedule) {
    if (!item.content.trim()) return "Every schedule item needs a description";
    if (item.startWallTime) {
      if (wallTimeDiffMs(values.startWallTime, item.startWallTime) < 0) {
        return "Schedule items must start during the event";
      }
      const end = item.endWallTime ?? item.startWallTime;
      if (item.endWallTime && wallTimeDiffMs(item.startWallTime, item.endWallTime) <= 0) {
        return "A schedule item must end after it starts";
      }
      if (wallTimeDiffMs(end, values.endWallTime) < 0) {
        return "Schedule items must end by the end of the event";
      }
    } else if (!item.timeLabel.trim()) {
      // Like the web: only an item that already has a time label (from the API) may go without.
      return "Every schedule item needs a start time";
    }
    if (item.people.length > MAX_SCHEDULE_PEOPLE_PER_ITEM) {
      return `A schedule item can have up to ${MAX_SCHEDULE_PEOPLE_PER_ITEM} people`;
    }
    for (const person of item.people) {
      const error = personError(person, MAX_SCHEDULE_LINKS_PER_PERSON, 0);
      if (error) return error;
    }
  }
  return null;
}

/** An identifier for a new question, from its label, unique among the event's questions. */
export function slugForRegistrationField(
  label: string,
  taken: CalEventRegistrationField[]
): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "question";
  const used = new Set(taken.map((field) => field.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** Move `items[index]` by `delta` places; out-of-range moves are no-ops. */
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Edit is for owners and hosts, like publish / cancel / delete; a cancelled event can't change. */
export function canEditCalEvent(
  event: Pick<CalEvent, "userId" | "hosts" | "status">,
  viewerId: number | undefined
): boolean {
  return event.status !== "cancelled" && canManageCalEventLifecycle(event, viewerId);
}

/** How a location reads in the editor's list. */
/** The web's labels for the registration form's built-in questions, by their `field`. */
export const CAL_EVENT_SYSTEM_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  email: "Email",
  location: "Location",
  title: "What is this event about?",
  notes: "Additional notes",
  guests: "Additional guests",
  rescheduleReason: "Reason for rescheduling",
  attendeePhoneNumber: "Phone number",
  smsReminderNumber: "Number for SMS reminders",
  aiAgentCallPhoneNumber: "Number for AI agent calls",
};

export function describeCalEventLocation(location: CalEventLocation): string {
  switch (location.type) {
    case "address":
      return location.address;
    case "link":
      return location.link.replace(/^https?:\/\//i, "");
    case "integration":
      return location.integration
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    case "organizersDefaultApp":
      return "Organizer's default app";
    default:
      return "Other location";
  }
}

export const CAL_EVENT_LOCATION_LABEL_MAX_LENGTH = 100;

/** A location the editor can change; the API can't edit or remove an "unknown" one. */
export type EditableCalEventLocation = Exclude<CalEventLocation, { type: "unknown" }>;

/** The location sheet's fields, as typed. */
export interface CalEventLocationFormValues extends CalEventPriceValues {
  kind: EditableCalEventLocation["type"];
  /** The address or link; conferencing has none to type. */
  value: string;
  label: string;
  capacity: string;
}

/** Adding takes only an address or a link. */
export type AddCalEventLocationFormValues = CalEventLocationFormValues & {
  kind: "address" | "link";
};

/**
 * The sheet's first problem, if any. One address per event; links can repeat. `others` are the
 * event's other locations (all of them when adding).
 */
export function getCalEventLocationError(
  values: CalEventLocationFormValues,
  others: CalEventLocation[]
): string | null {
  const value = values.value.trim();
  if (values.kind === "address" || values.kind === "link") {
    if (!value) return values.kind === "address" ? "Enter the address" : "Enter the link";
  }
  if (values.kind === "address" && others.some((location) => location.type === "address")) {
    return "An event can have one address";
  }
  if (values.kind === "link" && parseLocationInput(value)?.type !== "link") {
    return "Enter a link like https://zoom.us/j/123";
  }
  if (values.label.trim().length > CAL_EVENT_LOCATION_LABEL_MAX_LENGTH) {
    return `Keep the label under ${CAL_EVENT_LOCATION_LABEL_MAX_LENGTH} characters`;
  }
  if (values.capacity.trim() && !isWholeNumberIn(values.capacity, 1, CAL_EVENT_MAX_CAPACITY)) {
    return `Seats must be a number from 1 to ${CAL_EVENT_MAX_CAPACITY}`;
  }
  return getCalEventPriceError(values);
}

/** The POST body; call only once getCalEventLocationError passes. */
export function buildAddCalEventLocationInput(
  values: AddCalEventLocationFormValues
): AddCalEventLocationInput {
  const label = values.label.trim();
  const capacity = values.capacity.trim();
  const price = toMinorUnits(values.price, values.currency);
  const details = {
    ...(label ? { label } : {}),
    ...(capacity ? { capacity: Number(capacity) } : {}),
    ...(price !== null ? { price, currency: values.currency } : {}),
  };
  if (values.kind === "address") {
    return { type: "address", address: values.value.trim(), ...details };
  }
  const link = parseLocationInput(values.value);
  return {
    type: "link",
    link: link?.type === "link" ? link.link : values.value.trim(),
    ...details,
  };
}

/** The sheet's fields for a saved location, its price in the currency's main unit. */
export function calEventLocationFormValues(
  location: EditableCalEventLocation
): CalEventLocationFormValues {
  return {
    kind: location.type,
    value:
      location.type === "address"
        ? location.address
        : location.type === "link"
          ? location.link
          : "",
    label: location.label ?? "",
    capacity: location.capacity == null ? "" : String(location.capacity),
    ...calEventPriceValues(location.price, location.currency),
  };
}

/**
 * The PATCH body: only what changed, with null to remove a label, price or capacity. Null when
 * nothing changed. Call only once getCalEventLocationError passes.
 */
export function buildUpdateCalEventLocationInput(
  values: CalEventLocationFormValues,
  location: EditableCalEventLocation
): UpdateCalEventLocationInput | null {
  const patch: UpdateCalEventLocationInput = { type: location.type };
  const value = values.value.trim();
  if (location.type === "address" && value !== location.address) patch.address = value;
  if (location.type === "link") {
    const parsed = parseLocationInput(value);
    const link = parsed?.type === "link" ? parsed.link : value;
    if (link !== location.link) patch.link = link;
  }
  const label = values.label.trim() || null;
  if (label !== (location.label ?? null)) patch.label = label;
  const capacity = values.capacity.trim() ? Number(values.capacity.trim()) : null;
  if (capacity !== (location.capacity ?? null)) patch.capacity = capacity;
  const price = toMinorUnits(values.price, values.currency);
  const priceChanged =
    price !== (location.price || null) ||
    (price !== null && values.currency !== (location.currency ?? "").toLowerCase());
  if (priceChanged) {
    patch.price = price;
    if (price !== null) patch.currency = values.currency;
  }
  return Object.keys(patch).length > 1 ? patch : null;
}

/**
 * Like the web: once a paid event is published, its saved locations can't be removed, because
 * guests chose them when they registered.
 */
export function isCalEventLocationRemovalLocked(
  event: Pick<CalEvent, "publishedAt" | "price">,
  locations: CalEventLocation[]
): boolean {
  return !!event.publishedAt && isPaidCalEvent({ price: event.price, locations });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jan 15, 2027 · 16:00", the web editor's date-time trigger ("PP · HH:mm"). */
export function formatWallDateTime(wallTime: string): string {
  const { date, timeOfDay } = splitWallTimeParts(wallTime);
  const [year, month, day] = date.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year} · ${timeOfDay}`;
}
