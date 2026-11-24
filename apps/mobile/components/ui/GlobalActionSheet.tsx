/**
 * Global Action Sheet
 *
 * Android's stand-in for the iOS action sheet: showActionSheet opens it with a list of choices
 * and a Cancel row. Dark, like the iOS sheets it opens beside (the Cal Video screen's menus).
 *
 * Mounted once in the root layout, next to GlobalConfirmDialog. It's a modal of its own, so it
 * opens above a modal already showing, such as the call's Chat sheet.
 */

import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  type ActionSheetItem,
  type ActionSheetRequest,
  setActionSheetPresenter,
} from "@/utils/action-sheet";

export function GlobalActionSheet() {
  const [request, setRequest] = useState<ActionSheetRequest | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    setActionSheetPresenter(setRequest);
    return () => setActionSheetPresenter(null);
  }, []);

  if (Platform.OS !== "android" || !request) return null;

  // Closes first: the item's action may open the next sheet (the Microphone list does).
  const choose = (item?: ActionSheetItem) => {
    setRequest(null);
    item?.onPress();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => choose()}
    >
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={() => choose()} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
        {request.title || request.message ? (
          <View style={styles.heading}>
            {request.title ? (
              <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>
                {request.title}
              </Text>
            ) : null}
            {request.message ? <Text style={styles.message}>{request.message}</Text> : null}
          </View>
        ) : null}
        <ScrollView bounces={false}>
          {request.items.map((item, index) => (
            <Pressable
              // biome-ignore lint/suspicious/noArrayIndexKey: two items may share a label
              key={index}
              accessibilityRole="button"
              android_ripple={{ color: RIPPLE }}
              style={styles.row}
              onPress={() => choose(item)}
            >
              <Text style={[styles.label, item.destructive && styles.destructive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: RIPPLE }}
          style={styles.row}
          onPress={() => choose()}
        >
          <Text style={[styles.label, styles.cancel]}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const RIPPLE = "rgba(255,255,255,0.12)";

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    maxHeight: "80%",
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
  },
  heading: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  title: { color: "#A1A1AA", fontSize: 13, fontWeight: "600" },
  message: { color: "#A1A1AA", fontSize: 13 },
  row: { minHeight: 52, justifyContent: "center", paddingHorizontal: 20 },
  label: { color: "#FFFFFF", fontSize: 16 },
  destructive: { color: "#FF453A" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginTop: 4,
  },
  cancel: { fontWeight: "600" },
});
