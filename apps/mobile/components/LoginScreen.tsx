import { useEffect, useState } from "react";
import { Platform, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { showErrorAlert } from "@/utils/alerts";
import { openInAppBrowser } from "@/utils/browser";
import { haptics } from "@/utils/haptics";
import {
  type CalRegion,
  getCalAppUrl,
  getRegion,
  preloadRegion,
  setRegion,
  subscribeRegion,
} from "@/utils/region";
import { CalComLogo } from "./CalComLogo";
import { RegionPicker } from "./RegionPicker";
import { SystemButton } from "./SystemButton";

export function LoginScreen() {
  const { loginWithOAuth, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [region, setRegionState] = useState<CalRegion>(getRegion());
  // Blocks the Continue CTA until the persisted region has been loaded, so
  // a fast tap can't start an OAuth flow against the US default while the
  // user's saved preference is still in flight.
  const [regionPreloadPending, setRegionPreloadPending] = useState(true);

  useEffect(() => {
    preloadRegion().then((loaded) => {
      setRegionState(loaded);
      setRegionPreloadPending(false);
    });
    return subscribeRegion(setRegionState);
  }, []);

  const handleOAuthLogin = async () => {
    if (regionPreloadPending) return;
    try {
      await loginWithOAuth();
    } catch (error) {
      console.error("OAuth login error");
      haptics.error();
      showErrorAlert(
        "Login Failed",
        error instanceof Error
          ? error.message
          : "Failed to login with OAuth. Please check your configuration and try again."
      );
    }
  };

  const handleSignUp = async () => {
    await openInAppBrowser(`${getCalAppUrl(region)}/signup`, "Sign up page");
  };

  const handleRegionChange = async (next: CalRegion) => {
    await setRegion(next);
  };

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {/* Logo centered in the middle */}
      <View className="flex-1 items-center justify-center">
        <CalComLogo width={180} height={40} color={isDark ? "#FFFFFF" : "#111827"} />
      </View>

      {/* Bottom section with region select + CTA */}
      <View className="px-6" style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
        <View className="mb-4">
          <RegionPicker
            region={region}
            onChange={handleRegionChange}
            disabled={loading || regionPreloadPending}
          />
        </View>

        <SystemButton
          title="Continue with Cal.com"
          size="large"
          onPress={handleOAuthLogin}
          disabled={regionPreloadPending}
          loading={loading}
          accessibilityHint="Opens Cal.com in a secure browser to sign in"
        />

        {/* Sign up link - hidden on iOS */}
        {Platform.OS !== "ios" && (
          <TouchableOpacity
            onPress={handleSignUp}
            className="mt-3 min-h-[44px] items-center justify-center py-1"
            style={Platform.OS === "web" ? { cursor: "pointer" } : undefined}
            accessibilityRole="link"
            activeOpacity={0.7}
          >
            <View>
              <Text className="text-[15px] text-gray-500 dark:text-[#A3A3A3]">
                Don't have an account?{" "}
                <Text className="font-semibold text-gray-900 dark:text-white">Sign up</Text>
              </Text>
              <View className="h-px bg-gray-400 dark:bg-[#4D4D4D]" style={{ marginTop: 2 }} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default LoginScreen;
