import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalVideoEntry } from "@/components/video-call/CalVideoEntry";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { parseCalVideoLink } from "@/utils/cal-video-links";
import { getAvatarUrl } from "@/utils/getAvatarUrl";

/**
 * `/video-call?url=<room or booking url>` — where every Cal Video link lands, whether it arrived
 * as a universal link (`https://i.cal.video/peer`, `https://app.cal.com/video/<uid>`), the app
 * scheme, or a booking's Join button.
 */
export default function VideoCallRoute() {
  const { url } = useLocalSearchParams<{ url?: string }>();
  const router = useRouter();
  const { userInfo, accessToken, getFreshAccessToken } = useAuth();
  const { data: profile } = useUserProfile();
  const link = useMemo(() => parseCalVideoLink(url), [url]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, [router]);

  const viewerName = profile?.name?.trim() || userInfo?.name?.trim() || null;
  const viewerAvatarUrl = profile?.avatarUrl ? getAvatarUrl(profile.avatarUrl) : null;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: "fade",
          contentStyle: { backgroundColor: "#000000" },
        }}
      />
      {link ? (
        <CalVideoEntry
          link={link}
          viewerName={viewerName}
          viewerAvatarUrl={viewerAvatarUrl}
          accessToken={accessToken}
          getAccessToken={getFreshAccessToken}
          onClose={close}
        />
      ) : (
        <InvalidLink onClose={close} />
      )}
    </>
  );
}

function InvalidLink({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.center}>
        <Text style={styles.title}>Not a Cal Video room</Text>
        <Text style={styles.body}>This link does not point at a room the app can open.</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}>
        <Text style={styles.buttonText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000", paddingHorizontal: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "600" },
  body: { color: "rgba(255,255,255,0.65)", fontSize: 15, textAlign: "center" },
  button: {
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#111111", fontSize: 17, fontWeight: "600" },
});
