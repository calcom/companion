import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  splitWallTimeParts,
  utcFaceDateToWallTime,
  wallTimeDiffMs,
  wallTimeToUtcFaceDate,
} from "@/utils/wall-time";
import type { WallDateTimePickerProps } from "./WallDateTimePicker.types";

/** The dialogs show UTC, which has no DST, so they show any wall time as written. */
const PICKER_TIME_ZONE = "UTC";

/**
 * Android has no combined date-and-time dialog: opening shows the date dialog, then the time
 * dialog for that day ("time" mode skips the date). Dismissing either keeps the previous value.
 */
export function WallDateTimePicker({
  visible,
  value,
  minWallTime,
  mode = "datetime",
  onChange,
  onClose,
}: WallDateTimePickerProps) {
  // The dialogs are imperative: read the latest props when they answer, not when they opened.
  const latest = useRef({ value, minWallTime, mode, onChange, onClose });
  useLayoutEffect(() => {
    latest.current = { value, minWallTime, mode, onChange, onClose };
  });

  useEffect(() => {
    if (!visible) return;
    const current = latest.current.value;
    const minimum = latest.current.minWallTime;
    const openTime = (day: string) =>
      DateTimePickerAndroid.open({
        value: wallTimeToUtcFaceDate(`${day}T${splitWallTimeParts(current).timeOfDay}`),
        mode: "time",
        is24Hour: true,
        timeZoneName: PICKER_TIME_ZONE,
        onChange: (timeEvent, pickedTime) => {
          if (timeEvent.type === "set" && pickedTime) {
            const { timeOfDay } = splitWallTimeParts(utcFaceDateToWallTime(pickedTime));
            const picked = `${day}T${timeOfDay}`;
            // Only the date dialog takes a minimum: an earlier time is held at it, where iOS's
            // picker stops.
            const earliest = latest.current.minWallTime;
            latest.current.onChange(
              earliest && wallTimeDiffMs(earliest, picked) < 0 ? earliest : picked
            );
          }
          latest.current.onClose();
        },
      });
    if (latest.current.mode === "time") {
      openTime(splitWallTimeParts(current).date);
      return;
    }
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
        openTime(splitWallTimeParts(utcFaceDateToWallTime(pickedDate)).date);
      },
    });
  }, [visible]);

  return null;
}
