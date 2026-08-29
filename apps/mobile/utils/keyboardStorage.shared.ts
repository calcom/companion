import type { EventType } from "@/services/types";

import { APP_GROUP_IDENTIFIER } from "./widgetStorage.shared";

export const KEYBOARD_DATA_KEY = "keyboardLinks";
export const ANDROID_KEYBOARD_FILE = "cal-keyboard.json";

export interface KeyboardSlot {
  start: string;
  label: string;
  url: string;
}

export interface KeyboardDay {
  date: string;
  label: string;
  slots: KeyboardSlot[];
}

export interface KeyboardLink {
  id: string;
  title: string;
  url: string;
  durationLabel: string | null;
  days: KeyboardDay[];
}

export interface KeyboardData {
  links: KeyboardLink[];
  timeZone: string;
  lastUpdated: string;
}

export interface KeyboardSlotInput {
  start: string;
}

export interface KeyboardDataInput {
  eventTypes: EventType[];
  slotsByEventType: Record<string, KeyboardSlotInput[]>;
  timeZone: string;
  bookingUrlForEventType: (eventType: EventType) => string;
}

function getDateParts(start: string, timeZone: string): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(start))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value])
  );
}

function formatDate(start: string, timeZone: string): string {
  const parts = getDateParts(start, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDateLabel(start: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(start));
}

function formatTimeLabel(start: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(start));
}

export function buildSlotUrl(bookingUrl: string, isoStart: string, timeZone: string): string {
  const url = new URL(bookingUrl);
  const date = formatDate(isoStart, timeZone);
  url.searchParams.set("date", date);
  url.searchParams.set("month", date.slice(0, 7));
  url.searchParams.set("slot", isoStart);
  return url.toString();
}

export function transformToKeyboardData(input: KeyboardDataInput): KeyboardData {
  const links = input.eventTypes.slice(0, 10).map((eventType) => {
    const slots = input.slotsByEventType[String(eventType.id)] ?? [];
    const daysByDate = new Map<string, KeyboardDay>();

    for (const slot of slots) {
      const date = formatDate(slot.start, input.timeZone);
      const day = daysByDate.get(date) ?? {
        date,
        label: formatDateLabel(slot.start, input.timeZone),
        slots: [],
      };

      if (day.slots.length < 8) {
        day.slots.push({
          start: slot.start,
          label: formatTimeLabel(slot.start, input.timeZone),
          url: buildSlotUrl(input.bookingUrlForEventType(eventType), slot.start, input.timeZone),
        });
        daysByDate.set(date, day);
      }
    }

    const days = [...daysByDate.values()]
      .filter((day) => day.slots.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7);

    return {
      id: String(eventType.id),
      title: eventType.title,
      url: input.bookingUrlForEventType(eventType),
      durationLabel:
        eventType.lengthInMinutes !== undefined || eventType.length !== undefined
          ? `${eventType.lengthInMinutes ?? eventType.length} min`
          : null,
      days,
    };
  });

  return {
    links,
    timeZone: input.timeZone,
    lastUpdated: new Date().toISOString(),
  };
}

export function composeKeyboardInsertion(
  link: KeyboardLink,
  selections: Array<{ day: KeyboardDay; slot: KeyboardSlot }>,
  timeZone: string
): string {
  if (selections.length === 0) {
    return "";
  }

  const lines = selections.map(({ day, slot }) => `${day.label} at ${slot.label} — ${slot.url}`);
  if (selections.length === 1) {
    return lines[0];
  }

  return [`${link.title} — pick a time:`, ...lines, "", `(times in ${timeZone})`].join("\n");
}

export { APP_GROUP_IDENTIFIER };
