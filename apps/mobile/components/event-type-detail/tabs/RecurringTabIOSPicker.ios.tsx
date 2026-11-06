import { Button, Host, HStack, Image, Menu } from "@expo/ui/swift-ui";
import { buttonStyle } from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";

interface RecurringTabIOSPickerProps {
  options: { label: string; value: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export function RecurringTabIOSPicker({
  options,
  selectedValue,
  onSelect,
}: RecurringTabIOSPickerProps) {
  return (
    <Host matchContents>
      <Menu
        modifiers={[buttonStyle(isLiquidGlassAvailable() ? "glass" : "bordered")]}
        label={
          <HStack>
            <Image systemName="chevron.up.chevron.down" color="primary" size={13} />
          </HStack>
        }
      >
        {options.map((opt) => (
          <Button
            key={opt.value}
            systemImage={selectedValue === opt.label ? "checkmark" : undefined}
            onPress={() => onSelect(opt.value)}
            label={opt.label}
          />
        ))}
      </Menu>
    </Host>
  );
}
