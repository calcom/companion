import { type CalendarSource, setCalendarVisible } from "../model.ts";
import { SettingsForm } from "../native/sheets";
import { Sheet } from "./sheet.tsx";

export interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  calendars: CalendarSource[];
  zones: readonly string[];
  selectedZones: readonly string[];
  onZones: (zones: string[]) => void;
  hour12: boolean;
  onHour12: (hour12: boolean) => void;
}

/** Which calendars show (kloq's source registry) and which extra zones the hour gutter draws. */
export function SettingsSheet(props: SettingsSheetProps) {
  return (
    <Sheet visible={props.visible} title="Calendars" onCancel={props.onClose} cancelLabel="Done">
      {props.visible ? (
        <SettingsForm
          calendars={props.calendars}
          onToggleCalendar={setCalendarVisible}
          zones={props.zones}
          selectedZones={props.selectedZones}
          onToggleZone={(zone, on) =>
            props.onZones(
              on
                ? props.zones.filter((z) => z === zone || props.selectedZones.includes(z))
                : props.selectedZones.filter((z) => z !== zone),
            )
          }
          hour12={props.hour12}
          onHour12={props.onHour12}
        />
      ) : null}
    </Sheet>
  );
}
