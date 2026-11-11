/**
 * RFC 5545 `RRULE` parsing, serialisation, and human-readable description. Pure data, no timezone
 * conversion. Parsing never throws; unrecognised properties round-trip on `extra`.
 */

import { daysInMonth, pad } from "./date-math";

/** Supported frequencies. `SECONDLY`/`MINUTELY`/`HOURLY` are rejected by {@link parseRRule}. */
export type RRuleFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

/** RFC 5545 two-letter weekday codes, Sunday-first to match `Date#getDay`. */
export type RRuleWeekday = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";

/** One `BYDAY` entry. `ordinal` is the `2` in `2MO` or the `-1` in `-1FR`. */
export interface RRuleByDay {
  weekday: RRuleWeekday;
  ordinal?: number;
}

/** `UNTIL`, kept as literal calendar fields rather than a `Date` so it round-trips byte-stable. */
export interface RRuleUntil {
  year: number;
  /** 1–12, not zero-based */
  month: number;
  /** 1–31 */
  day: number;
  /** present iff the source used the date-time form */
  time?: { hour: number; minute: number; second: number };
  /** present iff the date-time form carried the `Z` suffix */
  utc?: boolean;
}

/** A property parsed structurally but not modelled; preserved verbatim. */
interface RRuleExtra {
  name: string;
  value: string;
}

/** Structured form of an `RRULE`. Every field beyond `freq` is optional. */
export interface RRuleParts {
  freq: RRuleFreq;
  /** omitted when 1 */
  interval?: number;
  byDay?: RRuleByDay[];
  /** 1–31, or -1…-31 counting back from the end of the month. */
  byMonthDay?: number[];
  /** 1–12. */
  byMonth?: number[];
  /** Non-zero, -366…366. */
  bySetPos?: number[];
  /** Mutually exclusive with {@link until}. */
  count?: number;
  /** Mutually exclusive with {@link count}. */
  until?: RRuleUntil;
  /** week start; omitted when `MO` */
  wkst?: RRuleWeekday;
  /** unmodelled properties, round-tripped untouched; their presence makes {@link isExpressible} false */
  extra?: RRuleExtra[];
}

/** Index-aligned with `Date#getDay()`: `WEEKDAY_CODES[0] === "SU"`. */
export const WEEKDAY_CODES: readonly RRuleWeekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const WEEKDAY_INDEX: Record<RRuleWeekday, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const WORKWEEK: readonly RRuleWeekday[] = ["MO", "TU", "WE", "TH", "FR"];

/** `Date#getDay()` → RFC code. */
export const weekdayCodeOf = (date: Date): RRuleWeekday => WEEKDAY_CODES[date.getDay()];

/** Strict integer parse — rejects `"1.5"`, `"1e3"`, `" 1"`, and `""`. */
const toInt = (raw: string): number | null => {
  if (!/^[+-]?\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
};

const toIntList = (raw: string, ok: (n: number) => boolean): number[] | null => {
  if (raw === "") return null;
  const out: number[] = [];
  for (const item of raw.split(",")) {
    const n = toInt(item);
    if (n === null || !ok(n)) return null;
    out.push(n);
  }
  return out;
};

const listJoin = (items: string[], conjunction: string): string => {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
};

const FREQS: readonly string[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

const BYDAY_TOKEN = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/;

const UNTIL_FORM = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/;

const KNOWN = new Set([
  "FREQ",
  "INTERVAL",
  "BYDAY",
  "BYMONTHDAY",
  "BYMONTH",
  "BYSETPOS",
  "COUNT",
  "UNTIL",
  "WKST",
]);

const parseByDay = (raw: string): RRuleByDay[] | null => {
  if (raw === "") return null;
  const out: RRuleByDay[] = [];
  for (const token of raw.split(",")) {
    const m = BYDAY_TOKEN.exec(token);
    if (!m) return null;
    const weekday = m[2] as RRuleWeekday;
    if (m[1] === undefined) {
      out.push({ weekday });
      continue;
    }
    const ordinal = toInt(m[1]);
    // RFC 5545 allows ±1…53
    if (ordinal === null || ordinal === 0 || Math.abs(ordinal) > 53) {
      return null;
    }
    out.push({ weekday, ordinal });
  }
  return out;
};

const parseUntil = (raw: string): RRuleUntil | null => {
  const m = UNTIL_FORM.exec(raw);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  if (h === undefined) return { year, month, day };

  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  // 60 is the leap second RFC 5545 §3.3.12 permits
  if (hour > 23 || minute > 59 || second > 60) return null;
  const until: RRuleUntil = { year, month, day, time: { hour, minute, second } };
  if (z) until.utc = true;
  return until;
};

/**
 * Parses an `RRULE` into {@link RRuleParts}, or `null` if unusable. Tolerant of a `RRULE:` prefix,
 * case, whitespace and a trailing `;`; strict about anything that would change the rule's meaning.
 */
export const parseRRule = (rule: string): RRuleParts | null => {
  if (typeof rule !== "string") return null;

  let body = rule.trim();
  if (/^RRULE:/i.test(body)) body = body.slice(6).trim();
  body = body.replace(/;+$/, "");
  if (body === "") return null;

  const seen = new Set<string>();
  const parts: Partial<RRuleParts> = {};
  const extra: RRuleExtra[] = [];

  for (const segment of body.split(";")) {
    const eq = segment.indexOf("=");
    if (eq <= 0) return null;
    const name = segment.slice(0, eq).trim().toUpperCase();
    const value = segment.slice(eq + 1).trim();
    if (!/^[A-Z][A-Z0-9-]*$/.test(name)) return null;
    // RFC 5545 §3.3.10: each part at most once
    if (seen.has(name)) return null;
    seen.add(name);

    if (!KNOWN.has(name)) {
      if (value === "") return null;
      extra.push({ name, value });
      continue;
    }

    const upper = value.toUpperCase();
    switch (name) {
      case "FREQ": {
        if (!FREQS.includes(upper)) return null;
        parts.freq = upper as RRuleFreq;
        break;
      }
      case "INTERVAL": {
        const n = toInt(value);
        if (n === null || n < 1) return null;
        parts.interval = n;
        break;
      }
      case "BYDAY": {
        const byDay = parseByDay(upper);
        if (!byDay) return null;
        parts.byDay = byDay;
        break;
      }
      case "BYMONTHDAY": {
        const list = toIntList(value, (n) => n !== 0 && n >= -31 && n <= 31);
        if (!list) return null;
        parts.byMonthDay = list;
        break;
      }
      case "BYMONTH": {
        const list = toIntList(value, (n) => n >= 1 && n <= 12);
        if (!list) return null;
        parts.byMonth = list;
        break;
      }
      case "BYSETPOS": {
        const list = toIntList(value, (n) => n !== 0 && n >= -366 && n <= 366);
        if (!list) return null;
        parts.bySetPos = list;
        break;
      }
      case "COUNT": {
        const n = toInt(value);
        if (n === null || n < 1) return null;
        parts.count = n;
        break;
      }
      case "UNTIL": {
        const until = parseUntil(upper);
        if (!until) return null;
        parts.until = until;
        break;
      }
      case "WKST": {
        if (!WEEKDAY_CODES.includes(upper as RRuleWeekday)) return null;
        parts.wkst = upper as RRuleWeekday;
        break;
      }
    }
  }

  if (!parts.freq) return null;
  if (parts.count !== undefined && parts.until !== undefined) return null;
  if (extra.length > 0) parts.extra = extra;

  return parts as RRuleParts;
};

const orderIn = (weekday: RRuleWeekday, wkst: RRuleWeekday) =>
  (WEEKDAY_INDEX[weekday] - WEEKDAY_INDEX[wkst] + 7) % 7;

// Ordinal-carrying lists keep their authored order.
const sortByDay = (byDay: readonly RRuleByDay[], wkst: RRuleWeekday): RRuleByDay[] => {
  const list = [...byDay];
  if (list.some((d) => d.ordinal !== undefined)) return list;
  return list.sort((a, b) => orderIn(a.weekday, wkst) - orderIn(b.weekday, wkst));
};

const formatByDay = (d: RRuleByDay) =>
  d.ordinal === undefined ? d.weekday : `${d.ordinal}${d.weekday}`;

/** {@link RRuleUntil} back to its wire form. */
const formatUntilValue = (until: RRuleUntil): string => {
  const date = `${pad(until.year, 4)}${pad(until.month)}${pad(until.day)}`;
  if (!until.time) return date;
  const { hour, minute, second } = until.time;
  return `${date}T${pad(hour)}${pad(minute)}${pad(second)}${until.utc ? "Z" : ""}`;
};

interface SerializeOptions {
  /** emit the `RRULE:` prefix; off by default */
  prefix?: boolean;
}

/**
 * Serialises {@link RRuleParts} into an `RRULE` value with fixed property order and defaults omitted.
 * Throws `RangeError` if `count` and `until` are both set (RFC 5545 §3.3.10); use {@link withEnd}.
 */
export const serializeRRule = (parts: RRuleParts, opts: SerializeOptions = {}): string => {
  if (parts.count !== undefined && parts.until !== undefined) {
    throw new RangeError("RRULE cannot carry both COUNT and UNTIL (RFC 5545 §3.3.10)");
  }

  const wkst = parts.wkst ?? "MO";
  const segments: string[] = [`FREQ=${parts.freq}`];

  if (parts.interval !== undefined && parts.interval !== 1) {
    segments.push(`INTERVAL=${parts.interval}`);
  }
  if (parts.wkst !== undefined && parts.wkst !== "MO") {
    segments.push(`WKST=${parts.wkst}`);
  }
  if (parts.byMonth?.length) segments.push(`BYMONTH=${parts.byMonth.join(",")}`);
  if (parts.byMonthDay?.length) {
    segments.push(`BYMONTHDAY=${parts.byMonthDay.join(",")}`);
  }
  if (parts.byDay?.length) {
    segments.push(`BYDAY=${sortByDay(parts.byDay, wkst).map(formatByDay).join(",")}`);
  }
  if (parts.bySetPos?.length) {
    segments.push(`BYSETPOS=${parts.bySetPos.join(",")}`);
  }
  if (parts.count !== undefined) segments.push(`COUNT=${parts.count}`);
  if (parts.until !== undefined) {
    segments.push(`UNTIL=${formatUntilValue(parts.until)}`);
  }
  for (const { name, value } of parts.extra ?? []) {
    segments.push(`${name}=${value}`);
  }

  return (opts.prefix ? "RRULE:" : "") + segments.join(";");
};

/** The two mutually exclusive ways a series can end. */
export type RRuleEnd =
  | { type: "never" }
  | { type: "count"; count: number }
  | { type: "until"; until: RRuleUntil };

/** A copy of `parts` with exactly one end condition set. */
export const withEnd = (parts: RRuleParts, end: RRuleEnd): RRuleParts => {
  const rest: RRuleParts = { ...parts };
  delete rest.count;
  delete rest.until;
  if (end.type === "count") rest.count = end.count;
  if (end.type === "until") rest.until = end.until;
  return rest;
};

/** Reads the end condition off a rule. */
export const endOf = (parts: RRuleParts): RRuleEnd => {
  if (parts.count !== undefined) return { type: "count", count: parts.count };
  if (parts.until !== undefined) return { type: "until", until: parts.until };
  return { type: "never" };
};

/** {@link RRuleUntil} → a local `Date`, floating-time semantics. A `Z` suffix is deliberately not shifted. */
export const untilToDate = (until: RRuleUntil): Date =>
  new Date(
    until.year,
    until.month - 1,
    until.day,
    until.time?.hour ?? 0,
    until.time?.minute ?? 0,
    until.time?.second ?? 0,
    0,
  );

interface UntilFromDateOptions {
  /** emit the date-time form; default date-only */
  withTime?: boolean;
  /** append `Z` when emitting a time; default true */
  utc?: boolean;
}

/** A local `Date` → {@link RRuleUntil}, reading wall-clock fields. */
export const untilFromDate = (date: Date, opts: UntilFromDateOptions = {}): RRuleUntil => {
  const until: RRuleUntil = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
  if (opts.withTime) {
    until.time = {
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
    if (opts.utc !== false) until.utc = true;
  }
  return until;
};

/** Injectable names for {@link describeRRule}. */
export interface DescribeOptions {
  /** long weekday names, Sunday-first */
  weekdays?: readonly string[];
  /** short weekday names, Sunday-first */
  weekdaysShort?: readonly string[];
  /** long month names, January-first */
  months?: readonly string[];
  /** short month names, January-first */
  monthsShort?: readonly string[];
  /** positional words for `1MO`…`5MO` */
  ordinals?: readonly string[];
  /** word for the `-1` ordinal */
  lastOrdinal?: string;
  /** `UNTIL` → display string; default `12 Dec 2026` */
  formatUntil?: (until: RRuleUntil) => string;
  /** returned for rules that do not parse; default `"Custom rule"` */
  fallback?: string;
}

const DEFAULT_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const DEFAULT_WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const DEFAULT_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const DEFAULT_MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const DEFAULT_ORDINALS = ["first", "second", "third", "fourth", "fifth"] as const;

/** en-US defaults. */
export const DEFAULT_DESCRIBE_OPTIONS = {
  weekdays: DEFAULT_WEEKDAYS,
  weekdaysShort: DEFAULT_WEEKDAYS_SHORT,
  months: DEFAULT_MONTHS,
  monthsShort: DEFAULT_MONTHS_SHORT,
  ordinals: DEFAULT_ORDINALS,
  lastOrdinal: "last",
  fallback: "Custom rule",
} as const satisfies DescribeOptions;

interface Names {
  weekdays: readonly string[];
  weekdaysShort: readonly string[];
  months: readonly string[];
  monthsShort: readonly string[];
  ordinals: readonly string[];
  lastOrdinal: string;
  formatUntil: (until: RRuleUntil) => string;
  fallback: string;
}

const resolveNames = (opts: DescribeOptions = {}): Names => {
  const monthsShort = opts.monthsShort ?? DEFAULT_MONTHS_SHORT;
  return {
    weekdays: opts.weekdays ?? DEFAULT_WEEKDAYS,
    weekdaysShort: opts.weekdaysShort ?? DEFAULT_WEEKDAYS_SHORT,
    months: opts.months ?? DEFAULT_MONTHS,
    monthsShort,
    ordinals: opts.ordinals ?? DEFAULT_ORDINALS,
    lastOrdinal: opts.lastOrdinal ?? "last",
    formatUntil:
      opts.formatUntil ?? ((until) => `${until.day} ${monthsShort[until.month - 1]} ${until.year}`),
    fallback: opts.fallback ?? "Custom rule",
  };
};

const ordinalWord = (n: number, names: Names): string => {
  if (n === -1) return names.lastOrdinal;
  const magnitude = Math.abs(n);
  const word = names.ordinals[magnitude - 1] ?? `${magnitude}th`;
  return n < 0 ? `${word} to ${names.lastOrdinal}` : word;
};

const sameWeekdaySet = (byDay: readonly RRuleByDay[], expected: readonly RRuleWeekday[]) => {
  if (byDay.length !== expected.length) return false;
  if (byDay.some((d) => d.ordinal !== undefined)) return false;
  const got = new Set(byDay.map((d) => d.weekday));
  return got.size === expected.length && expected.every((w) => got.has(w));
};

const weekdayList = (
  byDay: readonly RRuleByDay[],
  wkst: RRuleWeekday,
  names: Names,
  conjunction = "and",
) =>
  listJoin(
    sortByDay(byDay, wkst).map((d) => names.weekdaysShort[WEEKDAY_INDEX[d.weekday]]),
    conjunction,
  );

// "on the <nth> <weekday>"; `BYDAY=3TU` and `BYDAY=TU;BYSETPOS=3` both spell it.
const nthWeekdayPhrase = (parts: RRuleParts, names: Names): string | null => {
  const byDay = parts.byDay;
  if (!byDay?.length) return null;

  const ordinals = byDay.map((d) => d.ordinal).filter((o): o is number => o !== undefined);
  const setPos = parts.bySetPos?.length === 1 ? parts.bySetPos[0] : undefined;

  let position: number | undefined;
  if (ordinals.length === byDay.length && new Set(ordinals).size === 1) {
    position = ordinals[0];
  } else if (ordinals.length === 0 && setPos !== undefined) {
    position = setPos;
  }
  if (position === undefined) return null;

  const wkst = parts.wkst ?? "MO";
  const subject = sameWeekdaySet(
    byDay.map((d) => ({ weekday: d.weekday })),
    WORKWEEK,
  )
    ? "weekday"
    : byDay.length === 1
      ? names.weekdays[WEEKDAY_INDEX[byDay[0].weekday]]
      : weekdayList(byDay, wkst, names, "or");

  return `the ${ordinalWord(position, names)} ${subject}`;
};

const monthDayPhrase = (days: readonly number[], names: Names): string => {
  const negatives = days.filter((d) => d < 0);
  if (negatives.length === days.length) {
    return listJoin(
      days.map((d) => `the ${ordinalWord(d, names)} day`),
      "and",
    );
  }
  const label = days.length === 1 ? "day" : "days";
  return `${label} ${listJoin(days.map(String), "and")}`;
};

const monthList = (months: readonly number[], names: Names) =>
  listJoin(
    months.map((m) => names.months[m - 1]),
    "and",
  );

const everyPhrase = (unit: string, interval: number) =>
  interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;

const describeDaily = (parts: RRuleParts, names: Names): string => {
  const base = everyPhrase("day", parts.interval ?? 1);
  const wkst = parts.wkst ?? "MO";
  return parts.byDay?.length ? `${base} on ${weekdayList(parts.byDay, wkst, names)}` : base;
};

const describeWeekly = (parts: RRuleParts, names: Names): string => {
  const interval = parts.interval ?? 1;
  const wkst = parts.wkst ?? "MO";
  const byDay = parts.byDay;

  if (interval === 1 && byDay && sameWeekdaySet(byDay, WORKWEEK)) {
    return "Every weekday";
  }

  const base = everyPhrase("week", interval);
  return byDay?.length ? `${base} on ${weekdayList(byDay, wkst, names)}` : base;
};

const monthlyClause = (parts: RRuleParts, names: Names): string | null => {
  const nth = nthWeekdayPhrase(parts, names);
  if (nth) return nth;
  if (parts.byMonthDay?.length) return monthDayPhrase(parts.byMonthDay, names);
  if (parts.byDay?.length) {
    return weekdayList(parts.byDay, parts.wkst ?? "MO", names);
  }
  return null;
};

const describeMonthly = (parts: RRuleParts, names: Names): string => {
  const base = everyPhrase("month", parts.interval ?? 1);
  const clause = monthlyClause(parts, names);
  return clause ? `${base} on ${clause}` : base;
};

const describeYearly = (parts: RRuleParts, names: Names): string => {
  const base = everyPhrase("year", parts.interval ?? 1);
  const months = parts.byMonth;
  const nth = nthWeekdayPhrase(parts, names);

  if (!months?.length) {
    const clause = monthlyClause(parts, names);
    return clause ? `${base} on ${clause}` : base;
  }

  if (nth) return `${base} on ${nth} of ${monthList(months, names)}`;

  if (parts.byMonthDay?.length === 1 && parts.byMonthDay[0] > 0) {
    return `${base} on ${parts.byMonthDay[0]} ${monthList(months, names)}`;
  }

  const clause = monthlyClause(parts, names);
  return clause
    ? `${base} in ${monthList(months, names)} on ${clause}`
    : `${base} in ${monthList(months, names)}`;
};

/** "Every 2 weeks on Mon and Wed, until 12 Dec 2026". Unparseable input returns `opts.fallback`. */
export const describeRRule = (rule: string | RRuleParts, opts: DescribeOptions = {}): string => {
  const names = resolveNames(opts);
  const parts = typeof rule === "string" ? parseRRule(rule) : rule;
  if (!parts) return names.fallback;

  let text: string;
  switch (parts.freq) {
    case "DAILY":
      text = describeDaily(parts, names);
      break;
    case "WEEKLY":
      text = describeWeekly(parts, names);
      break;
    case "MONTHLY":
      text = describeMonthly(parts, names);
      break;
    case "YEARLY":
      text = describeYearly(parts, names);
      break;
    default:
      return names.fallback;
  }

  if (parts.count !== undefined) {
    text += parts.count === 1 ? ", once" : `, ${parts.count} times`;
  } else if (parts.until !== undefined) {
    text += `, until ${names.formatUntil(parts.until)}`;
  }

  return text;
};

/**
 * Can the builder UI round-trip this rule without losing anything? Conservative: `true` promises
 * that opening the builder and saving reproduces the same rule.
 */
export const isExpressible = (rule: string | RRuleParts | null | undefined): boolean => {
  const parts = typeof rule === "string" ? parseRRule(rule) : rule;
  if (!parts) return false;
  if (!FREQS.includes(parts.freq)) return false;
  if (parts.extra?.length) return false;
  if (parts.count !== undefined && parts.until !== undefined) return false;
  if (parts.interval !== undefined && parts.interval < 1) return false;

  const byDay = parts.byDay ?? [];
  const byMonth = parts.byMonth ?? [];
  const byMonthDay = parts.byMonthDay ?? [];
  const bySetPos = parts.bySetPos ?? [];

  if (byMonth.length > 1 || byMonthDay.length > 1 || bySetPos.length > 1) {
    return false;
  }
  if (byDay.length > 0 && byMonthDay.length > 0) return false;
  // BYSETPOS in the builder means "the <nth> <weekday>" — exactly one named weekday
  if (bySetPos.length > 0 && byDay.length !== 1) return false;

  const ordinals = byDay.filter((d) => d.ordinal !== undefined);
  if (ordinals.length > 0) {
    if (byDay.length > 1) return false;
    if (bySetPos.length > 0) return false;
    const n = ordinals[0].ordinal as number;
    if (n === 0 || Math.abs(n) > 5) return false;
  }
  if (bySetPos.length === 1 && Math.abs(bySetPos[0]) > 5) return false;

  switch (parts.freq) {
    case "DAILY":
      return byDay.length === 0 && byMonthDay.length === 0 && byMonth.length === 0;
    case "WEEKLY":
      return (
        byMonthDay.length === 0 &&
        byMonth.length === 0 &&
        bySetPos.length === 0 &&
        ordinals.length === 0
      );
    case "MONTHLY":
      return byMonth.length === 0;
    case "YEARLY":
      return (
        byMonth.length === 1 ||
        (byMonth.length === 0 && byDay.length === 0 && byMonthDay.length === 0)
      );
    default:
      return false;
  }
};

export type PresetId =
  | "none"
  | "daily"
  | "weekly"
  | "weekdays"
  | "monthly-day"
  | "monthly-nth"
  | "yearly"
  | "custom";

/** Menu order, top to bottom. */
export const PRESET_IDS: readonly PresetId[] = [
  "none",
  "daily",
  "weekly",
  "weekdays",
  "monthly-day",
  "monthly-nth",
  "yearly",
  "custom",
];

export interface RRulePreset {
  id: PresetId;
  /** menu label, interpolated with the anchor date */
  label: string;
  /** `null` for `none` and for `custom`, which opens the builder */
  rule: string | null;
}

export interface PresetOptions extends DescribeOptions {
  noneLabel?: string;
  customLabel?: string;
}

/** Which occurrence of its weekday a date is within its month; `-1` when it is the last one. */
export const nthWeekdayOfMonth = (date: Date): number => {
  const day = date.getDate();
  const nth = Math.ceil(day / 7);
  const monthLength = daysInMonth(date.getFullYear(), date.getMonth() + 1);
  return day + 7 > monthLength ? -1 : nth;
};

/** The preset menu for an event starting on `date`. Labels are menu labels, not {@link describeRRule} summaries. */
export const presetsFor = (date: Date, opts: PresetOptions = {}): RRulePreset[] => {
  const names = resolveNames(opts);
  const weekday = weekdayCodeOf(date);
  const weekdayName = names.weekdays[date.getDay()];
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const nth = nthWeekdayOfMonth(date);
  const nthWord = ordinalWord(nth, names);

  return [
    { id: "none", label: opts.noneLabel ?? "Does not repeat", rule: null },
    { id: "daily", label: "Daily", rule: "FREQ=DAILY" },
    {
      id: "weekly",
      label: `Weekly on ${weekdayName}`,
      rule: `FREQ=WEEKLY;BYDAY=${weekday}`,
    },
    {
      id: "weekdays",
      label: "Every weekday (Mon–Fri)",
      rule: `FREQ=WEEKLY;BYDAY=${WORKWEEK.join(",")}`,
    },
    {
      id: "monthly-day",
      label: `Monthly on day ${dayOfMonth}`,
      rule: `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`,
    },
    {
      id: "monthly-nth",
      label: `Monthly on the ${nthWord} ${weekdayName}`,
      rule: `FREQ=MONTHLY;BYDAY=${nth}${weekday}`,
    },
    {
      id: "yearly",
      label: `Annually on ${dayOfMonth} ${names.months[month - 1]}`,
      rule: `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${dayOfMonth}`,
    },
    { id: "custom", label: opts.customLabel ?? "Custom…", rule: null },
  ];
};

/** Which preset a rule corresponds to, by normalised serialisation; `"none"` for absent, `"custom"` otherwise. */
export const presetIdFor = (rule: string | RRuleParts | null | undefined, date: Date): PresetId => {
  if (rule === null || rule === undefined || rule === "") return "none";
  const parts = typeof rule === "string" ? parseRRule(rule) : rule;
  if (!parts) return "custom";
  const normalised = serializeRRule(parts);
  for (const preset of presetsFor(date)) {
    if (!preset.rule) continue;
    const presetParts = parseRRule(preset.rule);
    if (presetParts && serializeRRule(presetParts) === normalised) {
      return preset.id;
    }
  }
  return "custom";
};
