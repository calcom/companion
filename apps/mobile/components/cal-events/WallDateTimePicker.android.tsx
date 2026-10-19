import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useEffect, useRef } from "react";
import {
  splitWallTimeParts,
  utcFaceDateToWallTime,
  wallTimeToUtcFaceDate,
} from "@/utils/wall-time";
import type { WallDateTimePickerProps } from "./WallDateTimePicker.types";

/** The dialogs show UTC, which has no DST, so they show any wall time as written. */
const PICKER_TIME_ZONE = "UTC";

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
    const current = latest.current.value;
    const minimum = latest.current.minWallTime;
    DateTimePickerAndroid.open({
      value: wallTimeToUtcFaceDate(current),
      mode: "date",
      timeZoneName: PICKER_TIME_ZONE,
      minimumDate: minimum ? wallTimeToUtcFaceDate(minimum) : undefined,
      onChange: (dateEvent, pickedDate) => {
        if (dateEvent.type !== "set" || !pickedDate) {
          latest.current.onClose();
          return;
        }
        const day = splitWallTimeParts(utcFaceDateToWallTime(pickedDate)).date;
        const withDate = `${day}T${splitWallTimeParts(current).timeOfDay}`;
        DateTimePickerAndroid.open({
          value: wallTimeToUtcFaceDate(withDate),
          mode: "time",
          is24Hour: true,
          timeZoneName: PICKER_TIME_ZONE,
          onChange: (timeEvent, pickedTime) => {
            if (timeEvent.type === "set" && pickedTime) {
              const { timeOfDay } = splitWallTimeParts(utcFaceDateToWallTime(pickedTime));
              latest.current.onChange(`${day}T${timeOfDay}`);
            }
            latest.current.onClose();
          },
        });
      },
    });
  }, [visible]);

  return null;
}
