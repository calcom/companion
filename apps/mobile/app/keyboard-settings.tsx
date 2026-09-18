import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import { getColors } from "@/constants/colors";
import { getKeyboardData } from "@/utils/keyboardStorage";
import { composeKeyboardInsertion } from "@/utils/keyboardStorage.shared";

const IOS_STEPS = [
  "Open Settings → General → Keyboard → Keyboards.",
  "Tap Add New Keyboard and choose Cal.com.",
  "In any text field, hold the globe key and pick Cal.com.",
];

const ANDROID_STEPS = [
  "Open Settings → System → Languages & input → On-screen keyboard.",
  "Tap Manage keyboards and enable Cal.com.",
  "In any text field, tap the keyboard-switch key and pick Cal.com.",
];

export default function KeyboardSettings() {
  const [keyboardData, setKeyboardData] =
    useState<Awaited<ReturnType<typeof getKeyboardData>>>(null);
  const isDark = useColorScheme() === "dark";
  const colors = getColors(isDark);

  useEffect(() => {
    getKeyboardData().then(setKeyboardData);
  }, []);

  const openKeyboardSettings = () => {
    if (Platform.OS === "ios") {
      Linking.openSettings();
    } else {
      Linking.sendIntent("android.settings.INPUT_METHOD_SETTINGS");
    }
  };

  const steps = Platform.OS === "ios" ? IOS_STEPS : ANDROID_STEPS;
  const exampleLink = keyboardData?.links[0];
  const exampleSelections =
    exampleLink?.days.flatMap((day) => day.slots.map((slot) => ({ day, slot }))).slice(0, 2) ?? [];
  const exampleText =
    exampleLink && exampleSelections.length > 0
      ? composeKeyboardInsertion(exampleLink, exampleSelections, keyboardData.timeZone)
      : null;
  const linkCount = keyboardData?.links.length ?? 0;
  const isSynced = linkCount > 0;

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Cal.com Keyboard" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="mb-8 items-center">
          <View
            className="mb-4 h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: colors.backgroundMuted }}
          >
            <Ionicons name="keypad-outline" size={26} color={colors.text} />
          </View>
          <Text className="mb-2 text-center text-2xl font-bold" style={{ color: colors.text }}>
            Cal.com Keyboard
          </Text>
          <Text className="text-center text-base leading-6" style={{ color: colors.textSecondary }}>
            Share a booking link with times already picked, without leaving the app you're typing
            in.
          </Text>
        </View>

        <Text
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: colors.textMuted }}
        >
          {Platform.OS === "ios" ? "Set up on iPhone and iPad" : "Set up on Android"}
        </Text>
        <View
          className="mb-4 overflow-hidden rounded-2xl border"
          style={{ borderColor: colors.border, backgroundColor: colors.backgroundSecondary }}
        >
          {steps.map((step, index) => (
            <View
              key={step}
              className="flex-row items-start px-4 py-4"
              style={
                index === 0 ? undefined : { borderTopWidth: 1, borderTopColor: colors.borderSubtle }
              }
            >
              <View
                className="mr-3 h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.backgroundEmphasis }}
              >
                <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                  {index + 1}
                </Text>
              </View>
              <Text className="flex-1 text-base leading-6" style={{ color: colors.text }}>
                {step}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          className="mb-3 flex-row items-center justify-center rounded-xl px-4 py-3.5"
          style={{ backgroundColor: colors.accent }}
          onPress={openKeyboardSettings}
        >
          <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
          <Text className="ml-2 text-base font-semibold" style={{ color: "#FFFFFF" }}>
            Open keyboard settings
          </Text>
        </Pressable>
        {Platform.OS === "ios" && (
          <View className="mb-8 flex-row items-center justify-center">
            <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
            <Text className="ml-1.5 text-xs" style={{ color: colors.textMuted }}>
              Allow Full Access is not required
            </Text>
          </View>
        )}

        {exampleText && (
          <>
            <Text
              className="mb-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.textMuted }}
            >
              What gets inserted
            </Text>
            <View
              className="mb-8 rounded-2xl px-4 py-3"
              style={{ backgroundColor: colors.backgroundMuted }}
            >
              <Text
                className="text-[13px] leading-5"
                style={{
                  color: colors.text,
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                }}
              >
                {exampleText}
              </Text>
            </View>
          </>
        )}

        <Text
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: colors.textMuted }}
        >
          Sync
        </Text>
        <View
          className="rounded-2xl border px-4 py-4"
          style={{ borderColor: colors.border, backgroundColor: colors.backgroundSecondary }}
        >
          <View className="mb-1 flex-row items-center">
            <View
              className="mr-2 h-2 w-2 rounded-full"
              style={{ backgroundColor: isSynced ? colors.success : colors.warning }}
            />
            <Text className="flex-1 text-base font-medium" style={{ color: colors.text }}>
              {isSynced
                ? `${linkCount} ${linkCount === 1 ? "link" : "links"} ready`
                : "No links synced yet"}
            </Text>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {keyboardData?.lastUpdated
                ? new Date(keyboardData.lastUpdated).toLocaleString()
                : "—"}
            </Text>
          </View>
          <Text className="text-sm leading-5" style={{ color: colors.textSecondary }}>
            Your links and available times refresh whenever you open this app. The keyboard reads
            them from your device and never fetches anything itself.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
