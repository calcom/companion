/**
 * Timezone helpers, all via `Intl` (no tz database). Wall clock <-> instant conversion,
 * the zoned proxy `Date` (local getters read another zone's clock), and cached formatters.
 */

import { MS_PER_DAY, MS_PER_MINUTE, pad2 } from "./date-math";
import type { Instant } from "./instant";

/** Anything that names a moment: epoch ms, a `Date`, or a parseable string. */
export type InstantLike = number | Date | string;

/** Epoch milliseconds for an `InstantLike`. `NaN` if it can't be read. */
export function toMs(t: InstantLike): number {
  if (typeof t === "number") return t;
  if (t instanceof Date) return t.getTime();
  return Date.parse(t);
}

/** A wall clock reading. `month` is 1-12, not `Date`'s zero-based month. */
export interface ZoneWallClock {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  /** 0-23 */
  hour: number;
  minute: number;
  second: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function formatter(key: string, build: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  const hit = fmtCache.get(key);
  if (hit) return hit;
  const made = build();
  fmtCache.set(key, made);
  return made;
}

// Unknown ids fall back to UTC rather than throwing mid-render.
function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  return formatter(`parts:${timeZone}`, () => {
    const opts: Intl.DateTimeFormatOptions = {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      era: "short",
    };
    try {
      return new Intl.DateTimeFormat("en-US", opts);
    } catch {
      return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
    }
  });
}

let localZoneCache: string | null = null;

/** The browser's own zone. On a server this is the server's zone, so treat it as client-only. */
export function localZone(): string {
  if (localZoneCache !== null) return localZoneCache;
  try {
    localZoneCache = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    localZoneCache = "UTC";
  }
  return localZoneCache;
}

/** Forget the memoised browser zone; for tests that change `process.env.TZ`. */
export function resetLocalZoneCache(): void {
  localZoneCache = null;
}

const validCache = new Map<string, boolean>();

/** Does the runtime know this IANA id? */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  const hit = validCache.get(timeZone);
  if (hit !== undefined) return hit;
  let ok = true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    ok = false;
  }
  validCache.set(timeZone, ok);
  return ok;
}

/** `timeZone` if the runtime knows it, otherwise `fallback`. */
export function coerceTimeZone(
  timeZone: string | undefined,
  fallback: string = localZone(),
): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : fallback;
}

const canonCache = new Map<string, string>();

/** The runtime's own spelling of a zone id (IANA aliases: `Asia/Calcutta` vs `Asia/Kolkata`). */
export function canonicalZone(timeZone: string): string {
  const hit = canonCache.get(timeZone);
  if (hit !== undefined) return hit;
  let out = timeZone;
  try {
    out = new Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions().timeZone || timeZone;
  } catch {}
  canonCache.set(timeZone, out);
  return out;
}

/** Do these two ids name the same zone? Alias-aware; zones that merely share an offset are not equal. */
export function sameZone(a: string | undefined, b: string | undefined): boolean {
  if ((a ?? "") === (b ?? "")) return true;
  if (!a || !b) return false;
  return canonicalZone(a) === canonicalZone(b);
}

/** What a clock in `timeZone` reads at `instant`. Sub-second precision is dropped. */
export function wallClockIn(instant: InstantLike, timeZone: string): ZoneWallClock {
  const ms = toMs(instant);
  const parts = partsFormatter(timeZone).formatToParts(new Date(ms));
  let year = 0;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let bc = false;
  for (const p of parts) {
    switch (p.type) {
      case "year":
        year = Number(p.value);
        break;
      case "month":
        month = Number(p.value);
        break;
      case "day":
        day = Number(p.value);
        break;
      case "hour":
        // some older ICU builds emit "24" for midnight despite `hourCycle: "h23"`
        hour = Number(p.value) % 24;
        break;
      case "minute":
        minute = Number(p.value);
        break;
      case "second":
        second = Number(p.value);
        break;
      case "era":
        bc = p.value !== "AD";
        break;
    }
  }
  // `Intl` counts BC years from 1; `Date`'s proleptic numbering has a year 0
  return { year: bc ? 1 - year : year, month, day, hour, minute, second };
}

/**
 * Offset from UTC at `instant`, in minutes EAST (`+330` for Asia/Kolkata) — the RFC 3339 sign,
 * i.e. the OPPOSITE of `Date.prototype.getTimezoneOffset`. Rounded to whole minutes.
 */
export function zoneOffsetMinutes(instant: InstantLike, timeZone: string): number {
  const ms = toMs(instant);
  if (Number.isNaN(ms)) return 0;
  const w = wallClockIn(ms, timeZone);
  const asUTC = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // Date.UTC maps years 0-99 to 1900+n
  const utc = w.year >= 0 && w.year < 100 ? new Date(asUTC).setUTCFullYear(w.year) : asUTC;
  return Math.round((utc - Math.floor(ms / 1000) * 1000) / MS_PER_MINUTE);
}

/** `"+05:45"`, `"-08:00"`, `"+00:00"` — the offset as RFC 3339 spells it. */
export function zoneOffsetLabel(instant: InstantLike, timeZone: string): string {
  const off = zoneOffsetMinutes(instant, timeZone);
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

/** `"unique"`: one instant; `"gap"`: none (spring forward); `"overlap"`: two (fall back). */
export type WallClockKind = "unique" | "gap" | "overlap";

export interface WallClockResolution {
  /** the chosen instant in epoch ms */
  instant: number;
  kind: WallClockKind;
  /** the earlier candidate */
  earlier: number;
  /** the later candidate; equals `earlier` when unique */
  later: number;
}

/**
 * Policy for a gap or overlap. `"compatible"` (Temporal's rule): gap shifts forward, overlap takes the
 * earlier instant. `"earlier"`/`"later"` force a side of an overlap. `"reject"` returns `NaN` for either.
 */
export type Disambiguation = "compatible" | "earlier" | "later" | "reject";

/**
 * Resolve a wall clock in a zone to an instant, reporting whether it was unique, a gap or an overlap.
 * Probes the offset ±1 day around the naive UTC reading (probing at the naive moment itself misses
 * the fall-back overlap) and round-trips each candidate, which stays correct for 30-minute transitions.
 */
export function resolveWallClock(
  parts: ZoneWallClock,
  timeZone: string,
  disambiguation: Disambiguation = "compatible",
): WallClockResolution {
  const naive = utcFromParts(parts);
  const offA = zoneOffsetMinutes(naive - MS_PER_DAY, timeZone);
  const offB = zoneOffsetMinutes(naive + MS_PER_DAY, timeZone);

  const candA = naive - offA * MS_PER_MINUTE;
  const candB = naive - offB * MS_PER_MINUTE;
  const lo = Math.min(candA, candB);
  const hi = Math.max(candA, candB);

  if (candA === candB) {
    return { instant: candA, kind: "unique", earlier: candA, later: candA };
  }

  const loOk = readsAs(lo, timeZone, parts);
  const hiOk = readsAs(hi, timeZone, parts);

  if (loOk && hiOk) {
    const instant = disambiguation === "reject" ? NaN : disambiguation === "later" ? hi : lo;
    return { instant, kind: "overlap", earlier: lo, later: hi };
  }
  if (loOk || hiOk) {
    const instant = loOk ? lo : hi;
    return { instant, kind: "unique", earlier: instant, later: instant };
  }
  // gap: `hi` is built from the pre-transition offset, i.e. the wall time shifted forward past the gap
  return {
    instant: disambiguation === "reject" ? NaN : hi,
    kind: "gap",
    earlier: lo,
    later: hi,
  };
}

/** Parts read as UTC. */
function utcFromParts(p: ZoneWallClock): number {
  const ms = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second ?? 0);
  return p.year >= 0 && p.year < 100 ? new Date(ms).setUTCFullYear(p.year) : ms;
}

/** Does `instant` read as exactly these parts in this zone? */
function readsAs(instant: number, timeZone: string, parts: ZoneWallClock): boolean {
  const w = wallClockIn(instant, timeZone);
  return (
    w.year === parts.year &&
    w.month === parts.month &&
    w.day === parts.day &&
    w.hour === parts.hour &&
    w.minute === parts.minute &&
    w.second === (parts.second ?? 0)
  );
}

/**
 * Inverse of `wallClockIn`; gap/overlap resolved per {@link Disambiguation}. `NaN` for `"reject"` or
 * an unknown zone. `parts` normalise the way `Date.UTC` does (month 13, day 0, minute 90 all roll).
 */
export function instantFromWallClock(
  parts: ZoneWallClock,
  timeZone: string,
  disambiguation: Disambiguation = "compatible",
): number {
  if (!isValidTimeZone(timeZone)) return NaN;
  return resolveWallClock(parts, timeZone, disambiguation).instant;
}

/**
 * A proxy `Date` whose LOCAL getters read `timeZone`'s wall clock at `instant`. Not a moment:
 * `getTime()` is a fiction, convert back with `unzonedInstant`. Identity when `timeZone` is the browser's.
 */
export function zonedDate(instant: InstantLike, timeZone: string): Date {
  const ms = toMs(instant);
  if (Number.isNaN(ms)) return new Date(NaN);
  if (sameZone(timeZone, localZone())) return new Date(ms);
  const w = wallClockIn(ms, timeZone);
  const d = new Date(w.year, w.month - 1, w.day, w.hour, w.minute, w.second, 0);
  // the `Date(y, …)` constructor maps 0-99 to 1900+n
  if (w.year >= 0 && w.year < 100) d.setFullYear(w.year);
  return d;
}

/** Inverse of `zonedDate`: epoch ms at which `timeZone` reads the proxy's wall clock, or `NaN`. */
export function unzonedInstant(
  proxy: Date,
  timeZone: string,
  disambiguation: Disambiguation = "compatible",
): number {
  const t = proxy.getTime();
  if (Number.isNaN(t)) return NaN;
  if (sameZone(timeZone, localZone())) return t;
  return instantFromWallClock(
    {
      year: proxy.getFullYear(),
      month: proxy.getMonth() + 1,
      day: proxy.getDate(),
      hour: proxy.getHours(),
      minute: proxy.getMinutes(),
      second: proxy.getSeconds(),
    },
    timeZone,
    disambiguation,
  );
}

/** An offset-qualified `Instant` written with `timeZone`'s offset — `"2026-08-07T09:00:00+01:00"`. */
export function formatInstantInZone(instant: InstantLike, timeZone: string): Instant {
  const ms = toMs(instant);
  if (Number.isNaN(ms)) return "";
  const w = wallClockIn(ms, timeZone);
  const y =
    w.year < 0
      ? `-${String(-w.year).padStart(6, "0")}`
      : w.year > 9999
        ? `+${String(w.year).padStart(6, "0")}`
        : String(w.year).padStart(4, "0");
  const off = zoneOffsetMinutes(ms, timeZone);
  const zone =
    off === 0
      ? "Z"
      : `${off < 0 ? "-" : "+"}${pad2(Math.floor(Math.abs(off) / 60))}:${pad2(Math.abs(off) % 60)}`;
  return (
    `${y}-${pad2(w.month)}-${pad2(w.day)}` +
    `T${pad2(w.hour)}:${pad2(w.minute)}:${pad2(w.second)}${zone}`
  );
}

/** Short zone label — `"BST"`, `"PDT"`, `"GMT+5:30"`. ICU-build dependent; a label, never an identifier. */
export function zoneAbbr(instant: InstantLike, timeZone: string): string {
  const ms = toMs(instant);
  try {
    const part = formatter(
      `abbr:${timeZone}`,
      () => new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }),
    )
      .formatToParts(new Date(ms))
      .find((p) => p.type === "timeZoneName");
    if (part) return part.value;
  } catch {}
  return zoneCityLabel(timeZone);
}

/** The long name — `"British Summer Time"`; falls back to the city label. */
export function zoneLongName(instant: InstantLike, timeZone: string, locale?: string): string {
  try {
    const part = formatter(
      `long:${locale ?? ""}:${timeZone}`,
      () => new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "long" }),
    )
      .formatToParts(new Date(toMs(instant)))
      .find((p) => p.type === "timeZoneName");
    if (part) return part.value;
  } catch {}
  return zoneCityLabel(timeZone);
}

/** A gutter row's label — `"9 AM"`, `"12:45 AM"`, `"09"`, `"17:45"`. Minutes are dropped on the hour. */
export function hourLabel(hour: number, minute: number, hour12: boolean): string {
  if (!hour12) {
    return minute === 0 ? pad2(hour) : `${pad2(hour)}:${pad2(minute)}`;
  }
  const period = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? `${h} ${period}` : `${h}:${pad2(minute)} ${period}`;
}

/** `"Europe/London"` → `"London"`, `"America/New_York"` → `"New York"`. */
/** City names for ids whose last segment is an old or clipped spelling. */
const CITY_NAMES: Readonly<Record<string, string>> = {
  Calcutta: "Kolkata",
  Katmandu: "Kathmandu",
  Saigon: "Ho Chi Minh City",
  Ho_Chi_Minh: "Ho Chi Minh City",
  Kiev: "Kyiv",
  Rangoon: "Yangon",
  Thimbu: "Thimphu",
  Dacca: "Dhaka",
  Macao: "Macau",
  Godthab: "Nuuk",
  Faeroe: "Faroe",
  Truk: "Chuuk",
  Ponape: "Pohnpei",
};

export function zoneCityLabel(timeZone: string): string {
  const tail = timeZone.split("/").pop() ?? timeZone;
  return CITY_NAMES[tail] ?? tail.replace(/_/g, " ");
}

/** Format a moment as it reads in a zone; a cached `Intl.DateTimeFormat` wrapper. */
export function formatInZone(
  instant: InstantLike,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" },
  locale?: string,
): string {
  const ms = toMs(instant);
  if (Number.isNaN(ms)) return "";
  try {
    return formatter(
      `f:${locale ?? ""}:${timeZone}:${JSON.stringify(options)}`,
      () => new Intl.DateTimeFormat(locale, { ...options, timeZone }),
    ).format(new Date(ms));
  } catch {
    return "";
  }
}

/** One row of a zone picker. */
export interface ZoneOption {
  /** IANA id */
  id: string;
  /** the city, de-underscored */
  label: string;
  /** the part before the slash */
  region: string;
}

/** Curated shortlist for a picker's default state, including the fractional-offset and odd-DST zones. */
export const COMMON_ZONES: readonly string[] = [
  "UTC",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Atlantic/Reykjavik",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Kyiv",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Asia/Jerusalem",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Sydney",
  "Australia/Lord_Howe",
  "Pacific/Auckland",
  "Pacific/Chatham",
  "Pacific/Kiritimati",
];

/** Current IANA spellings for ids ICU still reports under their old names (`Asia/Saigon`, `Europe/Kiev`…). */
const MODERN_SPELLINGS: readonly string[] = [
  "Asia/Ho_Chi_Minh",
  "Asia/Yangon",
  "Asia/Thimphu",
  "Asia/Macau",
  "Europe/Kyiv",
  "America/Nuuk",
  "Atlantic/Faroe",
  "Pacific/Chuuk",
  "Pacific/Pohnpei",
];

const toOption = (id: string): ZoneOption => ({
  id,
  label: zoneCityLabel(id),
  region: id.includes("/") ? id.split("/")[0] : "Other",
});

/** The curated shortlist as picker rows; unknown ids filtered out. */
export function listCommonZones(): ZoneOption[] {
  return COMMON_ZONES.filter(isValidTimeZone).map(toOption);
}

/**
 * Every zone the runtime knows, as picker rows sorted by id; the curated list when `supportedValuesOf`
 * is missing. Curated ids are merged first so their spelling wins over ICU's alias; deduped by `canonicalZone`.
 */
export function listAllZones(): ZoneOption[] {
  const byCanonical = new Map<string, string>();
  for (const id of [...COMMON_ZONES, ...MODERN_SPELLINGS]) {
    if (isValidTimeZone(id)) byCanonical.set(canonicalZone(id), id);
  }
  const withSupported = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  try {
    for (const id of withSupported.supportedValuesOf?.("timeZone") ?? []) {
      const key = canonicalZone(id);
      if (!byCanonical.has(key)) byCanonical.set(key, id);
    }
  } catch {}
  return [...byCanonical.values()].sort().map(toOption);
}

/** Lowercase, accents stripped, separators collapsed: "São_Paulo" and "sao paulo" meet in the middle. */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, " ")
    .trim();

const OFFSET_QUERY = /^(?:utc|gmt)?\s*(?:([+\-\u2212])\s*(\d{1,2})(?::?(\d{2}))?)?$/;

/** "+5:30", "utc-8", "gmt" → minutes east of UTC; anything else → null. */
function offsetQuery(q: string): number | null {
  const m = OFFSET_QUERY.exec(q);
  if (!m || q === "") return null;
  if (m[1] === undefined) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "+" ? minutes : -minutes;
}

const abbrCache = new Map<string, readonly string[]>();

/** The short names a zone goes by across the year ("pst", "pdt", "bst", "cet"), from `Intl`. */
function abbreviations(timeZone: string): readonly string[] {
  const hit = abbrCache.get(timeZone);
  if (hit) return hit;
  const year = new Date().getUTCFullYear();
  const names = new Set<string>();
  for (const locale of ["en-US", "en-GB"]) {
    try {
      const fmt = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" });
      for (const month of [0, 6]) {
        const name = fmt
          .formatToParts(new Date(Date.UTC(year, month, 15)))
          .find((p) => p.type === "timeZoneName")?.value;
        // "GMT+1" is an offset, which `offsetQuery` already answers
        if (name && /^[A-Za-z]+$/.test(name)) names.add(name.toLowerCase());
      }
    } catch {}
  }
  const out = [...names];
  abbrCache.set(timeZone, out);
  return out;
}

/**
 * Zone rows matching a query, best first: a city prefix, then an abbreviation ("pst") or a
 * UTC offset ("+5:30") the zone is on, then a substring of the city, the id or its old spelling.
 * Accents are ignored in both directions. An empty query returns the shortlist.
 */
export function searchZones(query: string, pool?: ZoneOption[]): ZoneOption[] {
  const q = fold(query);
  if (!q) return pool ?? listCommonZones();
  const rows = pool ?? listAllZones();
  const offset = offsetQuery(q);
  const abbreviation = /^[a-z]{2,5}$/.test(q);
  const now = Date.now();
  const scored: { row: ZoneOption; score: number }[] = [];
  for (const row of rows) {
    const label = fold(row.label);
    if (label.startsWith(q)) scored.push({ row, score: 0 });
    else if (offset !== null && zoneOffsetMinutes(now, row.id) === offset)
      scored.push({ row, score: 1 });
    else if (abbreviation && abbreviations(row.id).includes(q)) scored.push({ row, score: 1 });
    else if (label.includes(q)) scored.push({ row, score: 2 });
    else if (fold(row.id).includes(q) || fold(canonicalZone(row.id)).includes(q))
      scored.push({ row, score: 3 });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.row.label.localeCompare(b.row.label))
    .map((s) => s.row);
}

/** One extra zone column in the gutter. */
export interface TimeZoneColumn {
  /** IANA zone id */
  timeZone: string;
  /** override the auto-derived heading */
  label?: string;
}

/** `"Asia/Tokyo"` or `{ timeZone: "Asia/Tokyo" }` → the object form. */
export const normalizeZoneColumn = (z: string | TimeZoneColumn): TimeZoneColumn =>
  typeof z === "string" ? { timeZone: z } : z;

/** Normalise a zone-column list: object form, unknown zones dropped, duplicates removed. */
export function normalizeZoneColumns(
  zones: readonly (string | TimeZoneColumn)[] | undefined,
): TimeZoneColumn[] {
  if (!zones?.length) return [];
  const out: TimeZoneColumn[] = [];
  const seen = new Set<string>();
  for (const z of zones) {
    const col = normalizeZoneColumn(z);
    if (!isValidTimeZone(col.timeZone) || seen.has(col.timeZone)) continue;
    seen.add(col.timeZone);
    out.push(col);
  }
  return out;
}

/** Is the authored zone known and different from the display zone? */
export function isForeignZone(eventZone: string | undefined, displayZone: string): boolean {
  return !!eventZone && isValidTimeZone(eventZone) && !sameZone(eventZone, displayZone);
}

/** `"9:00 AM"` — the event's own clock in its authored zone. */
export function formatAuthoredTime(
  instant: InstantLike,
  eventZone: string,
  opts: { locale?: string; hour12?: boolean } = {},
): string {
  return formatInZone(
    instant,
    eventZone,
    {
      hour: "numeric",
      minute: "2-digit",
      ...(opts.hour12 === undefined ? {} : { hour12: opts.hour12 }),
    },
    opts.locale,
  );
}

/** `"9:00 AM – 10:00 AM GMT+1 · London"`, or `""` when the zone is absent, unknown, or the display zone. */
export function describeAuthoredZone(
  start: InstantLike,
  end: InstantLike,
  eventZone: string | undefined,
  displayZone: string,
  opts: { locale?: string; hour12?: boolean } = {},
): string {
  if (!isForeignZone(eventZone, displayZone)) return "";
  const zone = eventZone!;
  const a = formatAuthoredTime(start, zone, opts);
  const b = formatAuthoredTime(end, zone, opts);
  return `${a} – ${b} ${zoneAbbr(start, zone)} · ${zoneCityLabel(zone)}`;
}
