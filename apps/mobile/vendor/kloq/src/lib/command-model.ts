import {
  addDays,
  formatInstant,
  type Instant,
  isDateOnly,
  parseInstant,
  toDateOnlyString,
} from "./instant";
/** The pure half of the ⌘K menu: grouping, ordering and query matching. */

/** Built-in group order; anything else renders after it in registration order. */
export const COMMAND_GROUPS = [
  "Quick add",
  "Events",
  "Calendar",
  "Navigation",
  "View",
  "Appearance",
  "App",
] as const;

export type BuiltInCommandGroup = (typeof COMMAND_GROUPS)[number];

/** Group for a command that doesn't name one. */
export const DEFAULT_COMMAND_GROUP = "Commands";

/**
 * Every built-in ⌘K command, as ids. A `:*` entry is a family whose members are
 * minted at render time: `event:*` the search results, `jump:*` the visible-day
 * jumps, `view:*` the view switches, `range:*` prev/next, `scheme:*` light/dark/system.
 * Spread and filter this for `commandPalette.commands`; a family can also be
 * narrowed to exact ids (`"view:week"`).
 */
export const BUILT_IN_COMMANDS = [
  "quick-add:query",
  "event:*",
  "new-event",
  "quick-add",
  "move-to",
  "reset",
  "today",
  "go-to-date",
  "range:*",
  "jump:*",
  "view:*",
  "scheme:*",
  "theme:picker",
  "design-mode",
  "shortcuts",
] as const;

export type BuiltInCommand = (typeof BUILT_IN_COMMANDS)[number];

/** Is `id` in the allowlist? Entries match exactly, or a whole family via a `:*` suffix. */
export function commandAllowed(id: string, allowed: readonly string[] | undefined): boolean {
  if (!allowed) return true;
  return allowed.some(
    (entry) => entry === id || (entry.endsWith(":*") && id.startsWith(entry.slice(0, -1))),
  );
}

export interface CommandGroupModel<T> {
  value: string;
  items: T[];
}

interface Groupable {
  group?: string;
  order?: number;
}

/** Lowercase, diacritics stripped, whitespace collapsed. */
export function normalizeQuery(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Every token of `query` must appear in `haystack` (AND, substring, any order). Empty matches all. */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  const hay = normalizeQuery(haystack);
  return q.split(" ").every((token) => hay.includes(token));
}

/** Bucket commands into ordered groups: `groupOrder` first, then first-seen; stable sort on `order` within. */
export function groupCommands<T extends Groupable>(
  commands: readonly T[],
  groupOrder: readonly string[] = COMMAND_GROUPS,
  fallbackGroup: string = DEFAULT_COMMAND_GROUP,
): CommandGroupModel<T>[] {
  const buckets = new Map<string, T[]>();
  for (const c of commands) {
    const name = c.group ?? fallbackGroup;
    const bucket = buckets.get(name);
    if (bucket) bucket.push(c);
    else buckets.set(name, [c]);
  }

  const rank = new Map(groupOrder.map((name, i) => [name, i]));
  const out: CommandGroupModel<T>[] = [];
  for (const [value, items] of buckets) {
    out.push({ value, items: [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) });
  }

  const seen = [...buckets.keys()];
  out.sort((a, b) => {
    const ra = rank.get(a.value);
    const rb = rank.get(b.value);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return seen.indexOf(a.value) - seen.indexOf(b.value);
  });
  return out;
}

/** Past this many visible days the per-day "Jump to" rows are dropped in favour of the typed-date jump. */
export const MAX_DAY_JUMPS = 14;

export function dayJumps<T>(days: readonly T[]): readonly T[] {
  return days.length > MAX_DAY_JUMPS ? [] : days;
}

/** A read-only event is never offered an edit command. */
export function canEditEvent(event: { readOnly?: boolean } | null | undefined): boolean {
  return event != null && event.readOnly !== true;
}

const DAY_MS = 86_400_000;

/**
 * The start/end a "Move to…" writes. An all-day event stays all-day: the target's
 * date moves it and its day span is kept; a typed time is ignored.
 */
export function movePatch(
  event: { start: Instant; end: Instant; allDay?: boolean },
  target: { start: Date; end: Date },
  timeZone?: string,
): { start: Instant; end: Instant } {
  if (event.allDay === true || isDateOnly(event.start)) {
    const span = Math.max(
      1,
      Math.round((parseInstant(event.end) - parseInstant(event.start)) / DAY_MS),
    );
    return {
      start: toDateOnlyString(target.start),
      end: toDateOnlyString(addDays(target.start, Number.isNaN(span) ? 1 : span)),
    };
  }
  return {
    start: formatInstant(target.start, timeZone),
    end: formatInstant(target.end, timeZone),
  };
}
