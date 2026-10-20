import { Host, Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";
import { FieldLabel } from "./EditControls";
import type { SegmentedFieldProps } from "./SegmentedField";

/** A native segmented control, like iOS settings' short choices. */
export function SegmentedField<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedFieldProps<T>) {
  return (
    <View style={{ gap: 8 }}>
      <FieldLabel label={label} />
      <Host matchContents={{ vertical: true }} style={{ minHeight: 32 }}>
        {/* The segmented style doesn't draw its label, but VoiceOver can name the control by it. */}
        <Picker
          label={label}
          selection={value}
          onSelectionChange={(next) => onChange(next as T)}
          modifiers={[pickerStyle("segmented")]}
        >
          {options.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
      </Host>
    </View>
  );
}
