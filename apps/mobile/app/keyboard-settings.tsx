import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import { getColors } from "@/constants/colors";
import { getKeyboardData } from "@/utils/keyboardStorage";

export default function KeyboardSettings() {
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const isDark = useColorScheme() === "dark";
  const colors = getColors(isDark);

  useEffect(() => {
    getKeyboardData().then((data) => setLastUpdated(data?.lastUpdated ?? null));
  }, []);

  const openKeyboardSettings = () => {
    if (Platform.OS === "ios") {
      Linking.openSettings();
    } else {
      Linking.sendIntent("android.settings.INPUT_METHOD_SETTINGS");
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Cal.com Keyboard" }} />
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text className="mb-2 text-2xl font-bold" style={{ color: colors.text }}>
          Cal.com Keyboard
        </Text>
        <Text className="mb-6 text-base" style={{ color: colors.textSecondary }}>
          Insert booking links and prefilled times into any app.
        </Text>
        <Text className="mb-2 text-lg font-semibold" style={{ color: colors.text }}>
          {Platform.OS === "ios" ? "iPhone and iPad" : "Android"}
        </Text>
        {(Platform.OS === "ios"
          ? [
              "Open Settings → General → Keyboard → Keyboards.",
              "Tap Add New Keyboard and choose Cal.com.",
              "Switch to Cal.com from any text field using the globe key.",
            ]
          : [
              "Open Settings → System → Languages & input → On-screen keyboard.",
              "Tap Manage keyboards and enable Cal.com.",
              "Switch to Cal.com using the keyboard-switch key.",
            ]
        ).map((step, index) => (
          <Text key={step} className="mb-3 text-base" style={{ color: colors.text }}>
            {index + 1}. {step}
          </Text>
        ))}
        {Platform.OS === "ios" && (
          <Text className="mb-6 text-sm" style={{ color: colors.textSecondary }}>
            Allow Full Access is not required.
          </Text>
        )}
        <Pressable
          className="mb-6 rounded-lg px-4 py-3"
          style={{ backgroundColor: colors.accent }}
          onPress={openKeyboardSettings}
        >
          <Text className="text-center font-semibold" style={{ color: "#FFFFFF" }}>
            Open keyboard settings
          </Text>
        </Pressable>
        <Text className="text-sm" style={{ color: colors.textSecondary }}>
          Last synced: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Not yet"}
        </Text>
        <Text className="mt-4 text-sm" style={{ color: colors.textSecondary }}>
          Open the Cal.com app to refresh your keyboard data. The keyboard never fetches network
          data itself.
        </Text>
      </ScrollView>
    </View>
  );
}
