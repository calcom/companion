import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEditTheme } from "./EditControls";
import {
  DisabledSelectBox,
  SelectBox,
  SelectFieldFrame,
  type SelectFieldProps,
  type SelectOption,
  Swatches,
} from "./SelectFieldParts";

export type { SelectFieldProps, SelectOption };

/** A select like the web's: the dropdown menu here, a native menu on iOS (SelectField.ios). */
export function SelectField<T extends string | null>({
  label,
  options,
  value,
  onChange,
  placeholder = "Select",
  swatches,
  helper,
  disabled = false,
  accessibilityLabel,
}: SelectFieldProps<T>) {
  const theme = useEditTheme();
  const insets = useSafeAreaInsets();
  const selected = options.find((option) => option.value === value);
  const text = selected?.label ?? placeholder;
  const name = accessibilityLabel ?? label;
  if (disabled) {
    return (
      <SelectFieldFrame label={label} helper={helper}>
        <DisabledSelectBox label={name} text={text} />
      </SelectFieldFrame>
    );
  }
  return (
    <SelectFieldFrame label={label} helper={helper}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${text}`}>
            <SelectBox text={text} swatches={swatches ?? selected?.swatches} />
          </Pressable>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          insets={{ top: insets.top, bottom: insets.bottom, left: 12, right: 12 }}
          sideOffset={4}
          className="w-72"
          align="start"
        >
          {options.map((option) => {
            const checked = option.value === value;
            return (
              <DropdownMenuItem
                key={String(option.value)}
                onPress={() => onChange(option.value)}
                // The checkmark is only drawn; TalkBack announces the current option as selected.
                accessibilityState={{ selected: checked }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {option.swatches ? <Swatches colors={option.swatches} /> : null}
                    <Text
                      style={{
                        color: theme.text,
                        fontSize: 15,
                        fontWeight: checked ? "600" : "400",
                      }}
                    >
                      {option.label}
                    </Text>
                  </View>
                  {option.hint ? (
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{option.hint}</Text>
                  ) : null}
                </View>
                {checked ? <Ionicons name="checkmark" size={18} color={theme.text} /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </SelectFieldFrame>
  );
}
