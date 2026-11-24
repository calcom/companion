/**
 * Collision-safe ids. Two users, two tabs or two devices minting in the same
 * millisecond must never agree, so there is no counter and no clock in here.
 */
export function randomId(prefix = "ev"): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return `${prefix}-${c.randomUUID()}`;
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(16));
    let hex = "";
    for (const b of bytes) hex += b.toString(16).padStart(2, "0");
    return `${prefix}-${hex}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

const SEGMENT_TAIL = /@\d+$/;
const OCCURRENCE_TAIL = /#\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2}))?$/;

/**
 * Development-only checks on the ids a host hands in. Each string is one
 * problem, phrased for a console. Empty when everything is fine.
 *
 * The package composes placement ids as `${id}#${occurrenceStart}@${segment}`,
 * so a host id that already ends in either suffix is read back as a different
 * event. Duplicates are silently merged by every lookup.
 */
export function validateEventIds(events: readonly { id: string }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const e of events) {
    const id = e.id;
    if (typeof id !== "string" || id === "") {
      out.push("kloq: an event has an empty id — every event needs a unique, non-empty string id");
      continue;
    }
    if (seen.has(id)) dup.add(id);
    seen.add(id);
    if (SEGMENT_TAIL.test(id))
      out.push(
        `kloq: event id "${id}" ends in "@<digits>", which kloq reads as a cross-midnight segment suffix — pick an id that does not end that way`,
      );
    else if (OCCURRENCE_TAIL.test(id))
      out.push(
        `kloq: event id "${id}" ends in "#<date>", which kloq reads as a recurrence occurrence suffix — pick an id that does not end that way`,
      );
  }
  for (const id of dup)
    out.push(
      `kloq: duplicate event id "${id}" — lookups, updates and removes will hit every event sharing it`,
    );
  return out;
}
