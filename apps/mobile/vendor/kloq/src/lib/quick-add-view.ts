/** The pure shape of what the quick-add field draws: highlight segments and the preview line. */

import { formatWhen } from "./event-search";
import type { QuickAddResult, QuickAddToken, QuickAddTokenKind } from "./quick-add";

/** A run of the input: understood (`kind` set) or plain text. */
export interface QuickAddSegment {
  text: string;
  kind: QuickAddTokenKind | null;
  /** understood but overruled: not applied to the result */
  ignored?: boolean;
}

/** Interleave the input with its tokens. Concatenating the segments always reproduces the input exactly. */
export function highlightSegments(
  input: string,
  tokens: readonly QuickAddToken[],
  ignored?: readonly QuickAddToken[],
): QuickAddSegment[] {
  const overruled = new Set(ignored);
  const spans = overruled.size
    ? [...tokens, ...overruled].sort((a, b) => a.start - b.start)
    : tokens;
  const out: QuickAddSegment[] = [];
  let cursor = 0;
  for (const t of spans) {
    // an overlapping or backwards token would desync the overlay from the input
    if (t.start < cursor || t.end > input.length || t.end <= t.start) continue;
    if (t.start > cursor) out.push({ text: input.slice(cursor, t.start), kind: null });
    const text = input.slice(t.start, t.end);
    out.push(overruled.has(t) ? { text, kind: t.kind, ignored: true } : { text, kind: t.kind });
    cursor = t.end;
  }
  if (cursor < input.length) out.push({ text: input.slice(cursor), kind: null });
  return out;
}

/** What the preview line under the field says. */
export interface QuickAddPreview {
  /** never blank */
  title: string;
  /** resolved date/time/duration, or `null` */
  when: string | null;
  /** location, attendees */
  chips: string[];
  confidence: QuickAddResult["confidence"];
}

export const UNTITLED = "New event";

export function quickAddPreview(result: QuickAddResult, now: Date): QuickAddPreview {
  const chips: string[] = [];
  if (result.location) chips.push(result.location);
  for (const a of result.attendees) chips.push(a);
  return {
    title: result.title.trim() || UNTITLED,
    when:
      result.start && result.end
        ? // the parser's all-day `end` is already the inclusive last day
          formatWhen(result.start, result.end, result.allDay, now)
        : null,
    chips,
    confidence: result.confidence,
  };
}
