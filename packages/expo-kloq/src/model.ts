// The one seam to kloq: every calendar rule (views, projection, layout, recurrence, RRULE presets,
// quick add, reminders, time zones) comes from kloq's own model modules, never a copy. Only
// `kloq/lib/*` is imported: kloq's root entry pulls in its DOM components.

export { groupAgenda } from "kloq/lib/agenda";
export {
  type CalendarAccount,
  type CalendarSource,
  defaultCalendarId,
  filterVisibleEvents,
  findCalendar,
  getCalendarSources,
  groupByAccount,
  isVisible,
  registerCalendarAccounts,
  registerCalendarSources,
  resolveEventColor,
  setCalendarVisible,
  subscribeCalendarSources,
} from "kloq/lib/calendar-sources";
export {
  buildSeedEvents,
  InternalStore,
  type KloqStore,
  newEventId,
  type OnCommit,
  type PersistenceAdapter,
} from "kloq/lib/calendar-store";
export {
  addDays,
  type CalEvent,
  type CalEventPatch,
  continuesAfter,
  continuesBefore,
  DEFAULT_EVENT_COLOR,
  type EventColor,
  formatInstant,
  formatMinutes,
  formatRange,
  type Instant,
  isDateOnly,
  type KloqView,
  minutesOfDate,
  parseInstant,
  type Reminder,
  resolveView,
  startOfLocalDay,
  toDateOnlyString,
  type ViewDescriptor,
  viewKind,
  wallMinutesBetween,
} from "kloq/lib/calendar-types";
export { sameDay } from "kloq/lib/date-math";
export { eventTitle, fullDate, plural } from "kloq/lib/event-text";
export type { Lane, LaneAdapter } from "kloq/lib/lane";
export { layoutMonth } from "kloq/lib/month-grid";
export { formatViewTitle, stepAnchor, todayAnchor } from "kloq/lib/navigation";
export { layoutDay } from "kloq/lib/overlap";
export { type PlacedOccurrence, projectEvents } from "kloq/lib/projection";
export { parseQuickAdd, type QuickAddResult } from "kloq/lib/quick-add";
export { quickAddPreview } from "kloq/lib/quick-add-view";
export {
  applyPlan,
  deleteOccurrence,
  editOccurrence,
  type Occurrence,
  RECURRENCE_SCOPES,
  type RecurrenceScope,
} from "kloq/lib/recurrence";
export {
  addReminder,
  DEFAULT_REMINDER,
  describeReminder,
  normalizeReminders,
  REMINDER_PRESETS,
  removeReminder,
  replaceReminder,
} from "kloq/lib/reminders";
export {
  describeRRule,
  endOf,
  type PresetId,
  parseRRule,
  presetIdFor,
  presetsFor,
  type RRuleEnd,
  type RRuleFreq,
  type RRuleParts,
  type RRuleWeekday,
  serializeRRule,
  untilFromDate,
  untilToDate,
  WEEKDAY_CODES,
  weekdayCodeOf,
  withEnd,
} from "kloq/lib/rrule";
export { projectTimeline } from "kloq/lib/timeline-projection";
export { resolveWindow, type TimelineWindow } from "kloq/lib/timeline-window";
export {
  COMMON_ZONES,
  hourLabel,
  localZone,
  wallClockIn,
  zoneAbbr,
  zoneCityLabel,
} from "kloq/lib/timezone";
export { buildYearGrid, densityByDay, loadOn, weekdayColumns } from "kloq/lib/year-grid";
