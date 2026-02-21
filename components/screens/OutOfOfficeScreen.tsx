import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { AppPressable } from "@/components/AppPressable";
import { EmptyScreen } from "@/components/EmptyScreen";
import { OutOfOfficeListItem } from "@/components/out-of-office/OutOfOfficeListItem";
import { OutOfOfficeListSkeleton } from "@/components/out-of-office/OutOfOfficeListSkeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Text as AlertDialogText } from "@/components/ui/text";
import { getColors } from "@/constants/colors";
import { useDeleteOutOfOfficeEntry, useOutOfOfficeEntries } from "@/hooks/useOutOfOffice";
import type { OutOfOfficeEntry } from "@/services/types/ooo.types";
import { showErrorAlert, showSuccessAlert } from "@/utils/alerts";
import { offlineAwareRefresh } from "@/utils/network";

export interface OutOfOfficeScreenProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function OutOfOfficeScreen({ searchQuery = "" }: OutOfOfficeScreenProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<OutOfOfficeEntry | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);

  const colors = {
    background: isDark ? "#000000" : "#FFFFFF",
    backgroundSecondary: isDark ? "#171717" : "#f8f9fa",
    border: isDark ? "#4D4D4D" : "#E5E5EA",
    text: isDark ? "#FFFFFF" : "#333333",
    textSecondary: isDark ? "#A3A3A3" : "#666666",
  };

  const {
    data: entries = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useOutOfOfficeEntries();
  const { mutate: deleteEntryMutation, isPending: deleting } = useDeleteOutOfOfficeEntry();

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
    if (Platform.OS === "web") {
      setSelectedEntry(entry);
      setShowDeleteModal(true);
    } else {
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
    }
  };

  const confirmDelete = () => {
    if (!selectedEntry) return;

    deleteEntryMutation(selectedEntry.id, {
      onSuccess: () => {
        setShowDeleteModal(false);
        setSelectedEntry(null);
        showSuccessAlert("Success", "Entry deleted successfully");
      },
      onError: () => {
        showErrorAlert("Error", "Failed to delete entry. Please try again.");
      },
    });
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
      <View style={{ flex: 1, backgroundColor: colors.backgroundSecondary }}>
        <View className="flex-1 px-2 pt-4 md:px-4">
          <OutOfOfficeListSkeleton />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.backgroundSecondary }}>
        <View className="flex-1 items-center justify-center p-5">
          <Ionicons name="alert-circle" size={64} color={theme.destructive} />
          <Text style={{ color: colors.text }} className="mb-2 mt-4 text-center text-xl font-bold">
            Unable to load entries
          </Text>
          <Text style={{ color: colors.textSecondary }} className="mb-6 text-center text-base">
            {error}
          </Text>
          <AppPressable
            className="rounded-lg bg-black px-6 py-3 dark:bg-white"
            onPress={() => refetch()}
          >
            <Text className="text-base font-semibold text-white dark:text-black">Retry</Text>
          </AppPressable>
        </View>
      </View>
    );
  }

  const showEmptyState = entries.length === 0 && !loading;
  const showSearchEmptyState =
    filteredEntries.length === 0 && searchQuery.trim() !== "" && !showEmptyState;
  const showList = !showEmptyState && !showSearchEmptyState;

  return (
    <>
      <View
        style={{
          backgroundColor: isDark ? "#000000" : "#f3f4f6",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
        className="flex-row items-center justify-between px-4 py-3"
      >
        <Text style={{ color: colors.text }} className="text-lg font-semibold">
          Out of Office
        </Text>
        <TouchableOpacity
          className="flex-row items-center justify-center gap-1 rounded-lg bg-black px-3 py-2 dark:bg-white"
          onPress={handleCreateNew}
        >
          <Ionicons name="add" size={18} color={isDark ? "#000" : "#fff"} />
          <Text className="text-base font-semibold text-white dark:text-black">New</Text>
        </TouchableOpacity>
      </View>

      {showEmptyState && (
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
            paddingBottom: 90,
          }}
          refreshControl={<RefreshControl refreshing={isManualRefreshing} onRefresh={onRefresh} />}
          contentInsetAdjustmentBehavior="automatic"
        >
          <EmptyScreen
            icon="airplane-outline"
            headline="No out of office entries"
            description="Let your bookers know when you're unavailable. Create an out of office entry to block time on your calendar."
            buttonText="Create Entry"
            onButtonPress={handleCreateNew}
          />
        </ScrollView>
      )}

      {showSearchEmptyState && (
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
            paddingBottom: 90,
          }}
          refreshControl={<RefreshControl refreshing={isManualRefreshing} onRefresh={onRefresh} />}
        >
          <EmptyScreen
            icon="search-outline"
            headline={`No results found for "${searchQuery}"`}
            description="Try searching with different keywords"
          />
        </ScrollView>
      )}

      {showList && (
        <FlatList
          style={{
            flex: 1,
            backgroundColor: colors.background,
          }}
          contentContainerStyle={{
            paddingBottom: 90,
            paddingHorizontal: 8,
            paddingVertical: 8,
          }}
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

      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <AlertDialogText className="text-lg font-semibold">Delete Entry</AlertDialogText>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <AlertDialogText className="text-sm text-muted-foreground">
                Are you sure you want to delete this out of office entry?
              </AlertDialogText>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onPress={() => {
                setShowDeleteModal(false);
                setSelectedEntry(null);
              }}
              disabled={deleting}
            >
              <AlertDialogText>Cancel</AlertDialogText>
            </AlertDialogCancel>
            <AlertDialogAction onPress={confirmDelete} disabled={deleting}>
              <AlertDialogText className="text-white">Delete</AlertDialogText>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
