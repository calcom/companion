export interface WallDateTimePickerProps {
  visible: boolean;
  /** "Change start" / "Change end". */
  title: string;
  /** `"YYYY-MM-DDTHH:mm"` in the event's timezone. */
  value: string;
  /** The earliest pick, as a wall time. */
  minWallTime?: string;
  onChange: (wallTime: string) => void;
  onClose: () => void;
}
