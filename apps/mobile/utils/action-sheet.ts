import { ActionSheetIOS, Alert, Platform } from "react-native";

export interface ActionSheetItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * A list of choices in the platform's own idiom: the iOS action sheet, an Android alert.
 * Disabled items are left out rather than greyed, since neither surface greys reliably.
 */
export function showActionSheet(input: {
  title?: string;
  message?: string;
  items: ActionSheetItem[];
}) {
  const items = input.items.filter((item) => !item.disabled);
  if (items.length === 0) return;
  if (Platform.OS === "ios") {
    const options = [...items.map((item) => item.label), "Cancel"];
    const destructiveButtonIndex = items.findIndex((item) => item.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: input.title,
        message: input.message,
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: destructiveButtonIndex === -1 ? undefined : destructiveButtonIndex,
        userInterfaceStyle: "dark",
      },
      (index) => {
        items[index]?.onPress();
      }
    );
    return;
  }
  Alert.alert(input.title ?? "", input.message, [
    ...items.map((item) => ({
      text: item.label,
      onPress: item.onPress,
      style: item.destructive ? ("destructive" as const) : ("default" as const),
    })),
    { text: "Cancel", style: "cancel" as const },
  ]);
}
