import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  applyPlan,
  type CalEvent,
  type CalEventPatch,
  type CalendarAccount,
  type CalendarSource,
  defaultCalendarId,
  deleteOccurrence,
  editOccurrence,
  filterVisibleEvents,
  getCalendarSources,
  InternalStore,
  type KloqView,
  newEventId,
  type Occurrence,
  type OnCommit,
  type PersistenceAdapter,
  type RecurrenceScope,
  registerCalendarAccounts,
  registerCalendarSources,
  resolveEventColor,
  resolveView,
  stepAnchor,
  subscribeCalendarSources,
  todayAnchor,
  type ViewDescriptor,
} from "./model.ts";

export interface KloqControllerOptions {
  /** Events the calendar starts with (uncontrolled). */
  initialEvents?: CalEvent[];
  /** Persist committed changes; `load` may be async. */
  persistence?: PersistenceAdapter;
  /** Optimistic seam: a rejected promise reverts the change. */
  onCommit?: OnCommit;
  /** Calendars (and the accounts they belong to) registered with kloq's source registry. */
  calendars?: CalendarSource[];
  accounts?: CalendarAccount[];
  initialView?: KloqView;
  initialDate?: Date;
  /** 0 = Sunday … 6 = Saturday; kloq's default is Monday. */
  weekStartsOn?: number;
}

/** What the editor opens on: a new draft, a plain event, or one occurrence of a series. */
export type EditTarget =
  | {
      kind: "new";
      start: Date;
      end: Date;
      allDay: boolean;
      title?: string;
      location?: string;
      /** the calendar to start on, instead of the default */
      calendarId?: string;
    }
  | { kind: "event"; event: CalEvent; occurrence?: Occurrence };

/** Ask the user which part of a series to change; `null` means they dismissed the question. */
export type AskScope = (request: {
  action: "edit" | "delete";
  event: CalEvent;
  occurrence: Occurrence;
}) => Promise<RecurrenceScope | null>;

function useSources(): CalendarSource[] {
  return useSyncExternalStore(subscribeCalendarSources, getCalendarSources, getCalendarSources);
}

export function useKloq(options: KloqControllerOptions = {}) {
  const { calendars, accounts, persistence, onCommit } = options;
  const weekStartsOn = options.weekStartsOn ?? 1;

  // one store per mount; the seeds are read once, like `<Kloq>`'s uncontrolled mode
  const [store] = useState(
    () => new InternalStore(options.initialEvents ?? [], persistence ?? false, { onCommit }),
  );
  const events = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    store.hydrate();
    return () => store.flush();
  }, [store]);

  useEffect(() => {
    const off: (() => void)[] = [];
    if (accounts?.length) off.push(registerCalendarAccounts(...accounts));
    if (calendars?.length) off.push(registerCalendarSources(...calendars));
    return () => {
      for (const f of off) f();
    };
  }, [calendars, accounts]);
  const sources = useSources();

  const [view, setView] = useState<KloqView>(options.initialView ?? "week");
  const [anchor, setAnchor] = useState<Date>(() => options.initialDate ?? new Date());

  const descriptor: ViewDescriptor = useMemo(
    () => resolveView(view, weekStartsOn, anchor),
    [view, weekStartsOn, anchor],
  );

  const visibleEvents = useMemo(
    () =>
      filterVisibleEvents(events, sources).map((e) =>
        e.color ? e : { ...e, color: resolveEventColor(e, sources) },
      ) as CalEvent[],
    [events, sources],
  );

  const step = useCallback((dir: -1 | 1) => setAnchor((d) => stepAnchor(view, d, dir)), [view]);
  const goToday = useCallback(() => setAnchor(todayAnchor(view)), [view]);
  const showDay = useCallback((day: Date) => {
    setAnchor(day);
    setView("day");
  }, []);
  const changeView = useCallback((next: KloqView) => {
    setView(next);
  }, []);

  const save = useCallback(
    async (target: EditTarget, patch: CalEventPatch, askScope: AskScope): Promise<boolean> => {
      if (target.kind === "new") {
        store.add({
          id: newEventId(),
          calendarId: patch.calendarId ?? defaultCalendarId(sources),
          ...patch,
        } as CalEvent);
        return true;
      }
      const { event, occurrence } = target;
      if (!event.rrule || !occurrence) {
        store.update(event.id, patch);
        return true;
      }
      const scope = await askScope({ action: "edit", event, occurrence });
      if (!scope) return false;
      applyPlan(store, editOccurrence(event, occurrence, patch, scope, { makeId: newEventId }));
      return true;
    },
    [store, sources],
  );

  const remove = useCallback(
    async (target: EditTarget, askScope: AskScope): Promise<boolean> => {
      if (target.kind === "new") return true;
      const { event, occurrence } = target;
      if (!event.rrule || !occurrence) {
        store.remove(event.id);
        return true;
      }
      const scope = await askScope({ action: "delete", event, occurrence });
      if (!scope) return false;
      applyPlan(store, deleteOccurrence(event, occurrence, scope));
      return true;
    },
    [store],
  );

  const add = useCallback(
    (event: Omit<CalEvent, "id">) =>
      store.add({
        id: newEventId(),
        calendarId: event.calendarId ?? defaultCalendarId(sources),
        ...event,
      } as CalEvent),
    [store, sources],
  );

  return {
    store,
    events,
    visibleEvents,
    sources,
    view,
    setView: changeView,
    anchor,
    setAnchor,
    descriptor,
    weekStartsOn,
    step,
    goToday,
    showDay,
    save,
    remove,
    add,
    reset: () => store.reset(),
  };
}

export type KloqController = ReturnType<typeof useKloq>;
