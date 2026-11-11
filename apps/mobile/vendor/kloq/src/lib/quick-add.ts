/**
 * Natural-language quick add: one line of typing → a draft event plus the source offsets of every
 * phrase consumed. `now` is a parameter; all dates are local; passes claim spans in priority order.
 */

import { MINUTES_PER_DAY, MS_PER_DAY, MS_PER_MINUTE } from "./date-math";

export type QuickAddTokenKind = "date" | "time" | "duration" | "location" | "attendee";

export interface QuickAddToken {
  /** exact source text claimed, including connectors */
  text: string;
  /** inclusive start offset */
  start: number;
  /** exclusive end offset */
  end: number;
  kind: QuickAddTokenKind;
}

export interface QuickAddOptions {
  /** how to read `12/08` when both halves could be a month; default `"month-first"` */
  dateOrder?: "month-first" | "day-first";
  /** fallback length for a start with no end; default 30 */
  defaultDurationMin?: number;
}

export interface QuickAddResult {
  /** the input with every `tokens` and `ignored` phrase stripped */
  title: string;
  /** `null` only for blank input */
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  /** `null` for all-day */
  durationMin: number | null;
  /** emails found in the input, deduped case-insensitively */
  attendees: string[];
  location: string | null;
  /** `"full"` when both a day and a time (or explicit all-day) were recognised */
  confidence: "none" | "partial" | "full";
  /** every span applied to the result, sorted by source offset */
  tokens: QuickAddToken[];
  /** spans understood but overruled (a length beside a range); applied to nothing, sorted by source offset */
  ignored: QuickAddToken[];
}

interface Day {
  y: number;
  m: number;
  d: number;
}

const dayOf = (date: Date): Day => ({
  y: date.getFullYear(),
  m: date.getMonth(),
  d: date.getDate(),
});

const addDays = (day: Day, delta: number): Day => {
  const d = new Date(day.y, day.m, day.d + delta);
  return dayOf(d);
};

const at = (day: Day, hour: number, minute: number) =>
  new Date(day.y, day.m, day.d, hour, minute, 0, 0);

const startOfDay = (day: Day) => at(day, 0, 0);

const dayIndex = (day: Day) => new Date(day.y, day.m, day.d).getDay();

const daySerial = (day: Day) => Math.round(new Date(day.y, day.m, day.d).getTime() / MS_PER_DAY);

const sameDay = (a: Day, b: Day) => a.y === b.y && a.m === b.m && a.d === b.d;

// strictly after `now`: at exactly 10:30 propose 11:00
function nextHalfHour(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  const mins = now.getMinutes();
  d.setMinutes(mins < 30 ? 30 : 60);
  return d;
}

class Claims {
  readonly tokens: QuickAddToken[] = [];
  readonly ignored: QuickAddToken[] = [];
  private readonly input: string;
  private readonly taken: boolean[];

  constructor(input: string) {
    this.input = input;
    this.taken = new Array(input.length).fill(false);
  }

  free(start: number, end: number): boolean {
    if (start >= end || start < 0 || end > this.input.length) return false;
    for (let i = start; i < end; i++) if (this.taken[i]) return false;
    return true;
  }

  get size(): number {
    return this.tokens.length + this.ignored.length;
  }

  /** `into = this.ignored` consumes a span that was understood but will not be applied. */
  claim(
    start: number,
    end: number,
    kind: QuickAddTokenKind,
    into: QuickAddToken[] = this.tokens,
  ): QuickAddToken | null {
    let s = start;
    let e = end;
    while (s < e && /\s/.test(this.input[s])) s++;
    while (e > s && /\s/.test(this.input[e - 1])) e--;
    if (!this.free(s, e)) return null;
    for (let i = s; i < e; i++) this.taken[i] = true;
    const token: QuickAddToken = { text: this.input.slice(s, e), start: s, end: e, kind };
    into.push(token);
    return token;
  }

  /** Move matching claims to `ignored`: still consumed, no longer applied. */
  overrule(match: (t: QuickAddToken) => boolean): void {
    for (let n = this.tokens.length - 1; n >= 0; n--) {
      if (match(this.tokens[n])) this.ignored.push(...this.tokens.splice(n, 1));
    }
  }

  isTaken(i: number): boolean {
    return i >= 0 && i < this.taken.length && this.taken[i];
  }

  nextClaimFrom(from: number): number {
    for (let i = from; i < this.taken.length; i++) if (this.taken[i]) return i;
    return this.taken.length;
  }

  dateTokenEndsBefore(i: number): boolean {
    let j = i;
    while (j > 0 && /\s/.test(this.input[j - 1])) j--;
    return this.tokens.some((t) => t.kind === "date" && t.end === j);
  }
}

interface Atom {
  hour: number;
  minute: number;
  meridiem: "am" | "pm" | null;
  /** `noon`, `midnight`, zero-padded `07:30` — never re-interpreted */
  literal: boolean;
}

const ATOM_SRC = String.raw`(?:noon|midday|midnight|\d{1,2}(?::\d{2})?(?:\s*(?:a\.m\.|p\.m\.|am|pm))?)`;

function parseAtom(raw: string): Atom | null {
  const text = raw.trim().toLowerCase();
  if (text === "noon" || text === "midday")
    return { hour: 12, minute: 0, meridiem: null, literal: true };
  if (text === "midnight") return { hour: 0, minute: 0, meridiem: null, literal: true };

  const m = /^(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)?$/.exec(text);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const mer = m[3] ? (m[3][0] === "a" ? "am" : "pm") : null;
  if (minute > 59) return null;
  if (mer) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (mer === "pm" ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return { hour, minute, meridiem: mer, literal: /^0\d/.test(m[1]) };
}

// words that put a bare hour in the evening: `dinner at 7` is 19:00, `standup at 7` is 07:00
const EVENING_WORDS = "dinner|drinks|tonight|evening|night";
const EVENING_CUE = new RegExp(String.raw`\b(?:${EVENING_WORDS})\b`, "i");
const AFTER_EVENING_WORD = new RegExp(String.raw`\b(?:${EVENING_WORDS})\s+$`, "i");
const ENDS_PHRASE = /^\s*(?:$|[,;]|\.(?!\d)|(?:with|at|on|today|tomorrow)\b)/i;

// bare hour with no am/pm: 1–6 is afternoon, 7–11 is morning unless the phrase says evening, 12 is noon
function daytime(atom: Atom, evening = false): { hour: number; minute: number } {
  if (atom.meridiem || atom.literal) return { hour: atom.hour, minute: atom.minute };
  const h = atom.hour;
  if ((h >= 1 && h <= 6) || (evening && h >= 7 && h <= 11))
    return { hour: h + 12, minute: atom.minute };
  return { hour: h, minute: atom.minute };
}

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};
const MONTH_SRC = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tues: 2,
  tue: 2,
  wednesday: 3,
  weds: 3,
  wed: 3,
  thursday: 4,
  thurs: 4,
  thur: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};
const WEEKDAY_SRC = Object.keys(WEEKDAYS)
  .sort((a, b) => b.length - a.length)
  .join("|");

const LOCATION_STOP = new Set([
  "",
  "at",
  "on",
  "in",
  "to",
  "the",
  "a",
  "an",
  "and",
  "with",
  "for",
  "from",
]);

// longest inverted range read as overnight rather than a typo: `5pm-9am` yes, `2pm-1pm` no
const MAX_OVERNIGHT_MIN = 18 * 60;

// furthest `in <n> hours` reaches before it stops reading as a start time
const MAX_OFFSET_MIN = 7 * MINUTES_PER_DAY;

const PART_OF_DAY: Record<string, number> = {
  morning: 9,
  afternoon: 14,
  evening: 19,
  night: 19,
  tonight: 19,
};

const toMinutes = (qty: number, unit: string) =>
  Math.round(unit.toLowerCase().startsWith("h") ? qty * 60 : qty);

// `in` is mostly prose or an offset, so it names a place only in three shapes, each ending the phrase:
//   in the|my|our … <noun>   in the Blue Room · in the main conference room · in my office
//   in room|rm <id>          in room 4b · in Rm 12
//   in <Name…> <noun>        in Berlin office
const PLACE_NOUN = "(?:[Bb]oardroom|[Rr]oom|[Oo]ffice|[Bb]uilding|[Hh]all|[Ss]tudio|[Ll]ab)";
const PLACE_NAME = String.raw`\p{Lu}[\p{L}\p{N}'’&.-]*`;
const PLACE_WORD = String.raw`(?!(?:at|on|in|to|of|the|a|an|and|with|for|from)\s)\p{Ll}+`;
const IN_PLACE = new RegExp(
  "^(?:" +
    String.raw`(?:the|my|our)\s+(?:(?:${PLACE_NAME}\s+)+|(?:${PLACE_WORD}\s+){0,2})${PLACE_NOUN}(?:\s+\d+[A-Za-z]?)?` +
    String.raw`|[Rr](?:oom|m)\s+(?:\d+[A-Za-z]?|\p{Lu}[\p{L}\p{N}]*)` +
    String.raw`|(?:${PLACE_NAME}\s+)+${PLACE_NOUN}` +
    ")" +
    String.raw`(?![\p{L}\p{N}])(?=\s*(?:$|[,;:()!?.]|(?:with|w\/|at|for|on|from|to|and)\s|@))`,
  "u",
);

// Bare `friday` is the next Friday at or after today (today counts); `next friday` is always a week later.
function resolveWeekday(now: Day, target: number, qualifier: "next" | "last" | null): Day {
  const delta = (target - dayIndex(now) + 7) % 7;
  const base = addDays(now, delta);
  if (qualifier === "next") return addDays(base, 7);
  if (qualifier === "last") return addDays(base, -7);
  return base;
}

interface DayClaim {
  token: QuickAddToken;
  day: Day | null;
  /** from "tonight" / "this afternoon"; used only if no clock time */
  hour: number | null;
}

interface Found {
  day: Day | null;
  hour: number | null;
  minute: number;
  endHour: number | null;
  endMinute: number;
  /** the range crossed midnight */
  endNextDay: boolean;
  /** the day `in 2 hours` lands on; used only if no day was named */
  offsetDay: Day | null;
  impliedHour: number | null;
  durationMin: number | null;
  allDay: boolean;
  location: string | null;
  attendees: string[];
}

export function parseQuickAdd(
  input: string,
  now: Date,
  opts: QuickAddOptions = {},
): QuickAddResult {
  const dateOrder = opts.dateOrder ?? "month-first";
  const defaultDurationMin = opts.defaultDurationMin ?? 30;

  if (!input || !input.trim()) {
    return {
      title: "",
      start: null,
      end: null,
      allDay: false,
      durationMin: null,
      attendees: [],
      location: null,
      confidence: "none",
      tokens: [],
      ignored: [],
    };
  }

  const claims = new Claims(input);
  const today = dayOf(now);
  const found: Found = {
    day: null,
    hour: null,
    minute: 0,
    endHour: null,
    endMinute: 0,
    endNextDay: false,
    offsetDay: null,
    impliedHour: null,
    durationMin: null,
    allDay: false,
    location: null,
    attendees: [],
  };

  // on a rejected match the cursor rewinds to just past its start so a shorter reading gets a turn
  const scan = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const before = claims.size;
      if (claims.free(m.index, m.index + m[0].length)) fn(m);
      if (claims.size === before) re.lastIndex = m.index + 1;
    }
  };

  // attendees first, so `sam+3pm@acme.com` can never be mined for a time
  const seen = new Set<string>();
  scan(
    /(\bwith\s+|\bw\/\s*)?([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g,
    (m) => {
      const email = m[2];
      const key = email.toLowerCase();
      if (!claims.claim(m.index, m.index + m[0].length, "attendee")) return;
      if (!seen.has(key)) {
        seen.add(key);
        found.attendees.push(email);
      }
    },
  );

  scan(/\ball[-\s]?day\b/gi, (m) => {
    if (claims.claim(m.index, m.index + m[0].length, "date")) found.allDay = true;
  });

  const evening = EVENING_CUE.test(input);
  // `drinks 8`, `dinner 7-9`: bare hours straight after an evening word, ending the phrase
  const afterEveningWord = (m: RegExpExecArray) =>
    AFTER_EVENING_WORD.test(input.slice(0, m.index)) &&
    ENDS_PHRASE.test(input.slice(m.index + m[0].length));
  const clockHour = (atom: Atom | null) => atom !== null && atom.hour >= 1 && atom.hour <= 12;

  // the first length is the length; any other is understood but not applied
  const takeDuration = (m: RegExpExecArray, minutes: number) => {
    const end = m.index + m[0].length;
    if (found.durationMin !== null) claims.claim(m.index, end, "duration", claims.ignored);
    else if (claims.claim(m.index, end, "duration")) found.durationMin = minutes;
  };

  // `in 10 minutes`, `in an hour`: an offset from now, not a length
  const takeOffset = (m: RegExpExecArray, minutes: number) => {
    if (minutes <= 0 || minutes > MAX_OFFSET_MIN || found.hour !== null) return;
    if (!claims.claim(m.index, m.index + m[0].length, "time")) return;
    const then = new Date(now.getTime() + minutes * MS_PER_MINUTE);
    found.hour = then.getHours();
    found.minute = then.getMinutes();
    found.offsetDay = dayOf(then);
  };

  // hours and minutes side by side are one length: `1 hour 30 minutes`, `1h30m`, `an hour and 15 min`
  scan(
    /\b(for\s+|in\s+)?(?:an?\s+(?:hours?|hrs?)|(\d+(?:\.\d+)?)(?:\s*(?:hours?|hrs?)|h))\s*(?:and\s+)?(\d+)(?:\s*(?:minutes?|mins?)|m)\b/gi,
    (m) => {
      const minutes = Math.round((m[2] ? Number(m[2]) : 1) * 60) + Number(m[3]);
      if (!Number.isFinite(minutes)) return;
      if (m[1]?.toLowerCase().startsWith("in")) takeOffset(m, minutes);
      else if (minutes > 0 && minutes <= MINUTES_PER_DAY) takeDuration(m, minutes);
    },
  );

  scan(/\bfor\s+(half\s+an?|an?|\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi, (m) => {
    const word = m[1].toLowerCase();
    const qty = word.startsWith("half") ? 0.5 : word === "a" || word === "an" ? 1 : Number(m[1]);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const minutes = toMinutes(qty, m[2]);
    if (minutes <= 0) return;
    takeDuration(m, minutes);
  });

  scan(
    /\bin\s+(?:(half\s+an?|an?)\s+(hours?|hrs?|minutes?|mins?)|(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m))\b/gi,
    (m) => {
      const qty = m[1] ? (m[1].toLowerCase().startsWith("half") ? 0.5 : 1) : Number(m[3]);
      takeOffset(m, toMinutes(qty, m[2] ?? m[4]));
    },
  );

  // bare durations: a spaced number needs a spelled-out unit ("90 minutes"); attached takes short units ("1h")
  if (found.durationMin === null) {
    scan(
      /\b(?:(half\s+an?|an?|a\s+half)\s+(hours?|hrs?)|(\d+(?:\.\d+)?)\s+(hours?|hrs?|minutes?|mins?)|(\d+(?:\.\d+)?)(hours?|hrs?|h|minutes?|mins?|m))\b/gi,
      (m) => {
        const worded = m[1]?.toLowerCase();
        const qty = worded
          ? worded.startsWith("half") || worded.endsWith("half")
            ? 0.5
            : 1
          : Number(m[3] ?? m[5]);
        const unit = m[2] ?? m[4] ?? m[6] ?? "";
        if (!Number.isFinite(qty) || qty <= 0 || !unit) return;
        const minutes = toMinutes(qty, unit);
        if (minutes <= 0 || minutes > 24 * 60) return;
        takeDuration(m, minutes);
      },
    );
  }

  const dayClaims: DayClaim[] = [];
  const takeDay = (m: RegExpExecArray, day: Day | null, hour: number | null = null) => {
    const token = claims.claim(m.index, m.index + m[0].length, "date");
    if (token) dayClaims.push({ token, day, hour });
  };

  scan(/\b(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/gi, (m) => {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let month: number;
    let dayNum: number;
    if (a > 12 && b <= 12) {
      dayNum = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      dayNum = b;
    } else if (dateOrder === "day-first") {
      dayNum = a;
      month = b;
    } else {
      month = a;
      dayNum = b;
    }
    if (month < 1 || month > 12 || dayNum < 1 || dayNum > 31) return;
    const year = m[3] ? normaliseYear(Number(m[3])) : null;
    const day = resolveYear(today, month - 1, dayNum, year);
    if (day) takeDay(m, day);
  });

  const dayMonth = new RegExp(
    String.raw`\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH_SRC})\b\.?(?:,?\s+(\d{4}))?`,
    "gi",
  );
  const monthDay = new RegExp(
    String.raw`\b(?:on\s+)?(${MONTH_SRC})\b\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?`,
    "gi",
  );
  const takeMonthDay = (
    monthWord: string,
    dayWord: string,
    yearWord: string | undefined,
    m: RegExpExecArray,
  ) => {
    const month = MONTHS[monthWord.toLowerCase()];
    const dayNum = Number(dayWord);
    if (month === undefined || dayNum < 1 || dayNum > 31) return;
    const day = resolveYear(
      today,
      month,
      dayNum,
      yearWord ? normaliseYear(Number(yearWord)) : null,
    );
    if (day) takeDay(m, day);
  };
  scan(dayMonth, (m) => takeMonthDay(m[2], m[1], m[3], m));
  scan(monthDay, (m) => takeMonthDay(m[1], m[2], m[3], m));

  scan(
    /\b(today|tonight|tomorrow|tomorow|tmrw|tmw|tmr|yesterday|next\s+week|next\s+weekend|this\s+weekend)\b/gi,
    (m) => {
      const word = m[1].toLowerCase().replace(/\s+/g, " ");
      let day: Day;
      if (word === "today" || word === "tonight") day = today;
      else if (word === "yesterday") day = addDays(today, -1);
      else if (word === "next week") day = addDays(today, 7);
      else if (word === "this weekend") day = resolveWeekday(today, 6, null);
      else if (word === "next weekend") day = resolveWeekday(today, 6, "next");
      else day = addDays(today, 1);
      takeDay(m, day, word === "tonight" ? PART_OF_DAY.tonight : null);
    },
  );

  scan(
    new RegExp(String.raw`\b(?:(next|this|last|coming|on)\s+)?(${WEEKDAY_SRC})\b`, "gi"),
    (m) => {
      const qualWord = m[1]?.toLowerCase();
      const qualifier: "next" | "last" | null =
        qualWord === "next" ? "next" : qualWord === "last" ? "last" : null;
      const target = WEEKDAYS[m[2].toLowerCase()];
      if (target === undefined) return;
      if (!m[1] && looksLikeVenue(input, m)) return;
      takeDay(m, resolveWeekday(today, target, qualifier));
    },
  );

  // a bare "morning" only counts when it trails a day we already understood
  scan(/\b(?:(this|tomorrow)\s+)?(morning|afternoon|evening|night)\b/gi, (m) => {
    const prefix = m[1]?.toLowerCase();
    if (!prefix && !claims.dateTokenEndsBefore(m.index)) return;
    const hour = PART_OF_DAY[m[2].toLowerCase()];
    if (hour === undefined) return;
    takeDay(m, prefix === "tomorrow" ? addDays(today, 1) : prefix ? today : null, hour);
  });

  // ranges before single times, so `1-2pm` is never shredded into `1` and `2pm`
  scan(
    new RegExp(
      String.raw`\b(from\s+)?(${ATOM_SRC})\s*(?:-|–|—|\bto\b|\buntil\b|\btill\b)\s*(${ATOM_SRC})(?!\w)`,
      "gi",
    ),
    (m) => {
      if (found.hour !== null) return;
      const left = parseAtom(m[2]);
      const right = parseAtom(m[3]);
      if (!left || !right) return;
      // two bare numbers need a strong signal (`from`, meridiem, named hour, colon): "sprint 2 to 4" is prose
      if (
        !m[1] &&
        !/[a-z:]/i.test(m[2] + m[3]) &&
        !(clockHour(left) && clockHour(right) && afterEveningWord(m))
      )
        return;

      let s = { hour: left.hour, minute: left.minute };
      let e = { hour: right.hour, minute: right.minute };
      const asMin = (t: { hour: number; minute: number }) => t.hour * 60 + t.minute;

      if (left.meridiem === null && !left.literal && right.meridiem !== null) {
        // `1-2pm` borrows the right's meridiem unless that inverts the range ("11-1pm")
        const borrowed = (left.hour % 12) + (right.meridiem === "pm" ? 12 : 0);
        s = { hour: left.hour <= 12 ? borrowed : left.hour, minute: left.minute };
        if (asMin(s) >= asMin(e) && left.hour <= 12) {
          s = { hour: (left.hour % 12) + (right.meridiem === "pm" ? 0 : 12), minute: left.minute };
        }
      } else {
        s = daytime(left, evening);
        // "7 to noon": the afternoon reading gives way when a fixed end would precede it
        if (right.literal && asMin(s) >= asMin(e) && asMin(left) < asMin(e)) {
          s = { hour: left.hour, minute: left.minute };
        }
      }

      if (right.meridiem === null && !right.literal) {
        if (left.meridiem !== null || left.literal || right.hour <= 12) {
          // carry the start's half of the day, then push forward a meridiem if it would end before it starts
          const sameHalf = (right.hour % 12) + (s.hour >= 12 ? 12 : 0);
          e = { hour: right.hour <= 12 ? sameHalf : right.hour, minute: right.minute };
          if (asMin(e) <= asMin(s) && right.hour <= 12) {
            e = { hour: (right.hour % 12) + 12, minute: right.minute };
          }
        } else {
          e = daytime(right, evening);
        }
      }

      // still inverted: overnight when the length is plausible, otherwise a typo that keeps only its start
      const inverted = asMin(e) <= asMin(s);
      const overnightMin = MINUTES_PER_DAY - asMin(s) + asMin(e);
      const typo = inverted && overnightMin > MAX_OVERNIGHT_MIN;
      // a bare end past midnight is the small hours, not the next afternoon: `9pm to 2`
      const bareEnd = right.meridiem === null && !right.literal && right.hour <= 12;
      if (inverted && !typo && bareEnd && e.hour >= 12) e = { hour: e.hour - 12, minute: e.minute };
      const end = m.index + m[0].length;
      const startEnd = typo ? m.index + (m[1]?.length ?? 0) + m[2].length : end;
      if (!claims.claim(m.index, startEnd, "time")) return;
      found.hour = s.hour;
      found.minute = s.minute;
      if (typo) {
        claims.claim(startEnd, end, "time", claims.ignored);
        return;
      }
      found.endHour = e.hour;
      found.endMinute = e.minute;
      found.endNextDay = inverted;
    },
  );

  const takeTime = (atom: Atom | null, m: RegExpExecArray) => {
    if (!atom || found.hour !== null) return;
    if (!claims.claim(m.index, m.index + m[0].length, "time")) return;
    const t = daytime(atom, evening);
    found.hour = t.hour;
    found.minute = t.minute;
  };
  scan(/(?:\bat\s+|@\s*|\b)(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)(?!\w)/gi, (m) =>
    takeTime(parseAtom(`${m[1]}${m[2] ? `:${m[2]}` : ""}${m[3]}`), m),
  );
  // a bare number has to be introduced by `at`
  scan(/\bat\s+(\d{1,2})(?::(\d{2}))?\b(?!\s+[A-Z][a-z])/g, (m) =>
    takeTime(parseAtom(`${m[1]}${m[2] ? `:${m[2]}` : ""}`), m),
  );
  scan(/\b(\d{1,2}):(\d{2})\b/g, (m) => takeTime(parseAtom(`${m[1]}:${m[2]}`), m));
  scan(/\b(noon|midday|midnight)\b/gi, (m) => takeTime(parseAtom(m[1]), m));
  scan(/\b\d{1,2}\b/g, (m) => {
    const atom = parseAtom(m[0]);
    if (clockHour(atom) && afterEveningWord(m)) takeTime(atom, m);
  });

  // location runs last: every time-shaped `at` is already claimed, so a remaining `at` is a place
  // `at` needs whitespace after it (Atlas, Attend); `@` may be glued (@Padella, dinner@Padella)
  const conn = /(^|\s)at\s+|@\s*/gi;
  let cm: RegExpExecArray | null;
  while ((cm = conn.exec(input))) {
    const connStart = cm.index + (cm[1]?.length ?? 0);
    const textStart = cm.index + cm[0].length;
    if (!claims.free(connStart, textStart) || claims.isTaken(textStart)) continue;
    let stop = claims.nextClaimFrom(textStart);
    const cut = input.slice(textStart, stop).search(/[,;(]|\s(?:with|w\/|at|for|on|from)\s|\s@/i);
    if (cut >= 0) stop = textStart + cut;
    const raw = input.slice(textStart, stop);
    const value = raw.replace(/[\s.,;]+$/, "");
    if (!value || /^\d[\d:.]*(?:\s*(?:am|pm))?$/i.test(value)) continue;
    if (!value.split(/\s+/).some((w) => !LOCATION_STOP.has(w.toLowerCase().replace(/[^a-z]/g, ""))))
      continue;
    const token = claims.claim(connStart, textStart + value.length, "location");
    if (token) {
      found.location = value.trim();
      break;
    }
  }

  if (found.location === null) {
    const inConn = /(^|\s)in(?=\s)/g;
    let im: RegExpExecArray | null;
    while ((im = inConn.exec(input))) {
      const connStart = im.index + im[1].length;
      let textStart = connStart + 2;
      while (/\s/.test(input[textStart] ?? "")) textStart++;
      if (!claims.free(connStart, textStart) || claims.isTaken(textStart)) continue;
      const pm = IN_PLACE.exec(input.slice(textStart, claims.nextClaimFrom(textStart)));
      if (!pm) continue;
      const value = pm[0];
      if (claims.claim(connStart, textStart + value.length, "location")) {
        found.location = value;
        break;
      }
    }
  }

  // the first day written is the day; a part of day supplies the hour only when no clock time does
  dayClaims.sort((a, b) => a.token.start - b.token.start);
  found.day = dayClaims.find((c) => c.day !== null)?.day ?? null;
  found.impliedHour = dayClaims.find((c) => c.hour !== null)?.hour ?? null;
  const impliedApplies = !found.allDay && found.hour === null;
  const unapplied = new Set(
    dayClaims
      .filter(
        (c) =>
          !(c.day !== null && found.day !== null && sameDay(c.day, found.day)) &&
          !(c.hour !== null && impliedApplies && c.hour === found.impliedHour),
      )
      .map((c) => c.token),
  );
  claims.overrule((t) => unapplied.has(t));

  // all day has no clock time and no length; a range already says how long
  if (found.allDay) claims.overrule((t) => t.kind === "time");
  if (found.allDay || found.endHour !== null) {
    claims.overrule((t) => t.kind === "duration");
    found.durationMin = null;
  }

  claims.tokens.sort((a, b) => a.start - b.start);
  claims.ignored.sort((a, b) => a.start - b.start);

  const hasTime = found.hour !== null || found.impliedHour !== null;
  const hasDate = found.day !== null || found.allDay || found.offsetDay !== null;
  const allDay = found.allDay || (found.day !== null && !hasTime && found.durationMin === null);

  let start: Date;
  let end: Date;

  if (allDay) {
    const day = found.day ?? today;
    start = startOfDay(day);
    // inclusive end day
    end = startOfDay(day);
  } else if (found.hour !== null || found.impliedHour !== null) {
    const hour = found.hour ?? found.impliedHour!;
    const minute = found.hour !== null ? found.minute : 0;
    // a time with no day is today, or tomorrow if today's has already passed
    let day = found.day ?? found.offsetDay;
    if (!day) {
      day = today;
      if (at(day, hour, minute).getTime() < now.getTime()) day = addDays(today, 1);
    }
    start = at(day, hour, minute);
    if (found.endHour !== null) {
      const endDay = found.endNextDay ? addDays(day, 1) : day;
      end = at(endDay, found.endHour, found.endMinute);
    } else {
      end = new Date(start.getTime() + (found.durationMin ?? defaultDurationMin) * MS_PER_MINUTE);
    }
  } else {
    start = nextHalfHour(now);
    // a day with a length but no time: the default slot if it falls on that day, otherwise the morning
    if (found.day && !sameDay(dayOf(start), found.day)) {
      start = sameDay(found.day, today) ? at(today, 23, 30) : at(found.day, PART_OF_DAY.morning, 0);
    }
    end = new Date(start.getTime() + (found.durationMin ?? defaultDurationMin) * MS_PER_MINUTE);
  }

  if (!allDay && end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + defaultDurationMin * MS_PER_MINUTE);
  }

  const confidence: QuickAddResult["confidence"] =
    claims.tokens.length === 0
      ? "none"
      : (hasDate && hasTime) || (hasDate && allDay)
        ? "full"
        : "partial";

  return {
    title: stripTitle(input, [...claims.tokens, ...claims.ignored]),
    start,
    end,
    allDay,
    durationMin: allDay ? null : Math.round((end.getTime() - start.getTime()) / MS_PER_MINUTE),
    attendees: found.attendees,
    location: found.location,
    confidence,
    tokens: claims.tokens,
    ignored: claims.ignored,
  };
}

const normaliseYear = (n: number) => (n < 100 ? 2000 + n : n);

// a bare `12 Aug` is the next occurrence: this year if not passed (today counts), else next year
function resolveYear(today: Day, month: number, dayNum: number, year: number | null): Day | null {
  const build = (y: number): Day | null => {
    const d = new Date(y, month, dayNum);
    // rejects 31 Feb, which JS would roll forward
    return d.getMonth() === month && d.getDate() === dayNum ? dayOf(d) : null;
  };
  if (year !== null) return build(year);
  const thisYear = build(today.y);
  if (!thisYear) return null;
  return daySerial(thisYear) >= daySerial(today) ? thisYear : build(today.y + 1);
}

/** `at Sat Bains`, `@ May Fair`: a day-word right after a place connector, followed by a capitalised word. */
function looksLikeVenue(input: string, m: RegExpExecArray): boolean {
  return (
    /(?:\bat|@)\s*$/i.test(input.slice(0, m.index)) &&
    /^\s+[A-Z][a-z]/.test(input.slice(m.index + m[0].length))
  );
}

const CONNECTOR = "and|with|w\\/|on|at|from|for|to|in|@";
const ORPHAN_BEFORE = new RegExp(String.raw`(?:^|\s)(?:${CONNECTOR})\s*$`, "i");
const EDGE = /^(?:(?:and|on|at|from|for|to|in|@)(?=\s|$)|[-–—,;.:])\s*/i;
const EDGE_END = new RegExp(String.raw`\s*(?:(?<=\s|^)(?:${CONNECTOR})|[-–—,;.:])$`, "i");

function stripTitle(input: string, tokens: QuickAddToken[]): string {
  // nothing consumed means nothing can be an orphan; "at at at" must not tidy to nothing
  if (tokens.length === 0) return input.replace(/\s+/g, " ").trim();

  let out = "";
  let cursor = 0;
  for (const t of [...tokens].sort((a, b) => a.start - b.start)) {
    // a connector left dangling right before a claimed span was introducing it
    out += input.slice(cursor, t.start).replace(ORPHAN_BEFORE, " ");
    out += " ";
    cursor = t.end;
  }
  out += input.slice(cursor);

  out = out
    .replace(/[([<]\s*[)\]>]/g, " ")
    .replace(/(?:\s*[,;])+/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  let prev: string;
  do {
    prev = out;
    out = out.replace(EDGE, "").replace(EDGE_END, "").trim();
  } while (out !== prev);
  return out.replace(/\s+/g, " ").trim();
}
