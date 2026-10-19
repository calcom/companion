import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import { View } from "react-native";
import {
  SelectBox,
  SelectFieldFrame,
  type SelectFieldProps,
  type SelectOption,
} from "./SelectFieldParts";

export type { SelectFieldProps, SelectOption };

/**
 * A native menu over the select, like the event type editor's pickers. Its items show labels only,
 * so a description goes in `helper` under the select.
 */
export function SelectField<T extends string | null>({
  label,
  options,
  value,
  onChange,
  placeholder = "Select",
  swatches,
  helper,
}: SelectFieldProps<T>) {
  const selected = options.find((option) => option.value === value);
  const text = selected?.label ?? placeholder;
  return (
    <SelectFieldFrame label={label} helper={helper}>
      <Host matchContents>
        <ContextMenu activationMethod="singlePress">
          <ContextMenu.Items>
            {options.map((option) => (
              <Button
                key={String(option.value)}
                systemImage={option.value === value ? "checkmark" : undefined}
                onPress={() => onChange(option.value)}
                label={option.label}
              />
            ))}
          </ContextMenu.Items>
          <ContextMenu.Trigger>
            <View accessible accessibilityRole="button" accessibilityLabel={`${label}, ${text}`}>
              <SelectBox text={text} swatches={swatches ?? selected?.swatches} />
            </View>
          </ContextMenu.Trigger>
        </ContextMenu>
      </Host>
    </SelectFieldFrame>
  );
}
