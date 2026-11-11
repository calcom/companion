// expo-kloq — public API

export { DEFAULT_ZONE_CHOICES, KloqCalendar, type KloqCalendarProps } from "./calendar.tsx";
export { draftFor, type EventDraft, patchFor } from "./editor/draft.ts";
// the model is kloq's own, re-exported so hosts need only one import
export type {
  CalEvent,
  CalEventPatch,
  CalendarAccount,
  CalendarSource,
  EventColor,
  KloqView,
  OnCommit,
  PersistenceAdapter,
  Reminder,
} from "./model.ts";
export { buildSeedEvents } from "./model.ts";
export { type Palette, paletteFor, usePalette } from "./theme.ts";
export {
  type AskScope,
  type EditTarget,
  type KloqController,
  type KloqControllerOptions,
  useKloq,
} from "./use-kloq.ts";
export { AgendaView } from "./views/agenda-view.tsx";
export { MonthView } from "./views/month-view.tsx";
export { TimeGrid } from "./views/time-grid.tsx";
export { TimelineView } from "./views/timeline-view.tsx";
export { YearView } from "./views/year-view.tsx";
