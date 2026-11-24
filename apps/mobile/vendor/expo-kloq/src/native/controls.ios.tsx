import {
  Button,
  Divider,
  GlassEffectContainer,
  Host,
  HStack,
  Menu,
  Picker,
  Section,
  Text,
} from "@expo/ui/swift-ui";
import {
  accessibilityIdentifier,
  accessibilityLabel,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  labelStyle,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { StyleSheet } from "react-native";
import {
  type NavControlsProps,
  SEGMENT_TAGS,
  type SheetButtonProps,
  tagOfView,
  VIEW_OPTIONS,
  type ViewSwitcherProps,
  viewOfTag,
} from "./types.ts";

// Liquid Glass on iOS 26+, the bordered style before it.
const GLASS = isLiquidGlassAvailable();
const iconButton = [
  buttonStyle(GLASS ? "glass" : "bordered"),
  labelStyle("iconOnly"),
  controlSize("regular"),
];

/** Previous / Today / Next, New and the overflow menu: SwiftUI buttons in one glass container. */
export function NavControls(props: NavControlsProps) {
  return (
    <Host matchContents style={styles.host}>
      <GlassEffectContainer spacing={6}>
        <HStack spacing={6}>
          <Button
            label={props.prevLabel}
            systemImage="chevron.left"
            onPress={props.onPrev}
            modifiers={[...iconButton, accessibilityIdentifier("kloq-prev")]}
          />
          <Button
            label="Today"
            onPress={props.onToday}
            modifiers={[buttonStyle(GLASS ? "glass" : "bordered"), controlSize("regular")]}
          />
          <Button
            label={props.nextLabel}
            systemImage="chevron.right"
            onPress={props.onNext}
            modifiers={[...iconButton, accessibilityIdentifier("kloq-next")]}
          />
          <Menu
            label="More"
            systemImage="ellipsis"
            modifiers={[...iconButton, accessibilityLabel("More")]}
          >
            <Button label="Quick add" systemImage="text.badge.plus" onPress={props.onQuickAdd} />
            <Picker
              label="View"
              systemImage="calendar"
              selection={tagOfView(props.view)}
              onSelectionChange={(t: string) => props.onView(viewOfTag(t))}
              modifiers={[pickerStyle("menu")]}
            >
              {VIEW_OPTIONS.map((o) => (
                <Text key={o.tag} modifiers={[tag(o.tag)]}>
                  {o.label}
                </Text>
              ))}
            </Picker>
            <Section>
              <Button
                label="Calendars & time zones"
                systemImage="slider.horizontal.3"
                onPress={props.onSettings}
              />
              <Divider />
              <Button
                label="Reset events"
                systemImage="arrow.counterclockwise"
                role="destructive"
                onPress={props.onReset}
              />
            </Section>
          </Menu>
        </HStack>
      </GlassEffectContainer>
    </Host>
  );
}

/** Day · Week · Month · Year · Schedule, as SwiftUI's segmented picker. */
export function ViewSwitcher({ view, onView }: ViewSwitcherProps) {
  return (
    <Host matchContents={{ vertical: true }} style={styles.switcher}>
      <Picker
        selection={tagOfView(view)}
        onSelectionChange={(t: string) => onView(viewOfTag(t))}
        modifiers={[pickerStyle("segmented"), accessibilityIdentifier("kloq-views")]}
      >
        {SEGMENT_TAGS.map((t) => (
          <Text key={t} modifiers={[tag(t)]}>
            {VIEW_OPTIONS.find((o) => o.tag === t)?.label ?? t}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}

/** A sheet's Cancel / Save button. */
export function SheetButton({
  label,
  onPress,
  prominent,
  disabled: off,
  testID,
}: SheetButtonProps) {
  return (
    <Host matchContents>
      <Button
        label={label}
        onPress={onPress}
        modifiers={[
          buttonStyle(
            prominent
              ? GLASS
                ? "glassProminent"
                : "borderedProminent"
              : GLASS
                ? "glass"
                : "bordered",
          ),
          controlSize("large"),
          disabledModifier(off === true),
          ...(testID ? [accessibilityIdentifier(testID)] : []),
        ]}
      />
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { flexShrink: 0 },
  switcher: { alignSelf: "stretch" },
});
