import { Ionicons } from "@expo/vector-icons";
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCheckInCalEventGuestByTicket } from "@/hooks";
import {
  CAL_EVENT_INVALID_TICKET_MESSAGE,
  createCalEventScanGate,
  formatCalEventCheckInTime,
  getCalEventGuestName,
  getCalEventTicketCheckInErrorMessage,
  isCalEventCheckInTokenShaped,
} from "@/utils/cal-events";

type ScanResult =
  | { tone: "success"; title: string; detail: string }
  | { tone: "info"; title: string; detail: string }
  | { tone: "error"; title: string };

// The camera fills the screen in either theme, so the overlay is always light on dark.
const RESULT_STYLES = {
  waiting: { backgroundColor: "rgba(28, 28, 30, 0.85)", icon: null },
  success: { backgroundColor: "#248A3D", icon: "checkmark-circle" },
  info: { backgroundColor: "#3A3A3C", icon: "information-circle" },
  error: { backgroundColor: "#D70015", icon: "close-circle" },
} as const;

/** Camera sheet that checks guests in from their QR tickets, one after another, until Done. */
export default function CalEventCheckInScannerScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionAsk, setPermissionAsk] = useState<"not_asked" | "asking" | "asked">("not_asked");
  const [cameraFailed, setCameraFailed] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanGate] = useState(() => createCalEventScanGate());
  const { mutateAsync: checkInByTicket } = useCheckInCalEventGuestByTicket(uuid);

  // Ask once per opening. Once refused, iOS won't ask again, so the screen points to Settings.
  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain) return;
    if (permissionAsk !== "not_asked") return;
    setPermissionAsk("asking");
    requestPermission().finally(() => setPermissionAsk("asked"));
  }, [permission, permissionAsk, requestPermission]);

  // Android reads the result box out through its live region; iOS has none, so announce it there.
  useEffect(() => {
    if (!result || Platform.OS !== "ios") return;
    const detail = result.tone === "error" ? "" : `, ${result.detail}`;
    AccessibilityInfo.announceForAccessibility(`${result.title}${detail}`);
  }, [result]);

  const cameraReady = !!permission?.granted && !cameraFailed;
  const cameraUnavailable =
    cameraFailed ||
    (!!permission && !permission.granted && (!permission.canAskAgain || permissionAsk === "asked"));

  const redeem = async (token: string) => {
    if (!isCalEventCheckInTokenShaped(token)) {
      setResult({ tone: "error", title: CAL_EVENT_INVALID_TICKET_MESSAGE });
      return;
    }
    try {
      const outcome = await checkInByTicket(token);
      if (outcome.kind === "checked_in") {
        setResult({
          tone: "success",
          title: getCalEventGuestName(outcome.guest),
          detail: "Checked in",
        });
      } else if (outcome.kind === "already_checked_in") {
        setResult({
          tone: "info",
          title: getCalEventGuestName(outcome.guest),
          detail: `Already checked in at ${formatCalEventCheckInTime(outcome.checkedInAt)}`,
        });
      } else {
        setResult({ tone: "error", title: "This registration is no longer confirmed" });
      }
    } catch (error) {
      setResult({ tone: "error", title: getCalEventTicketCheckInErrorMessage(error) });
    }
  };

  const onCode = (token: string) => {
    if (!scanGate.take(token)) return;
    redeem(token).finally(() => scanGate.settle(token));
  };

  const resultStyle = RESULT_STYLES[result?.tone ?? "waiting"];

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      {/* iOS styles the status bar over its sheet; Android opens this full screen, on black. */}
      {Platform.OS === "android" ? <StatusBar style="light" /> : null}
      {cameraReady ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }: BarcodeScanningResult) => onCode(data)}
          onMountError={() => setCameraFailed(true)}
        />
      ) : null}

      <View
        style={{
          // An iOS sheet starts below the status bar; Android's full-screen modal doesn't.
          paddingTop: Platform.OS === "ios" ? 20 : insets.top + 8,
          paddingHorizontal: 20,
          flexDirection: "row",
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700" }}
            accessibilityRole="header"
          >
            Scan ticket
          </Text>
          <Text style={{ color: "rgba(255, 255, 255, 0.75)", fontSize: 15, marginTop: 2 }}>
            Point the camera at a guest's QR code
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={12}
          style={{ paddingVertical: 4 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "600" }}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
        {cameraUnavailable ? (
          <>
            <Text style={{ color: "rgba(255, 255, 255, 0.85)", fontSize: 16, textAlign: "center" }}>
              Camera unavailable. Allow camera access, or use the list below to check guests in.
            </Text>
            {cameraFailed ? null : (
              <TouchableOpacity
                onPress={() => Linking.openSettings()}
                accessibilityRole="link"
                hitSlop={8}
                style={{ marginTop: 16 }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                  Open Settings
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : cameraReady ? (
          <View
            style={{
              width: 240,
              height: 240,
              borderRadius: 24,
              borderWidth: 3,
              borderColor: "rgba(255, 255, 255, 0.9)",
            }}
          />
        ) : null}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: "row",
              alignItems: "center",
              minHeight: 64,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 16,
              backgroundColor: resultStyle.backgroundColor,
            }}
          >
            {resultStyle.icon ? (
              <Ionicons
                name={resultStyle.icon}
                size={28}
                color="#FFFFFF"
                style={{ marginRight: 12 }}
              />
            ) : null}
            {result ? (
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "600" }}
                  numberOfLines={1}
                >
                  {result.title}
                </Text>
                {result.tone !== "error" ? (
                  <Text style={{ color: "rgba(255, 255, 255, 0.85)", fontSize: 15, marginTop: 2 }}>
                    {result.detail}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={{ color: "rgba(255, 255, 255, 0.75)", fontSize: 16 }}>
                Waiting for a code…
              </Text>
            )}
          </View>
          {__DEV__ ? <DevTicketCodeField onSubmit={onCode} /> : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Development builds only. The iOS Simulator has no camera, so paste a ticket's code here to send
 * it down the same path as a scan, hold included.
 */
function DevTicketCodeField({ onSubmit }: { onSubmit: (token: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <TextInput
      testID="dev-ticket-code"
      value={code}
      onChangeText={setCode}
      onSubmitEditing={() => onSubmit(code.trim())}
      placeholder="Ticket code (dev builds only)"
      placeholderTextColor="rgba(255, 255, 255, 0.5)"
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="send"
      accessibilityLabel="Ticket code"
      style={{
        marginTop: 12,
        height: 44,
        paddingHorizontal: 14,
        borderRadius: 12,
        color: "#FFFFFF",
        fontSize: 15,
        backgroundColor: "rgba(28, 28, 30, 0.85)",
      }}
    />
  );
}
