import type { CaptionLine } from "./types";

/** Enough to scroll back through a few minutes; small enough that a long meeting cannot grow state. */
export const CAPTION_BUFFER_LINES = 50;
/** How long a finished line stays on screen once nobody has said anything more. */
export const CAPTION_LINGER_MS = 6_000;
/** How many lines the strip shows at once: two finals and whatever is being said right now. */
export const CAPTION_VISIBLE_LINES = 3;

/**
 * Folds one transcription result into the caption buffer. A recogniser emits a growing interim
 * line and then a final one for the same utterance: the interim from the same participant is
 * replaced in place, and the final replaces it too and then stays. Always a new array.
 */
export function appendCaption(lines: readonly CaptionLine[], line: CaptionLine): CaptionLine[] {
  const interimIndex = lines.findIndex(
    (existing) => !existing.final && existing.participantId === line.participantId
  );
  const next =
    interimIndex === -1
      ? [...lines, line]
      : [...lines.slice(0, interimIndex), line, ...lines.slice(interimIndex + 1)];
  return next.length > CAPTION_BUFFER_LINES ? next.slice(next.length - CAPTION_BUFFER_LINES) : next;
}

/** The lines the strip shows: the newest few, and none that has gone stale. */
export function visibleCaptions(lines: readonly CaptionLine[], now: number): CaptionLine[] {
  const fresh = lines.filter((line) => !line.final || now - line.at < CAPTION_LINGER_MS);
  return fresh.slice(Math.max(0, fresh.length - CAPTION_VISIBLE_LINES));
}
