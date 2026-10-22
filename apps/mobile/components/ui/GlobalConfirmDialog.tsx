/**
 * Global Confirm Dialog
 *
 * The web's (browser extension's) stand-in for a native confirmation alert. react-native-web's
 * Alert.alert does nothing, so showConfirmAlert opens this dialog instead. It has the look of
 * the Bookings and Availability confirm dialogs: a danger icon when an action is destructive,
 * the choices along the bottom, the cancel one outlined.
 *
 * Mounted once in the root layout, next to GlobalToast.
 */

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  type AlertButton,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { getColors } from "@/constants/colors";
import { type ConfirmRequest, setGlobalConfirmFunction } from "@/utils/alerts";

export function GlobalConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    setGlobalConfirmFunction(setRequest);
    return () => setGlobalConfirmFunction(null);
  }, []);

  // Mounted only while asking. RN Web places a modal's layer when it mounts, so one mounted at
  // launch would sit under a sheet opened since (an "Add a location" sheet hid the question).
  if (Platform.OS !== "web" || !request) return null;

  const buttons = request.buttons ?? [];
  const destructive = buttons.some((button) => button.style === "destructive");
  // Closes first: the button's action may open the next confirmation.
  const choose = (button?: AlertButton) => {
    setRequest(null);
    button?.onPress?.();
  };

  return (
    // A plain modal, not FullScreenModal: the question fits in the extension's sidebar, so the
    // sidebar keeps its width.
    <Modal
      visible
      transparent
      animationType="fade"
      // Escape: the cancel choice, as a native alert's dismissal. A tap outside does nothing, as
      // with a native alert and the Bookings and Availability confirm dialogs.
      onRequestClose={() => choose(buttons.find((button) => button.style === "cancel"))}
    >
      <View className="flex-1 items-center justify-center bg-black/50 p-4">
        <View className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-[#171717]">
          <View className="p-6">
            <View className="flex-row">
              {destructive ? (
                <View className="mr-3 self-start rounded-full bg-red-50 p-2 dark:bg-red-900/30">
                  <Ionicons name="alert-circle" size={20} color={theme.destructive} />
                </View>
              ) : null}

              <View className="flex-1">
                <Text
                  accessibilityRole="header"
                  className="mb-2 text-xl font-semibold text-gray-900 dark:text-white"
                >
                  {request.title}
                </Text>
                {request.message ? (
                  <Text className="text-sm leading-5 text-gray-600 dark:text-[#A3A3A3]">
                    {request.message}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <View className="flex-row flex-wrap justify-end gap-2 px-6 pb-6 pt-2">
            {buttons.map((button, index) =>
              button.style === "cancel" ? (
                <TouchableOpacity
                  // biome-ignore lint/suspicious/noArrayIndexKey: the buttons never reorder
                  key={index}
                  accessibilityRole="button"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 dark:border-[#4D4D4D] dark:bg-[#262626]"
                  onPress={() => choose(button)}
                >
                  <Text className="text-center text-base font-medium text-gray-700 dark:text-white">
                    {button.text}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  // biome-ignore lint/suspicious/noArrayIndexKey: the buttons never reorder
                  key={index}
                  accessibilityRole="button"
                  className="rounded-lg px-4 py-2.5"
                  style={{ backgroundColor: isDark ? "#FFFFFF" : "#111827" }}
                  onPress={() => choose(button)}
                >
                  <Text className="text-center text-base font-medium text-white dark:text-black">
                    {button.text}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
