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
  const headerButton = (icon: "close" | "checkmark", onPress: () => void, disabled: boolean) => (
    <AppPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={icon === "close" ? "Close" : "Send"}
      className="h-10 w-10 items-center justify-center rounded-full border"
      style={{
        borderColor: theme.border,
        backgroundColor: theme.background,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Ionicons name={icon} size={20} color={theme.text} />
    </AppPressable>
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
