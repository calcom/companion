import { ActionSheetIOS, Alert, Platform } from "react-native";

export interface ActionSheetItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface ActionSheetRequest {
  title?: string;
  message?: string;
  items: ActionSheetItem[];
}

/** Opens GlobalActionSheet, which sets it on mount (Android only). */
let presentSheet: ((request: ActionSheetRequest) => void) | null = null;

export function setActionSheetPresenter(present: typeof presentSheet) {
  presentSheet = present;
}

/**
 * A list of choices: the iOS action sheet, or on Android a bottom sheet (GlobalActionSheet). An
 * Android alert keeps only three buttons, so a longer menu lost its last items and Cancel.
 * Disabled items are left out rather than greyed, since the iOS sheet doesn't grey reliably.
 */
export function showActionSheet(input: ActionSheetRequest) {
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
  if (presentSheet) {
    presentSheet({ title: input.title, message: input.message, items });
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
