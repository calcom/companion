"use client";

/**
 * Event state: `KloqStore` is the commit surface, implemented by the
 * uncontrolled `InternalStore` and a controlled facade over `events`/`onEventsChange`.
 */

import { useSyncExternalStore } from "react";
import {
  type CalEvent,
  type CalEventPatch,
  dateOnlyAfter,
  dateOnlyAt,
  instantAt,
  resolveView,
  type StoreId,
} from "./calendar-types";
import { randomId } from "./ids";
import { PAYLOAD_VERSION, type PayloadV2, readPayload } from "./migrate";
import { eventsStorageKey, storageEnabled } from "./storage";

/** Sample week anchored on the Monday-start week containing `now`; exercises every model field. */
export function buildSeedEvents(now: Date = new Date()): CalEvent[] {
  const w = resolveView("week", 1, now);
  const at = (day: number, min: number) => instantAt(w, day, min);

  return [
    {
      id: "seed-standup",
      title: "Standup",
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
      organizer: "ryan@example.com",
      reminders: [{ minutesBefore: 10 }],
      start: at(0, 9 * 60),
      end: at(0, 9 * 60 + 30),
      color: "blue",
      meetingUrl: "https://meet.google.com/eni-hyci-wma",
      attendees: [
        { email: "ryan@example.com", name: "Ryan Patel", status: "accepted" },
        { email: "sam@example.com", name: "Sam Rivera", status: "accepted" },
        { email: "mo@example.com", name: "Mo Haddad", status: "pending" },
      ],
    },
    {
      id: "seed-design",
      title: "Design review",
      start: at(1, 13 * 60),
      end: at(1, 14 * 60),
      color: "violet",
      description: "Walk the drag engine's settle springs frame by frame.",
      organizer: "jules@example.com",
      reminders: [{ minutesBefore: 30 }, { minutesBefore: 0 }],
      meetingUrl: "https://meet.google.com/qtr-bxfm-pod",
      attendees: [
        { email: "ryan@example.com", name: "Ryan Patel", status: "accepted" },
        { email: "jules@example.com", name: "Jules Okafor", status: "tentative" },
        { email: "dana@example.com", name: "Dana Ito", status: "declined" },
        { email: "notes@example.com", name: "Design notes", optional: true },
      ],
    },
    {
      id: "seed-deep",
      title: "Deep work",
      start: at(2, 10 * 60),
      end: at(2, 11 * 60 + 30),
      color: "emerald",
      busy: false,
    },
    {
      id: "seed-interview",
      title: "Interview — staff eng",
      start: at(2, 15 * 60),
      end: at(2, 15 * 60 + 45),
      color: "rose",
      location: "Room 4 — Blackfriars",
      organizer: "sam@example.com",
      reminders: [{ minutesBefore: 15 }, { minutesBefore: 60 * 24, method: "email" }],
      attendees: [
        { email: "candidate@example.com", name: "Alex Moreau", status: "accepted" },
        { email: "ryan@example.com", name: "Ryan Patel", status: "accepted" },
      ],
    },
    {
      // overlaps the interview and shares a guest, so the conflict warning shows on first load
      id: "seed-vendor",
      title: "Vendor call",
      start: at(2, 15 * 60 + 30),
      end: at(2, 16 * 60 + 15),
      color: "amber",
      attendees: [
        { email: "ryan@example.com", name: "Ryan Patel", status: "accepted" },
        { email: "vendor@example.com", name: "Priya Raman", status: "pending" },
      ],
    },
    {
      id: "seed-oneone",
      title: "1:1 with Ryan",
      rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=TH",
      start: at(3, 9 * 60 + 30),
      end: at(3, 10 * 60),
      color: "amber",
      attendees: [{ email: "ryan@example.com", name: "Ryan Patel", status: "accepted" }],
    },
    {
      id: "seed-lunch",
      title: "Lunch with Sam",
      start: at(4, 12 * 60),
      end: at(4, 13 * 60),
      color: "violet",
      location: "Padella, Borough Market",
      busy: false,
    },
    {
      // crosses midnight; the only seed exercising the split-segment path
      id: "seed-release",
      title: "Release window",
      start: at(4, 23 * 60),
      end: at(5, 1 * 60 + 30),
      color: "amber",
      description: "Deploy freeze lifts at 01:30.",
    },
    {
      // Thu + Fri: inclusive two-day span is an exclusive end on Saturday
      id: "seed-ooo",
      title: "OOO — Croatia",
      allDay: true,
      // BYWEEKNO is outside what the builder can express; exercises the "Custom rule" path
      rrule: "FREQ=YEARLY;BYWEEKNO=32",
      start: dateOnlyAt(w, 3),
      end: dateOnlyAfter(w, 4),
      color: "rose",
      busy: false,
      readOnly: true,
    },
  ];
}

/** The default seeds, resolved once at module load. */
export const SEED_EVENTS: CalEvent[] = buildSeedEvents();

export interface PersistenceAdapter {
  /** May be async; `null` means "no stored copy" (seeds stay). */
  load(): CalEvent[] | null | Promise<CalEvent[] | null>;
  /** Called only on committed changes — never mid-drag. */
  save(events: CalEvent[]): void | Promise<void>;
  /** Optional: wipe the stored copy (reset falls back to save(seeds)). */
  clear?(): void | Promise<void>;
}

/** Default storage key; the payload is versioned too, so the next change needn't bump it. */
export const STORAGE_KEY = "kloq:events:v2";

const read = (key: string): unknown => {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : undefined;
};

const write = (key: string, events: CalEvent[]) => {
  const payload: PayloadV2 = { v: PAYLOAD_VERSION, events };
  localStorage.setItem(key, JSON.stringify(payload));
};

const SAVE_DELAY_MS = 300;
/** A steady stream of commits still writes this often. */
const SAVE_MAX_WAIT_MS = 2000;

// Batching belongs to the built-in adapter alone. The queue is per storage key and shared by
// every adapter instance, so a remount on the same key always reads what the last one saved.
const queued = new Map<
  string,
  { events: CalEvent[]; since: number; timer: ReturnType<typeof setTimeout> }
>();
let listening = false;

function listen() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const want = queued.size > 0;
  if (want === listening) return;
  listening = want;
  const method = want ? "addEventListener" : "removeEventListener";
  window[method]("pagehide", flushWrites);
  document[method]("visibilitychange", flushIfHidden);
}

function dropWrite(key: string) {
  const q = queued.get(key);
  if (!q) return;
  clearTimeout(q.timer);
  queued.delete(key);
  listen();
}

function flushWrite(key: string) {
  const q = queued.get(key);
  if (!q) return;
  dropWrite(key);
  try {
    write(key, q.events);
  } catch {
    // quota / private mode — non-fatal
  }
}

function flushWrites() {
  for (const key of [...queued.keys()]) flushWrite(key);
}

function flushIfHidden() {
  if (document.visibilityState === "hidden") flushWrites();
}

function queueWrite(key: string, events: CalEvent[]) {
  const now = Date.now();
  const prev = queued.get(key);
  if (prev) clearTimeout(prev.timer);
  const since = prev?.since ?? now;
  const wait = Math.max(0, Math.min(SAVE_DELAY_MS, since + SAVE_MAX_WAIT_MS - now));
  queued.set(key, { events, since, timer: setTimeout(() => flushWrite(key), wait) });
  listen();
}

/**
 * The store's per-commit path for an adapter that batches. Only the built-in adapter is in
 * here; any other adapter gets `save` called synchronously on every commit.
 */
const batchers = new WeakMap<
  PersistenceAdapter,
  { queue(events: CalEvent[]): void; flush(): void }
>();

/**
 * localStorage persistence with a one-way v1 → v2 migration (see `lib/migrate`).
 * A migrated payload is written back immediately so the reinterpret happens once.
 * Calling `save` yourself writes at once; behind `<Kloq>` a burst of commits is one
 * write of the latest state, flushed when the page hides or the calendar unmounts.
 */
export function localStorageAdapter(key?: string): PersistenceAdapter {
  const k = () => key ?? eventsStorageKey();
  const mine = new Set<string>();
  const adapter: PersistenceAdapter = {
    load() {
      if (!storageEnabled()) return null;
      flushWrite(k());
      try {
        const result = readPayload(read(k()));
        if (result === null) return null;
        if (result.migrated) {
          try {
            write(k(), result.events);
          } catch {
            // quota / private mode — the migration still applies in memory
          }
        }
        return result.events;
      } catch {
        return null; // corrupted / private mode — keep seeds
      }
    },
    save(events) {
      if (!storageEnabled()) return;
      dropWrite(k());
      try {
        write(k(), events);
      } catch {
        // quota / private mode — non-fatal
      }
    },
    clear() {
      dropWrite(k());
      try {
        localStorage.removeItem(k());
      } catch {
        // non-fatal
      }
    },
  };
  batchers.set(adapter, {
    queue(events) {
      if (!storageEnabled()) return;
      // the key is fixed now, so a write queued under one prefix can't land under the next
      mine.add(k());
      queueWrite(k(), events);
    },
    flush() {
      for (const key of mine) flushWrite(key);
      mine.clear();
    },
  });
  return adapter;
}

// cast: TS can't see a patch flipping `allDay` and `start` together across the union
const applyPatch = (e: CalEvent, patch: CalEventPatch): CalEvent =>
  ({ ...e, ...patch }) as CalEvent;

export type KloqChange =
  | { type: "add"; event: CalEvent }
  | { type: "update"; id: string; patch: CalEventPatch; prev: CalEvent }
  | { type: "remove"; event: CalEvent }
  | { type: "reset" }
  /** Several mutations as one change: one write, one `onCommit`, one undo step. Never nested. */
  | { type: "batch"; changes: KloqChange[] };

/** A single mutation inside a {@link KloqStore.batch}; the store fills in `prev`/`event`. */
export type KloqBatchOp =
  | { type: "add"; event: CalEvent }
  | { type: "update"; id: StoreId; patch: CalEventPatch }
  | { type: "remove"; id: StoreId };

/** Optimistic seam: commits apply instantly; a rejection reverts and reports the ids. */
export type OnCommit = (change: KloqChange) => void | Promise<void>;
/** Called with the affected ids immediately before a revert, so the UI can capture geometry. */
type OnReverted = (ids: string[]) => void;

export interface KloqStore {
  subscribe(l: () => void): () => void;
  getSnapshot(): CalEvent[];
  getServerSnapshot(): CalEvent[];
  /** Swap in the persisted copy after mount (uncontrolled only; no-op otherwise). */
  hydrate(): void;
  reset(): void;
  add(event: CalEvent): void;
  update(id: StoreId, patch: CalEventPatch): void;
  remove(id: StoreId): void;
  /**
   * Apply several mutations as one committed change. Looping `add` instead loses
   * events in controlled mode (the facade closes over a stale array). Ops apply in order.
   */
  batch(ops: readonly KloqBatchOp[]): void;
  get(id: StoreId): CalEvent | undefined;
}

/**
 * History hooks, InternalStore only. `replaceAll` persists + notifies but skips
 * the change listener and the seam (an undo is not a new commit).
 */
interface HistoryCapableStore extends KloqStore {
  setChangeListener(
    l: ((change: KloqChange, before: CalEvent[], after: CalEvent[]) => void) | null,
  ): void;
  replaceAll(events: CalEvent[]): void;
}

export function isHistoryCapable(store: KloqStore): store is HistoryCapableStore {
  return store instanceof InternalStore;
}

interface Seam {
  onCommit?: OnCommit;
  onReverted?: OnReverted;
}

// ops naming a missing id are skipped, matching update/remove
function foldBatch(
  events: CalEvent[],
  ops: readonly KloqBatchOp[],
): { next: CalEvent[]; changes: KloqChange[]; ids: string[] } {
  let next = events;
  const changes: KloqChange[] = [];
  const ids: string[] = [];
  for (const op of ops) {
    if (op.type === "add") {
      next = [...next, op.event];
      changes.push({ type: "add", event: op.event });
      ids.push(op.event.id);
      continue;
    }
    const prev = next.find((e) => e.id === op.id);
    if (!prev) continue;
    if (op.type === "update") {
      next = next.map((e) => (e.id === op.id ? applyPatch(e, op.patch) : e));
      changes.push({ type: "update", id: op.id, patch: op.patch, prev });
    } else {
      next = next.filter((e) => e.id !== op.id);
      changes.push({ type: "remove", event: prev });
    }
    ids.push(op.id);
  }
  return { next, changes, ids };
}

export class InternalStore implements KloqStore {
  private events: CalEvent[];
  private readonly seeds: CalEvent[];
  private hydrated = false;
  private listeners = new Set<() => void>();
  private changeListener:
    | ((change: KloqChange, before: CalEvent[], after: CalEvent[]) => void)
    | null = null;

  constructor(
    seeds: CalEvent[],
    private adapter: PersistenceAdapter | false,
    private seam: Seam = {},
  ) {
    this.seeds = seeds;
    this.events = seeds;
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.events;
  getServerSnapshot = () => this.seeds;
  get = (id: string) => this.events.find((e) => e.id === id);

  private notify() {
    for (const l of this.listeners) l();
  }

  private set(next: CalEvent[]) {
    this.events = next;
    if (this.adapter) {
      const batcher = batchers.get(this.adapter);
      if (batcher) batcher.queue(next);
      else void this.adapter.save(next);
    }
    this.notify();
  }

  /** Write anything the built-in adapter still has queued; called on unmount. */
  flush() {
    if (this.adapter) batchers.get(this.adapter)?.flush();
  }

  private commit(change: KloqChange, revert: CalEvent[], ids: string[]) {
    const p = this.seam.onCommit?.(change);
    if (!p || typeof (p as Promise<void>).then !== "function") return;
    (p as Promise<void>).catch(() => {
      this.seam.onReverted?.(ids);
      this.set(revert);
    });
  }

  hydrate() {
    if (this.hydrated || !this.adapter) return;
    this.hydrated = true;
    const result = this.adapter.load();
    const apply = (loaded: CalEvent[] | null) => {
      if (loaded) {
        this.events = loaded;
        this.notify();
      }
    };
    if (result && typeof (result as Promise<unknown>).then === "function") {
      void (result as Promise<CalEvent[] | null>).then(apply).catch(() => {});
    } else {
      apply(result as CalEvent[] | null);
    }
  }

  reset() {
    const before = this.events;
    if (this.adapter) {
      if (this.adapter.clear) void this.adapter.clear();
      else void this.adapter.save(this.seeds);
    }
    this.events = this.seeds;
    this.notify();
    this.changeListener?.({ type: "reset" }, before, this.events);
    this.seam.onCommit?.({ type: "reset" });
  }

  add(event: CalEvent) {
    const revert = this.events;
    this.set([...this.events, event]);
    this.changeListener?.({ type: "add", event }, revert, this.events);
    this.commit({ type: "add", event }, revert, [event.id]);
  }

  update(id: string, patch: CalEventPatch) {
    const prev = this.get(id);
    if (!prev) return;
    const revert = this.events;
    this.set(this.events.map((e) => (e.id === id ? applyPatch(e, patch) : e)));
    this.changeListener?.({ type: "update", id, patch, prev }, revert, this.events);
    this.commit({ type: "update", id, patch, prev }, revert, [id]);
  }

  remove(id: string) {
    const event = this.get(id);
    if (!event) return;
    const revert = this.events;
    this.set(this.events.filter((e) => e.id !== id));
    this.changeListener?.({ type: "remove", event }, revert, this.events);
    this.commit({ type: "remove", event }, revert, [id]);
  }

  batch(ops: readonly KloqBatchOp[]) {
    const revert = this.events;
    const { next, changes, ids } = foldBatch(revert, ops);
    if (changes.length === 0) return;
    this.set(next);
    const change: KloqChange = { type: "batch", changes };
    this.changeListener?.(change, revert, this.events);
    this.commit(change, revert, ids);
  }

  setChangeListener(
    l: ((change: KloqChange, before: CalEvent[], after: CalEvent[]) => void) | null,
  ) {
    this.changeListener = l;
  }

  replaceAll(events: CalEvent[]) {
    this.set(events);
  }
}

/**
 * Facade over `events` + `onEventsChange`, recreated every render; subscription
 * is inert because re-renders arrive through props.
 */
export function controlledStore(
  events: CalEvent[],
  onEventsChange: (events: CalEvent[]) => void,
  seam: Seam = {},
): KloqStore {
  const commit = (change: KloqChange, revert: CalEvent[], ids: string[]) => {
    const p = seam.onCommit?.(change);
    if (!p || typeof (p as Promise<void>).then !== "function") return;
    (p as Promise<void>).catch(() => {
      seam.onReverted?.(ids);
      onEventsChange(revert);
    });
  };
  return {
    subscribe: () => () => {},
    getSnapshot: () => events,
    getServerSnapshot: () => events,
    hydrate() {},
    reset() {
      // the consumer's business
    },
    get: (id) => events.find((e) => e.id === id),
    add(event) {
      onEventsChange([...events, event]);
      commit({ type: "add", event }, events, [event.id]);
    },
    update(id, patch) {
      const prev = events.find((e) => e.id === id);
      if (!prev) return;
      onEventsChange(events.map((e) => (e.id === id ? applyPatch(e, patch) : e)));
      commit({ type: "update", id, patch, prev }, events, [id]);
    },
    remove(id) {
      const event = events.find((e) => e.id === id);
      if (!event) return;
      onEventsChange(events.filter((e) => e.id !== id));
      commit({ type: "remove", event }, events, [id]);
    },
    batch(ops) {
      const { next, changes, ids } = foldBatch(events, ops);
      if (changes.length === 0) return;
      onEventsChange(next);
      commit({ type: "batch", changes }, events, ids);
    },
  };
}

export function useStoreEvents(store: KloqStore): CalEvent[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/** The package's default id factory; hosts override it with `makeId`. */
export function newEventId(): string {
  return randomId("ev");
}
