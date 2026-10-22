import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import { View } from "react-native";
import { useEditSurfaces, useEditTheme } from "@/components/cal-events/edit/EditControls";
import type { CalEventSheetProps } from "./CalEventSheet";

/**
 * A root-stack form sheet for an event's guest actions, like Add Guests: native xmark and
 * checkmark header buttons over liquid glass. The route's presentation is set in app/_layout.tsx.
 */
export function CalEventSheet({
  title,
  onClose,
  onSubmit,
  submitDisabled = false,
  children,
}: CalEventSheetProps) {
  const theme = useEditTheme();
  const surfaces = useEditSurfaces();
  const glass = isLiquidGlassAvailable();
  return (
    <>
      <Stack.Header>
        <Stack.Header.Left>
          <Stack.Header.Button
            onPress={onClose}
            tintColor={theme.backgroundEmphasis}
            variant="prominent"
          >
            <Stack.Header.Icon sf="xmark" />
          </Stack.Header.Button>
        </Stack.Header.Left>
        <Stack.Header.Title>{title}</Stack.Header.Title>
        <Stack.Header.Right>
          {onSubmit ? (
            <Stack.Header.Button
              onPress={onSubmit}
              disabled={submitDisabled}
              variant="prominent"
              tintColor={theme.text}
            >
              <Stack.Header.Icon sf="checkmark" />
            </Stack.Header.Button>
          ) : null}
        </Stack.Header.Right>
      </Stack.Header>
      <View
        style={{
          flex: 1,
          paddingTop: 56,
          backgroundColor: glass ? "transparent" : surfaces.screen,
        }}
      >
        {children}
      </View>
    </>
  );
}
