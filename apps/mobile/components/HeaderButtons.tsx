/**
 * The round buttons of an editor's header on the web and Android, as the Links editor draws
 * them: back, a pill (such as the tab switcher) and Save. iOS uses the native header instead,
 * but the Events editor's item sheets, which have no native header, use these everywhere.
 */

import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Text, useColorScheme } from "react-native";
import { AppPressable } from "@/components/AppPressable";

/** A round icon button, such as back or "⋯". */
export const HEADER_ICON_BUTTON_CLASS =
  "h-10 w-10 items-center justify-center rounded-full border border-[#E5E5E5] bg-white dark:border-[#262626] dark:bg-[#171717]";

/** A pill with a label, such as the tab switcher; spread onto a menu trigger's child. */
export const HEADER_PILL_CLASS =
  "h-10 flex-row items-center justify-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-4 dark:border-[#262626] dark:bg-[#171717]";

export function HeaderBackButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  const isDark = useColorScheme() === "dark";
  return (
    <AppPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Back"
      accessibilityState={{ disabled }}
      className={`mr-2 ${HEADER_ICON_BUTTON_CLASS}`}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Ionicons name="chevron-back" size={20} color={isDark ? "#FFFFFF" : "#000000"} />
    </AppPressable>
  );
}

/** A pill that dismisses without saving, such as a sheet's Cancel. */
export function HeaderCancelButton({
  label = "Cancel",
  onPress,
  disabled = false,
}: {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <AppPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      className={HEADER_PILL_CLASS}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Text className="text-[15px] font-medium text-black dark:text-white">{label}</Text>
    </AppPressable>
  );
}

export function HeaderSaveButton({
  label = "Save",
  onPress,
  saving,
  dirty,
  testID,
}: {
  label?: string;
  onPress: () => void;
  saving: boolean;
  /** Whether there is anything to save: without it the button is greyed out. */
  dirty: boolean;
  testID?: string;
}) {
  const isDark = useColorScheme() === "dark";
  const inactive = saving || !dirty;
  return (
    <AppPressable
      onPress={onPress}
      disabled={inactive}
      testID={testID}
      accessibilityRole="button"
      // Named even while the spinner stands in for the label. The aria props, unlike
      // accessibilityState, reach the web too.
      accessibilityLabel={label}
      aria-disabled={inactive}
      aria-busy={saving}
      className={`h-10 flex-row items-center justify-center rounded-full border px-5 ${
        inactive
          ? "border-[#E5E5EA] bg-[#E5E5EA] dark:border-[#262626] dark:bg-[#262626]"
          : "border-black bg-black dark:border-white dark:bg-white"
      }`}
    >
      {saving ? (
        <ActivityIndicator size="small" color="#A3A3A3" />
      ) : (
        <Text
          className={`text-[15px] font-medium ${
            inactive ? "text-[#A3A3A3]" : isDark ? "text-black" : "text-white"
          }`}
        >
          {label}
        </Text>
      )}
    </AppPressable>
  );
}
