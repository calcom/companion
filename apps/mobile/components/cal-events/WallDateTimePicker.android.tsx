import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useEffect, useRef } from "react";
import { calendarDateToWallTime, wallTimeToCalendarDate } from "@/utils/wall-time";
import type { WallDateTimePickerProps } from "./WallDateTimePicker.types";

/**
 * Android has no combined date-and-time dialog: opening shows the date dialog, then the time
 * dialog for that day. Dismissing either keeps the previous value.
 */
export function WallDateTimePicker({
  visible,
  value,
  minWallTime,
  onChange,
  onClose,
}: WallDateTimePickerProps) {
  // The dialogs are imperative: read the latest props when they answer, not when they opened.
  const latest = useRef({ value, minWallTime, onChange, onClose });
  latest.current = { value, minWallTime, onChange, onClose };

  useEffect(() => {
    if (!visible) return;
    const current = wallTimeToCalendarDate(latest.current.value);
    const minimum = latest.current.minWallTime
      ? wallTimeToCalendarDate(latest.current.minWallTime)
      : undefined;
    DateTimePickerAndroid.open({
      value: current,
      mode: "date",
      minimumDate: minimum,
      onChange: (dateEvent, pickedDate) => {
        if (dateEvent.type !== "set" || !pickedDate) {
          latest.current.onClose();
          return;
        }
        const withDate = new Date(current);
        withDate.setFullYear(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate());
        DateTimePickerAndroid.open({
          value: withDate,
          mode: "time",
          is24Hour: true,
          onChange: (timeEvent, pickedTime) => {
            if (timeEvent.type === "set" && pickedTime) {
              const next = new Date(withDate);
              next.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
              latest.current.onChange(calendarDateToWallTime(next));
            }
            latest.current.onClose();
          },
        });
      },
    });
  }, [visible]);

  return null;
}
