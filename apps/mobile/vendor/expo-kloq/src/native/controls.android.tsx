import {
  FilledTonalButton,
  Host,
  OutlinedButton,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import { StyleSheet } from "react-native";
import { ComposeMenu } from "./compose-menu.android.tsx";
import {
  type NavControlsProps,
  SEGMENT_TAGS,
  type SheetButtonProps,
  tagOfView,
  VIEW_OPTIONS,
  type ViewSwitcherProps,
  viewOfTag,
} from "./types.ts";

/** Previous / Today / Next, New and the overflow menu as Material 3 buttons. */
export function NavControls(props: NavControlsProps) {
  const current = tagOfView(props.view);
  return (
    <Host matchContents style={styles.host}>
      <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center">
        <OutlinedButton onClick={props.onPrev}>
          <Text>‹</Text>
        </OutlinedButton>
        <OutlinedButton onClick={props.onToday}>
          <Text>Today</Text>
        </OutlinedButton>
        <OutlinedButton onClick={props.onNext}>
          <Text>›</Text>
        </OutlinedButton>
        <ComposeMenu
          label="⋯"
          items={[
            { key: "quick", label: "Quick add", onSelect: props.onQuickAdd },
            ...VIEW_OPTIONS.map((o) => ({
              key: `view-${o.tag}`,
              label: o.label,
              selected: o.tag === current,
              onSelect: () => props.onView(o.key),
            })),
            { key: "settings", label: "Calendars & time zones", onSelect: props.onSettings },
            { key: "reset", label: "Reset events", onSelect: props.onReset },
          ]}
        />
      </Row>
    </Host>
  );
}

/** Day · Week · Month · Year · Schedule as Material 3 segmented buttons. */
export function ViewSwitcher({ view, onView }: ViewSwitcherProps) {
  const current = tagOfView(view);
  return (
    <Host matchContents={{ vertical: true }} style={styles.switcher}>
      <SingleChoiceSegmentedButtonRow>
        {SEGMENT_TAGS.map((t) => (
          <SegmentedButton key={t} selected={t === current} onClick={() => onView(viewOfTag(t))}>
            <SegmentedButton.Label>
              <Text>{VIEW_OPTIONS.find((o) => o.tag === t)?.label ?? t}</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}

/** A sheet's Cancel / Save button. */
export function SheetButton({ label, onPress, prominent, disabled }: SheetButtonProps) {
  const Component = prominent ? FilledTonalButton : TextButton;
  return (
    <Host matchContents>
      <Component onClick={onPress} enabled={disabled !== true}>
        <Text>{label}</Text>
      </Component>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { flexShrink: 0 },
  switcher: { alignSelf: "stretch" },
});
