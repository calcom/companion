import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { AppPressable } from "@/components/AppPressable";
import { useEditTheme } from "@/components/cal-events/edit/EditControls";
import { HeaderButtonWrapper } from "@/components/HeaderButtonWrapper";

export interface CalEventSheetProps {
  title: string;
  onClose: () => void;
  /** The header's checkmark; no checkmark without it. */
  onSubmit?: () => void;
  submitDisabled?: boolean;
  children: ReactNode;
}

/** A contained modal for an event's guest actions, with close and checkmark header buttons. */
export function CalEventSheet({
  title,
  onClose,
  onSubmit,
  submitDisabled = false,
  children,
}: CalEventSheetProps) {
  const theme = useEditTheme();
  // Dimmed on a wrapper: AppPressable's press animation sets its own opacity over the style's.
  // Pressable reports `disabled` to screen readers itself.
  const headerButton = (icon: "close" | "checkmark", onPress: () => void, disabled: boolean) => (
    <View style={{ opacity: disabled ? 0.5 : 1 }}>
      <AppPressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={icon === "close" ? "Close" : "Send"}
        className="h-10 w-10 items-center justify-center rounded-full border"
        style={{ borderColor: theme.border, backgroundColor: theme.background }}
      >
        <Ionicons name={icon} size={20} color={theme.text} />
      </AppPressable>
    </View>
  );
  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerLeft: () => (
            <HeaderButtonWrapper side="left">
              {headerButton("close", onClose, false)}
            </HeaderButtonWrapper>
          ),
          headerRight: onSubmit
            ? () => (
                <HeaderButtonWrapper side="right">
                  {headerButton("checkmark", onSubmit, submitDisabled)}
                </HeaderButtonWrapper>
              )
            : undefined,
        }}
      />
      <View style={{ flex: 1, backgroundColor: theme.backgroundSecondary }}>{children}</View>
    </>
  );
}
