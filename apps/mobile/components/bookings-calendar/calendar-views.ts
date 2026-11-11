import type { KloqView } from "expo-kloq";

/** The calendar views the bookings calendar offers, in picker order. */
export const CALENDAR_VIEWS: readonly { view: KloqView; label: string; tag: string }[] = [
  { view: "day", label: "Day", tag: "day" },
  { view: "week", label: "Week", tag: "week" },
  { view: "month", label: "Month", tag: "month" },
  { view: "year", label: "Year", tag: "year" },
  { view: "agenda", label: "Schedule", tag: "agenda" },
];

export const viewOfTag = (tag: string): KloqView =>
  CALENDAR_VIEWS.find((o) => o.tag === tag)?.view ?? "week";

export interface CalendarControlsProps {
  view: KloqView;
  onView: (view: KloqView) => void;
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}
