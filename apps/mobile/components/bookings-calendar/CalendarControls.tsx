import {
  Host,
  OutlinedButton,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from "@expo/ui/jetpack-compose";
import { StyleSheet } from "react-native";
import { CALENDAR_VIEWS, type CalendarControlsProps } from "./calendar-views";

// Adapted from kloq's own controls (vendor/expo-kloq/src/native/controls.android.tsx), without
// the editing actions.

/** Previous, Today and Next as Material 3 outlined buttons. */
export function CalendarNav({ onPrev, onToday, onNext }: CalendarControlsProps) {
  return (
    <Host matchContents style={styles.nav}>
      <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center">
        <OutlinedButton onClick={onPrev}>
          <Text>‹</Text>
        </OutlinedButton>
        <OutlinedButton onClick={onToday}>
          <Text>Today</Text>
        </OutlinedButton>
        <OutlinedButton onClick={onNext}>
          <Text>›</Text>
        </OutlinedButton>
      </Row>
    </Host>
  );
}

/** Day · Week · Month · Year · Schedule as Material 3 segmented buttons. */
export function CalendarViewPicker({
  view,
  onView,
}: Pick<CalendarControlsProps, "view" | "onView">) {
  return (
    <Host matchContents={{ vertical: true }} style={styles.picker}>
      <SingleChoiceSegmentedButtonRow>
        {CALENDAR_VIEWS.map((o) => (
          <SegmentedButton key={o.tag} selected={o.view === view} onClick={() => onView(o.view)}>
            <SegmentedButton.Label>
              {/* Five buttons share the width and the selected one adds a checkmark, so the
                  labels use a smaller size on one line to keep "Schedule" from wrapping. */}
              <Text
                maxLines={1}
                softWrap={false}
                style={{ typography: "labelMedium", fontSize: 11, letterSpacing: 0 }}
              >
                {o.label}
              </Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}

const styles = StyleSheet.create({
  nav: { flexShrink: 0 },
  picker: { alignSelf: "stretch" },
});
