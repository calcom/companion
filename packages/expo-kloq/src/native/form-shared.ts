import {
  addReminder,
  DEFAULT_REMINDER,
  describeReminder,
  REMINDER_PRESETS,
  type Reminder,
  type RRuleFreq,
  removeReminder,
  replaceReminder,
} from "../model.ts";

/** kloq's own cap (`MAX_REMINDERS`). */
export const ALERT_LIMIT = 5;

export const FREQ_LABELS: Record<RRuleFreq, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export const FREQ_UNITS: Record<RRuleFreq, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
};

/** Sunday-first, like `WEEKDAY_CODES`. */
export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** What a screen reader says for each letter, in the same order. */
export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** kloq's reminder edits return `null` for a no-op (duplicate, full, unchanged); the forms keep the list then. */
export function withAddedAlert(list: Reminder[]): Reminder[] {
  // the default first, then the next preset not already set
  for (const minutesBefore of [
    DEFAULT_REMINDER.minutesBefore,
    ...REMINDER_PRESETS.map((p) => p.minutesBefore),
  ]) {
    const next = addReminder(list, { minutesBefore });
    if (next) return next;
  }
  return list;
}

export const withReplacedAlert = (
  list: Reminder[],
  index: number,
  minutesBefore: number,
): Reminder[] => replaceReminder(list, index, { ...list[index], minutesBefore }) ?? list;

export const withoutAlert = (list: Reminder[], reminder: Reminder): Reminder[] =>
  removeReminder(list, reminder);

export const alertLabel = (reminder: Reminder): string =>
  describeReminder(reminder, { withMethod: true });

/** What one alert's menu offers: the presets plus its own offset, all in its own method. */
export function alertChoices(reminder: Reminder): { minutesBefore: number; label: string }[] {
  const offsets = REMINDER_PRESETS.map((p) => p.minutesBefore);
  if (!offsets.includes(reminder.minutesBefore)) offsets.push(reminder.minutesBefore);
  return offsets.map((minutesBefore) => ({
    minutesBefore,
    label: alertLabel({ ...reminder, minutesBefore }),
  }));
}
