import { formatDate } from "./date-format";

export const eventTitle = (e: { title?: string | null }): string => e.title?.trim() || "Untitled";

export const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;

const FULL_DATE: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
};

/** "Monday, 3 March 2026". */
export const fullDate = (d: Date, locale?: string): string => formatDate(d, locale, FULL_DATE);

/** Compact duration: 30min, 1h, 1h 30min. */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}min`;
  return rest === 0 ? `${h}h` : `${h}h ${rest}min`;
}
