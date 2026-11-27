import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, useColorScheme } from "react-native";
import type { AppIconName } from "@/components/AppIcon";
import { GroupedRow, GroupedSection } from "@/components/GroupedList";
import { LandingPagePicker } from "@/components/LandingPagePicker";
import { LogoutConfirmModal } from "@/components/LogoutConfirmModal";
import { systemColor } from "@/constants/systemColors";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryContext } from "@/contexts/QueryContext";
import { useUserProfile } from "@/hooks";
import { type LandingPage, useUserPreferences } from "@/hooks/useUserPreferences";
import { showErrorAlert, showNotAvailableAlert, showSilentSuccessAlert } from "@/utils/alerts";
import { openInAppBrowser } from "@/utils/browser";
import { getAvatarUrl } from "@/utils/getAvatarUrl";
import { haptics } from "@/utils/haptics";
import { getCalAppUrl } from "@/utils/region";

interface MoreMenuItem {
  name: string;
  icon: AppIconName;
  onPress: () => void;
}

export default function More() {
  const router = useRouter();
  const { logout } = useAuth();
  const { clearCache } = useQueryContext();
  const { preferences, setLandingPage, landingPageLabel } = useUserPreferences();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showLandingPagePicker, setShowLandingPagePicker] = useState(false);
  const { data: userProfile } = useUserProfile();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const handleLandingPageSelect = async (value: LandingPage) => {
    try {
      await setLandingPage(value);
      showSilentSuccessAlert("Saved", "First page updated");
    } catch {
      showErrorAlert("Error", "Failed to save preference. Please try again.");
    }
  };

  const performLogout = async () => {
    try {
      // Clear in-memory cache before logout
      await clearCache();
      await logout();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Logout error", message);
      if (__DEV__) {
        const stack = error instanceof Error ? error.stack : undefined;
        console.debug("[More] logout failed", { message, stack });
      }
      showErrorAlert("Error", "Failed to sign out. Please try again.");
    }
  };

  const handleSignOut = () => {
    haptics.warning();
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: performLogout,
      },
    ]);
  };

  const menuItems: MoreMenuItem[] = [
    { name: "Apps", icon: "grid-outline", onPress: showNotAvailableAlert },
    { name: "Routing", icon: "git-branch-outline", onPress: showNotAvailableAlert },
    { name: "Workflows", icon: "flash-outline", onPress: showNotAvailableAlert },
    { name: "Insights", icon: "bar-chart-outline", onPress: showNotAvailableAlert },
    { name: "Support", icon: "help-circle-outline", onPress: showNotAvailableAlert },
  ];

  return (
    <>
      {/* iOS Native Header with Glass UI */}
      <Stack.Header
        style={{ backgroundColor: "transparent", shadowColor: "transparent" }}
        blurEffect={isLiquidGlassAvailable() ? undefined : isDark ? "dark" : "light"}
      />
      <Stack.Title large>More</Stack.Title>
      <Stack.Toolbar placement="right">
        {userProfile?.avatarUrl ? (
          <Stack.Toolbar.View>
            <Pressable
              onPress={() => router.push("/profile-sheet")}
              accessibilityRole="button"
              accessibilityLabel="Profile"
              hitSlop={6}
            >
              <Image
                source={{ uri: getAvatarUrl(userProfile.avatarUrl) }}
                style={{ width: 32, height: 32, borderRadius: 16 }}
              />
            </Pressable>
          </Stack.Toolbar.View>
        ) : (
          <Stack.Toolbar.Button
            onPress={() => router.push("/profile-sheet")}
            accessibilityLabel="Profile"
          >
            <Stack.Toolbar.Icon sf="person.circle.fill" />
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>

      {/* Content: an inset grouped list, like Settings */}
      <ScrollView
        style={{ backgroundColor: systemColor("systemGroupedBackground", isDark) }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <GroupedSection>
          {menuItems.map((item) => (
            <GroupedRow key={item.name} title={item.name} icon={item.icon} onPress={item.onPress} />
          ))}
        </GroupedSection>

        <GroupedSection header="App Settings" footer="The page the app opens on.">
          <GroupedRow
            title="First Page"
            icon="home-outline"
            value={landingPageLabel}
            onPress={() => setShowLandingPagePicker(true)}
          />
        </GroupedSection>

        <GroupedSection>
          <GroupedRow
            title="Delete Account"
            icon="trash-outline"
            destructive
            accessory="external"
            onPress={() =>
              openInAppBrowser(`${getCalAppUrl()}/settings/my-account/profile`, "Delete Account")
            }
          />
        </GroupedSection>

        <GroupedSection>
          <GroupedRow title="Sign Out" destructive centered onPress={handleSignOut} />
        </GroupedSection>

        {/* Footer Note */}
        <Text
          style={{
            color: systemColor("secondaryLabel", isDark),
            fontSize: 13,
            lineHeight: 18,
            textAlign: "center",
            marginTop: 24,
            paddingHorizontal: 16,
          }}
        >
          The companion app is an extension of the web application.{"\n"}
          For advanced features, visit{" "}
          <Text style={{ color: systemColor("label", isDark) }}>
            {getCalAppUrl().replace(/^https?:\/\//, "")}
          </Text>
        </Text>
      </ScrollView>

      {/* Logout Confirmation Modal - kept for consistency */}
      <LogoutConfirmModal
        visible={showLogoutModal}
        onConfirm={() => {
          setShowLogoutModal(false);
          performLogout();
        }}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* Landing Page Picker */}
      <LandingPagePicker
        visible={showLandingPagePicker}
        currentValue={preferences.landingPage}
        onSelect={handleLandingPageSelect}
        onClose={() => setShowLandingPagePicker(false)}
      />
    </>
  );
}
