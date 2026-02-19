import { Ionicons } from "@expo/vector-icons";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { EmptyScreen } from "@/components/EmptyScreen";
import { OutOfOfficeListItem } from "@/components/out-of-office/OutOfOfficeListItem";
import { OutOfOfficeListSkeleton } from "@/components/out-of-office/OutOfOfficeListSkeleton";
import { getColors } from "@/constants/colors";
import { useUserProfile } from "@/hooks";
import { useDeleteOutOfOfficeEntry, useOutOfOfficeEntries } from "@/hooks/useOutOfOffice";
import type { OutOfOfficeEntry } from "@/services/types/ooo.types";
import { showErrorAlert, showSuccessAlert } from "@/utils/alerts";
import { getAvatarUrl } from "@/utils/getAvatarUrl";
import { offlineAwareRefresh } from "@/utils/network";

export default function OutOfOfficeIOS() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const { data: userProfile } = useUserProfile();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);

  const {
    data: entries = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useOutOfOfficeEntries();
  const { mutate: deleteEntryMutation } = useDeleteOutOfOfficeEntry();

  const isAuthError =
    queryError?.message?.includes("Authentication") ||
    queryError?.message?.includes("sign in") ||
    queryError?.message?.includes("401");
  const error =
    queryError && !isAuthError && __DEV__ ? "Failed to load out of office entries." : null;

  const filteredEntries = entries.filter((entry) => {
    if (!searchQuery.trim()) return true;
    const searchLower = searchQuery.toLowerCase();
    const reasonText = entry.reason?.toLowerCase() || "";
    const notesText = entry.notes?.toLowerCase() || "";
    return reasonText.includes(searchLower) || notesText.includes(searchLower);
  });

  const onRefresh = async () => {
    setIsManualRefreshing(true);
    await offlineAwareRefresh(refetch).finally(() => {
      setIsManualRefreshing(false);
    });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleCreateNew = () => {
    router.push("/(tabs)/(ooo)/create-entry");
  };

  const handleEdit = (entry: OutOfOfficeEntry) => {
    router.push({
      pathname: "/(tabs)/(ooo)/create-entry",
      params: {
        id: entry.id.toString(),
        start: entry.start,
        end: entry.end,
        reason: entry.reason || "unspecified",
        notes: entry.notes || "",
      },
    });
  };

  const handleDelete = (entry: OutOfOfficeEntry) => {
    Alert.alert("Delete Entry", "Are you sure you want to delete this out of office entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteEntryMutation(entry.id, {
            onSuccess: () => {
              showSuccessAlert("Success", "Entry deleted successfully");
            },
            onError: () => {
              showErrorAlert("Error", "Failed to delete entry. Please try again.");
            },
          });
        },
      },
    ]);
  };

  const getReasonEmoji = (reason?: string): string => {
    switch (reason) {
      case "vacation":
        return "\u{1F3DD}\u{FE0F}";
      case "travel":
        return "\u{2708}\u{FE0F}";
      case "sick":
        return "\u{1F912}";
      case "public_holiday":
        return "\u{1F389}";
      default:
        return "\u{1F3DD}\u{FE0F}";
    }
  };

  const getReasonLabel = (reason?: string): string => {
    switch (reason) {
      case "vacation":
        return "Vacation";
      case "travel":
        return "Travel";
      case "sick":
        return "Sick Leave";
      case "public_holiday":
        return "Public Holiday";
      default:
        return "Out of Office";
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Header
          style={{ backgroundColor: "transparent", shadowColor: "transparent" }}
          blurEffect={isLiquidGlassAvailable() ? undefined : isDark ? "dark" : "light"}
        >
          <Stack.Header.Title large>Out of Office</Stack.Header.Title>
        </Stack.Header>
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          <OutOfOfficeListSkeleton />
        </ScrollView>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Header
          style={{ backgroundColor: "transparent", shadowColor: "transparent" }}
          blurEffect={isLiquidGlassAvailable() ? undefined : isDark ? "dark" : "light"}
        >
          <Stack.Header.Title large>Out of Office</Stack.Header.Title>
        </Stack.Header>
        <View
          className="flex-1 items-center justify-center bg-gray-50 p-5"
          style={{ backgroundColor: theme.backgroundSecondary }}
        >
          <Ionicons name="alert-circle" size={64} color={theme.destructive} />
          <Text className="mb-2 mt-4 text-center text-xl font-bold" style={{ color: theme.text }}>
            Unable to load entries
          </Text>
          <Text className="mb-6 text-center text-base" style={{ color: theme.textMuted }}>
            {error}
          </Text>
          <TouchableOpacity
            className="rounded-lg bg-black px-6 py-3"
            style={{ backgroundColor: isDark ? "white" : "black" }}
            onPress={() => refetch()}
          >
            <Text
              className="text-base font-semibold text-white"
              style={{ color: isDark ? "black" : "white" }}
            >
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  if (entries.length === 0) {
    return (
      <>
        <Stack.Header
          style={{ backgroundColor: "transparent", shadowColor: "transparent" }}
          blurEffect={isLiquidGlassAvailable() ? undefined : isDark ? "dark" : "light"}
        >
          <Stack.Header.Title large>Out of Office</Stack.Header.Title>
          <Stack.Header.Right>
            {userProfile?.avatarUrl ? (
              <Stack.Header.View>
                <Pressable onPress={() => router.push("/profile-sheet")}>
                  <Image
                    source={{ uri: getAvatarUrl(userProfile.avatarUrl) }}
                    style={{ width: 32, height: 32, borderRadius: 16 }}
                  />
                </Pressable>
              </Stack.Header.View>
            ) : (
              <Stack.Header.Button onPress={() => router.push("/profile-sheet")}>
                <Stack.Header.Icon sf="person.circle.fill" />
              </Stack.Header.Button>
            )}
          </Stack.Header.Right>
        </Stack.Header>
        <View
          className="flex-1 items-center justify-center bg-gray-50 p-5"
          style={{ backgroundColor: theme.backgroundSecondary }}
        >
          <EmptyScreen
            icon="airplane-outline"
            headline="No out of office entries"
            description="Let your bookers know when you're unavailable. Create an out of office entry to block time on your calendar."
            buttonText="New"
            onButtonPress={handleCreateNew}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Header
        style={{ backgroundColor: "transparent", shadowColor: "transparent" }}
        blurEffect={isLiquidGlassAvailable() ? undefined : isDark ? "dark" : "light"}
      >
        <Stack.Header.Title large>Out of Office</Stack.Header.Title>
        <Stack.Header.Right>
          <Stack.Header.Button onPress={handleCreateNew} tintColor="#000" variant="prominent">
            New
          </Stack.Header.Button>
          {userProfile?.avatarUrl ? (
            <Stack.Header.View>
              <Pressable onPress={() => router.push("/profile-sheet")}>
                <Image
                  source={{ uri: getAvatarUrl(userProfile.avatarUrl) }}
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                />
              </Pressable>
            </Stack.Header.View>
          ) : (
            <Stack.Header.Button onPress={() => router.push("/profile-sheet")}>
              <Stack.Header.Icon sf="person.circle.fill" />
            </Stack.Header.Button>
          )}
        </Stack.Header.Right>
        <Stack.Header.SearchBar
          placeholder="Search entries"
          onChangeText={(e) => handleSearch(e.nativeEvent.text)}
          obscureBackground={false}
          barTintColor={isDark ? "#171717" : "#fff"}
        />
      </Stack.Header>

      {filteredEntries.length === 0 && searchQuery.trim() !== "" ? (
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={isManualRefreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View
            className="flex-1 items-center justify-center bg-gray-50 p-5 pt-20"
            style={{ backgroundColor: theme.backgroundSecondary }}
          >
            <EmptyScreen
              icon="search-outline"
              headline={`No results found for "${searchQuery}"`}
              description="Try searching with different keywords"
            />
          </View>
        </ScrollView>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: theme.background }}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 8, paddingTop: 8 }}
          data={filteredEntries}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <OutOfOfficeListItem
              entry={item}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
              getReasonEmoji={getReasonEmoji}
              getReasonLabel={getReasonLabel}
            />
          )}
          refreshControl={<RefreshControl refreshing={isManualRefreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </>
  );
}
