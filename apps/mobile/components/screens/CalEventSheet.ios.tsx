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
      <Stack.Header />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          onPress={onClose}
          tintColor={theme.backgroundEmphasis}
          variant="prominent"
        >
          <Stack.Toolbar.Icon sf="xmark" />
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Title>{title}</Stack.Title>
      <Stack.Toolbar placement="right">
        {onSubmit ? (
          <Stack.Toolbar.Button
            onPress={onSubmit}
            disabled={submitDisabled}
            variant="prominent"
            tintColor={theme.text}
          >
            <Stack.Toolbar.Icon sf="checkmark" />
          </Stack.Toolbar.Button>
        ) : null}
      </Stack.Toolbar>

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
