/**
 * System haptics, named for what they confirm.
 *
 * HIG: play haptics to confirm the result of an action the person took, not on every touch,
 * and keep them consistent: success when something they asked for is done, warning before a
 * destructive choice, error when it didn't work, selection when a value changes. All of them
 * are no-ops on the web and never throw (some devices have no Taptic Engine).
 */
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const enabled = Platform.OS === "ios" || Platform.OS === "android";

function play(effect: () => Promise<void>) {
  if (!enabled) return;
  effect().catch(() => undefined);
}

export const haptics = {
  /** A value changed: a picker, a segmented control, a toggle. */
  selection: () => play(() => Haptics.selectionAsync()),
  /** Something the person asked for finished. */
  success: () => play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A destructive choice is about to be confirmed. */
  warning: () => play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** The action failed. */
  error: () => play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** A light physical tap, for presses on custom controls. */
  light: () => play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
};
