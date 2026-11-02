import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Platform, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { OAuthCancelledError } from "@/services/oauthService";
import { showErrorAlert } from "@/utils/alerts";
import {
  type CalRegion,
  getRegion,
  preloadRegion,
  setRegion,
  subscribeRegion,
} from "@/utils/region";
import { CalComLogo } from "./CalComLogo";
import { SignupScreen } from "./SignupScreen";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const REGION_OPTIONS: { value: CalRegion; label: string }[] = [
  { value: "us", label: "United States" },
  { value: "eu", label: "European Union" },
];

function getRegionLabel(region: CalRegion): string {
  return REGION_OPTIONS.find((option) => option.value === region)?.label ?? "United States";
}

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
  const [regionTriggerWidth, setRegionTriggerWidth] = useState(0);
  const [showSignup, setShowSignup] = useState(false);
  const closeSignup = useCallback(() => setShowSignup(false), []);

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
      if (error instanceof OAuthCancelledError) return;
      console.error("OAuth login error");
      showErrorAlert(
        "Login Failed",
        error instanceof Error
          ? error.message
          : "Failed to login with OAuth. Please check your configuration and try again."
      );
    }
  };

  const handleSignUp = async () => {
    if (regionPreloadPending) return;
    // The web build (and the extension iframe) can't call the signup API cross-origin,
    // so it signs up on Cal.com in a popup that continues straight into sign-in.
    if (Platform.OS !== "web") {
      setShowSignup(true);
      return;
    }
    try {
      await loginWithOAuth("signup");
    } catch (error) {
      if (error instanceof OAuthCancelledError) return;
      showErrorAlert(
        "Sign Up Failed",
        error instanceof Error ? error.message : "Failed to sign up. Please try again."
      );
    }
  };

  const handleRegionChange = async (next: CalRegion) => {
    await setRegion(next);
  };

  const onRegionTriggerLayout = (event: LayoutChangeEvent) => {
    setRegionTriggerWidth(event.nativeEvent.layout.width);
  };

  if (showSignup) {
    return <SignupScreen region={region} onBack={closeSignup} />;
  }

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {/* Logo centered in the middle */}
      <View className="flex-1 items-center justify-center">
        <CalComLogo width={180} height={40} color={isDark ? "#FFFFFF" : "#111827"} />
      </View>

      {/* Bottom section with region select + CTA */}
      <View className="px-6" style={{ paddingBottom: insets.bottom + 28 }}>
        {/* Region picker */}
        <View className="mb-5">
          <Text
            className="mb-3 text-[13px] font-medium"
            style={{ color: isDark ? "#A3A3A3" : "#6B7280" }}
          >
            Data region
          </Text>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <TouchableOpacity
                className="flex-row items-center justify-between rounded-xl border px-4 py-2.5"
                onLayout={onRegionTriggerLayout}
                style={{
                  borderColor: isDark ? "#4D4D4D" : "#E5E7EB",
                  backgroundColor: isDark ? "#171717" : "#FFFFFF",
                }}
                activeOpacity={0.8}
              >
                <Text
                  className="text-[15px] font-medium"
                  style={{ color: isDark ? "#FFFFFF" : "#111827" }}
                >
                  {getRegionLabel(region)}
                </Text>
                <Ionicons name="chevron-down" size={16} color={isDark ? "#A3A3A3" : "#6B7280"} />
              </TouchableOpacity>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              sideOffset={4}
              insets={{ top: insets.top + 8, bottom: insets.bottom + 120, left: 24, right: 24 }}
              className="min-w-0 self-stretch rounded-xl p-0"
              style={regionTriggerWidth > 0 ? { width: regionTriggerWidth } : undefined}
            >
              {REGION_OPTIONS.map((option, index) => {
                const selected = option.value === region;
                return (
                  <DropdownMenuItem
                    key={option.value}
                    className="gap-0 px-1 py-1 active:bg-transparent"
                    onPress={() => handleRegionChange(option.value)}
                  >
                    <View
                      className={`w-full flex-row items-center justify-between rounded-md px-2.5 py-1.5 ${
                        index < REGION_OPTIONS.length - 1 ? "mb-0.5" : ""
                      }`}
                      style={{
                        backgroundColor: selected
                          ? isDark
                            ? "#2C2C2E"
                            : "#F3F4F6"
                          : "transparent",
                      }}
                    >
                      <Text
                        className="flex-1 pr-1.5 text-[15px] leading-5"
                        style={{
                          color: selected
                            ? isDark
                              ? "#FFFFFF"
                              : "#111827"
                            : isDark
                              ? "#E5E7EB"
                              : "#374151",
                          fontWeight: selected ? "600" : "400",
                        }}
                      >
                        {option.label}
                      </Text>
                      <View className="w-4 items-end justify-center">
                        {selected ? (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={isDark ? "#FFFFFF" : "#111827"}
                          />
                        ) : null}
                      </View>
                    </View>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </View>

        {/* Primary CTA button */}
        <TouchableOpacity
          onPress={handleOAuthLogin}
          disabled={loading || regionPreloadPending}
          className="flex-row items-center justify-center rounded-2xl py-[18px]"
          style={[
            {
              backgroundColor:
                loading || regionPreloadPending ? "#9CA3AF" : isDark ? "#FFFFFF" : "#000000",
            },
            Platform.select({
              web: {
                boxShadow:
                  loading || regionPreloadPending ? "none" : "0 4px 12px rgba(0, 0, 0, 0.2)",
              },
              default: {
                shadowColor: isDark ? "#FFF" : "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: loading || regionPreloadPending ? 0 : 0.2,
                shadowRadius: 12,
                elevation: loading || regionPreloadPending ? 0 : 6,
              },
            }),
          ]}
          activeOpacity={0.9}
        >
          <Text
            className="text-[17px] font-semibold"
            style={{ color: isDark ? "#000000" : "#FFFFFF" }}
          >
            Continue with Cal.com
          </Text>
        </TouchableOpacity>

        {/* Secondary CTA: create an account */}
        <TouchableOpacity
          onPress={handleSignUp}
          disabled={loading || regionPreloadPending}
          accessibilityRole="button"
          className="mt-3 flex-row items-center justify-center rounded-2xl border py-[17px]"
          style={[
            {
              borderColor: isDark ? "#4D4D4D" : "#E5E7EB",
              backgroundColor: isDark ? "#171717" : "#FFFFFF",
            },
            Platform.OS === "web" ? { cursor: "pointer" } : undefined,
          ]}
          activeOpacity={0.8}
        >
          <Text
            className="text-[17px] font-semibold"
            style={{ color: isDark ? "#FFFFFF" : "#111827" }}
          >
            Create an account
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default LoginScreen;
