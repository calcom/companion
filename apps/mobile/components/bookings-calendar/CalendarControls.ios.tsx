import { Button, GlassEffectContainer, Host, HStack, Picker, Text } from "@expo/ui/swift-ui";
import {
  accessibilityIdentifier,
  buttonStyle,
  controlSize,
  labelStyle,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { StyleSheet } from "react-native";
import { CALENDAR_VIEWS, type CalendarControlsProps, viewOfTag } from "./calendar-views";

// Adapted from kloq's own controls (packages/expo-kloq/src/native/controls.ios.tsx), without the
// editing actions. Liquid Glass on iOS 26+, the bordered style before it.
const GLASS = isLiquidGlassAvailable();
const buttonLook = buttonStyle(GLASS ? "glass" : "bordered");
const iconButton = [buttonLook, labelStyle("iconOnly"), controlSize("regular")];

/** Previous, Today and Next as SwiftUI buttons in one glass container. */
export function CalendarNav({
  onPrev,
  onToday,
  onNext,
  prevLabel,
  nextLabel,
}: CalendarControlsProps) {
  return (
    <Host matchContents style={styles.nav}>
      <GlassEffectContainer spacing={6}>
        <HStack spacing={6}>
          <Button
            label={prevLabel}
            systemImage="chevron.left"
            onPress={onPrev}
            modifiers={[...iconButton, accessibilityIdentifier("bookings-calendar-prev")]}
          />
          <Button
            label="Today"
            onPress={onToday}
            modifiers={[buttonLook, controlSize("regular")]}
          />
          <Button
            label={nextLabel}
            systemImage="chevron.right"
            onPress={onNext}
            modifiers={[...iconButton, accessibilityIdentifier("bookings-calendar-next")]}
          />
        </HStack>
      </GlassEffectContainer>
    </Host>
  );
}

/** Day · Week · Month · Year · Schedule as SwiftUI's segmented picker. */
export function CalendarViewPicker({
  view,
  onView,
}: Pick<CalendarControlsProps, "view" | "onView">) {
  return (
    <Host matchContents={{ vertical: true }} style={styles.picker}>
      <Picker
        selection={String(view)}
        onSelectionChange={(t: string) => onView(viewOfTag(t))}
        modifiers={[pickerStyle("segmented"), accessibilityIdentifier("bookings-calendar-views")]}
      >
        {CALENDAR_VIEWS.map((o) => (
          <Text key={o.tag} modifiers={[tag(o.tag)]}>
            {o.label}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}

const styles = StyleSheet.create({
  nav: { flexShrink: 0 },
  picker: { alignSelf: "stretch" },
});
