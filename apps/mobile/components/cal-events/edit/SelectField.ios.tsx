import { Button, ContextMenu, Host, Image, Rectangle, Text } from "@expo/ui/swift-ui";
import { accessibilityLabel, foregroundStyle, opacity } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";
import { useEditTheme } from "./EditControls";
import {
  DisabledSelectBox,
  SelectBox,
  SelectFieldFrame,
  type SelectFieldProps,
  type SelectOption,
} from "./SelectFieldParts";

export type { SelectFieldProps, SelectOption };

/**
 * A native menu over the select, like the event type editor's pickers. An option's hint shows as
 * its item's subtitle; a description of the choice goes in `helper` under the select.
 */
export function SelectField<T extends string | null>({
  label,
  options,
  value,
  onChange,
  placeholder = "Select",
  swatches,
  helper,
  disabled = false,
  // Renamed: the SwiftUI modifier imported above is also called accessibilityLabel.
  accessibilityLabel: spokenLabel,
}: SelectFieldProps<T>) {
  const theme = useEditTheme();
  const selected = options.find((option) => option.value === value);
  const text = selected?.label ?? placeholder;
  const name = spokenLabel ?? label;
  if (disabled) {
    return (
      <SelectFieldFrame label={label} helper={helper}>
        <DisabledSelectBox label={name} text={text} />
      </SelectFieldFrame>
    );
  }
  return (
    <SelectFieldFrame label={label} helper={helper}>
      {/* React Native lays the select out; the menu only covers it to catch the tap. Hosting the
          select inside the menu instead mismeasured its height once it had swatches. */}
      <View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SelectBox text={text} swatches={swatches ?? selected?.swatches} />
        </View>
        <Host style={StyleSheet.absoluteFill}>
          <ContextMenu activationMethod="singlePress">
            <ContextMenu.Items>
              {options.map((option) =>
                option.hint ? (
                  // A menu item reads a second text as its subtitle.
                  <Button key={String(option.value)} onPress={() => onChange(option.value)}>
                    {option.value === value ? <Image systemName="checkmark" /> : null}
                    <Text>{option.label}</Text>
                    <Text>{option.hint}</Text>
                  </Button>
                ) : (
                  <Button
                    key={String(option.value)}
                    systemImage={option.value === value ? "checkmark" : undefined}
                    onPress={() => onChange(option.value)}
                    label={option.label}
                  />
                )
              )}
            </ContextMenu.Items>
            <ContextMenu.Trigger>
              {/* A shape fills the host. Nearly transparent, as SwiftUI doesn't hit-test a fully
                  transparent view. */}
              <Rectangle
                modifiers={[
                  foregroundStyle(theme.background),
                  opacity(0.01),
                  accessibilityLabel(`${name}, ${text}`),
                ]}
              />
            </ContextMenu.Trigger>
          </ContextMenu>
        </Host>
      </View>
    </SelectFieldFrame>
  );
}
