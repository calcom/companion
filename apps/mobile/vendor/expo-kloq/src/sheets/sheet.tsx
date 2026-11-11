import type { ReactNode } from "react";
import { Modal, Platform, StyleSheet, Text, View } from "react-native";
import { SheetButton } from "../native/controls";
import { usePalette } from "../theme.ts";

export interface SheetProps {
  visible: boolean;
  title: string;
  onCancel: () => void;
  cancelLabel?: string;
  /** omitted → no confirm button (a read-only event, a settings sheet) */
  confirm?: { label: string; onPress: () => void; disabled?: boolean; testID?: string };
  children: ReactNode;
}

/**
 * A native page sheet (UIKit's on iOS, a full-screen dialog on Android) with its actions pinned
 * above the content, so Save stays reachable however long the form underneath scrolls.
 */
export function Sheet({
  visible,
  title,
  onCancel,
  cancelLabel = "Cancel",
  confirm,
  children,
}: SheetProps) {
  const p = usePalette();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onCancel}
    >
      <View style={[styles.sheet, { backgroundColor: p.dark ? "#1c1c1e" : "#f2f2f7" }]}>
        <View style={styles.header}>
          <View style={styles.side}>
            <SheetButton label={cancelLabel} onPress={onCancel} testID="kloq-sheet-cancel" />
          </View>
          <Text style={[styles.title, { color: p.text }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.side, styles.end]}>
            {confirm ? (
              <SheetButton
                label={confirm.label}
                onPress={confirm.onPress}
                prominent
                disabled={confirm.disabled}
                testID={confirm.testID}
              />
            ) : null}
          </View>
        </View>
        <View style={styles.body}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 14 : 40,
    paddingBottom: 8,
    gap: 8,
  },
  side: { flex: 1, flexDirection: "row" },
  end: { justifyContent: "flex-end" },
  title: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  body: { flex: 1 },
});
