import type { EventDraft } from "../editor/draft.ts";
import type { CalendarSource, KloqView, RecurrenceScope } from "../model.ts";

/** The views the switcher offers, in kloq's order (`calendar/nav.tsx`). */
export const VIEW_OPTIONS: readonly { key: KloqView; label: string; tag: string }[] = [
  { key: "day", label: "Day", tag: "day" },
  { key: 3, label: "3 days", tag: "3" },
  { key: "week", label: "Week", tag: "week" },
  { key: "month", label: "Month", tag: "month" },
  { key: "year", label: "Year", tag: "year" },
  { key: "agenda", label: "Schedule", tag: "agenda" },
  { key: "timeline", label: "Timeline", tag: "timeline" },
];

/** The segmented control's subset; the rest live in the toolbar menu. */
export const SEGMENT_TAGS = ["day", "week", "month", "year", "agenda"] as const;

export const tagOfView = (view: KloqView): string => String(view);
export const viewOfTag = (tag: string): KloqView =>
  VIEW_OPTIONS.find((o) => o.tag === tag)?.key ?? "week";

export interface NavControlsProps {
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
  onQuickAdd: () => void;
  onSettings: () => void;
  onReset: () => void;
  view: KloqView;
  onView: (view: KloqView) => void;
  prevLabel: string;
  nextLabel: string;
}

export interface SheetButtonProps {
  label: string;
  onPress: () => void;
  prominent?: boolean;
  disabled?: boolean;
  testID?: string;
}

export interface ViewSwitcherProps {
  view: KloqView;
  onView: (view: KloqView) => void;
}

export interface EventFormProps {
  draft: EventDraft;
  onChange: (draft: EventDraft) => void;
  calendars: CalendarSource[];
  readOnly: boolean;
  /** shown for existing events only */
  onDelete?: () => void;
  hour12?: boolean;
}

export interface ScopeRequest {
  action: "edit" | "delete";
  title: string;
  summary?: string;
  /** "this and following" equals "all" on the first occurrence, so it isn't offered there */
  scopes: readonly RecurrenceScope[];
}

export interface ScopeDialogProps {
  request: ScopeRequest | null;
  onChoose: (scope: RecurrenceScope | null) => void;
}

export interface QuickAddFieldProps {
  onChangeText: (text: string) => void;
  onSubmit: () => void;
}

export interface SettingsFormProps {
  calendars: CalendarSource[];
  onToggleCalendar: (id: string, visible: boolean) => void;
  zones: readonly string[];
  selectedZones: readonly string[];
  onToggleZone: (zone: string, on: boolean) => void;
  hour12: boolean;
  onHour12: (hour12: boolean) => void;
}

export const SCOPE_LABELS: Record<RecurrenceScope, string> = {
  this: "This event",
  following: "This and following events",
  all: "All events",
};
