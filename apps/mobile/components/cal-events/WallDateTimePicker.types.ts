export interface WallDateTimePickerProps {
  visible: boolean;
  /** "Change start" / "Change end". */
  title: string;
  /** `"YYYY-MM-DDTHH:mm"` in the event's timezone. */
  value: string;
  /** The earliest pick, as a wall time. */
  minWallTime?: string;
  /** "time" picks only the time of `value`'s day, such as within a single-day event. */
  mode?: "datetime" | "time";
  onChange: (wallTime: string) => void;
  onClose: () => void;
}
