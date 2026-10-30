import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppPressable } from "@/components/AppPressable";
import { FullScreenModal } from "@/components/FullScreenModal";
import { type Schedule, useUpdateSchedule } from "@/hooks/useSchedules";
import { showErrorAlert, showSilentSuccessAlert } from "@/utils/alerts";
import { shadows } from "@/utils/shadows";
import {
  filterTimezones,
  getDeviceTimezone,
  getTimezoneLabel,
  resolveTimezoneId,
} from "@/utils/timezones";

export interface EditAvailabilityNameScreenProps {
  schedule: Schedule | null;
  onSuccess: () => void;
  onSavingChange?: (isSaving: boolean) => void;
  transparentBackground?: boolean;
}

export interface EditAvailabilityNameScreenHandle {
  submit: () => void;
}

export const EditAvailabilityNameScreen = forwardRef<
  EditAvailabilityNameScreenHandle,
  EditAvailabilityNameScreenProps
>(function EditAvailabilityNameScreen({ schedule, onSuccess, onSavingChange }, ref) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState("");

  const deviceTimezone = useMemo(() => getDeviceTimezone(), []);

  // Use the mutation hook for updating schedules with optimistic updates
  const { mutate: updateSchedule, isPending: isSaving } = useUpdateSchedule();

  // Initialize from schedule
  useEffect(() => {
    if (schedule) {
      setName(schedule.name ?? "");
      setTimezone(schedule.timeZone ?? "UTC");
    }
  }, [schedule]);

  // Notify parent of saving state
  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);

  const closeTimezoneModal = useCallback(() => {
    setShowTimezoneModal(false);
    setTimezoneSearch("");
  }, []);

  const handleSubmit = useCallback(() => {
    if (!schedule || isSaving) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Error", "Please enter a schedule name");
      return;
    }

    updateSchedule(
      {
        id: schedule.id,
        updates: {
          name: trimmedName,
          timeZone: timezone,
        },
      },
      {
        onSuccess: () => {
          showSilentSuccessAlert("Success", "Schedule updated successfully");
          onSuccess();
        },
        onError: () => {
          showErrorAlert("Error", "Failed to update schedule. Please try again.");
        },
      }
    );
  }, [schedule, name, timezone, onSuccess, isSaving, updateSchedule]);

  // Expose submit to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      submit: handleSubmit,
    }),
    [handleSubmit]
  );

  const selectedTimezoneId = resolveTimezoneId(timezone) ?? timezone;
  const selectedTimezoneLabel = getTimezoneLabel(timezone);
  const filteredTimezones = useMemo(
    () => filterTimezones(timezoneSearch, timezone, deviceTimezone),
    [timezoneSearch, timezone, deviceTimezone]
  );

  // Render timezone list content
  const renderTimezoneContent = () => (
    <>
      <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-[#4D4D4D]">
        <Text className="text-[17px] font-semibold text-black dark:text-white">
          Select Timezone
        </Text>
        <AppPressable
          onPress={closeTimezoneModal}
          accessibilityLabel="Close timezone picker"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={24} color={isDark ? "#FFFFFF" : "#A3A3A3"} />
        </AppPressable>
      </View>
      <View className="border-b border-gray-200 px-4 py-3 dark:border-[#4D4D4D]">
        <View style={{ position: "relative", justifyContent: "center" }}>
          <TextInput
            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-[16px] text-black dark:border-[#4D4D4D] dark:bg-[#262626] dark:text-white"
            style={{ paddingRight: timezoneSearch.length > 0 ? 32 : 12 }}
            placeholder="Search city or timezone"
            placeholderTextColor={isDark ? "#A3A3A3" : "#9CA3AF"}
            value={timezoneSearch}
            onChangeText={setTimezoneSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {timezoneSearch.length > 0 && (
            <TouchableOpacity
              onPress={() => setTimezoneSearch("")}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              style={{ position: "absolute", right: 8 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={isDark ? "#A3A3A3" : "#9CA3AF"} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <FlatList
        data={filteredTimezones}
        keyExtractor={(tz) => tz.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={15}
        maxToRenderPerBatch={20}
        windowSize={7}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        renderItem={({ item: tz }) => (
          <AppPressable
            onPress={() => {
              setTimezone(tz.id);
              closeTimezoneModal();
            }}
          >
            <View
              className={`mb-2.5 rounded-xl border-2 px-4 py-4 ${
                tz.id === selectedTimezoneId
                  ? "border-[#007AFF] bg-blue-50 shadow-md dark:bg-[#0A84FF]/20"
                  : "border-gray-200 bg-gray-50 dark:border-[#4D4D4D] dark:bg-[#171717]"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text
                    className={`text-[17px] ${
                      tz.id === selectedTimezoneId
                        ? "font-semibold text-[#007AFF]"
                        : "font-medium text-gray-900 dark:text-white"
                    }`}
                  >
                    {tz.label}
                  </Text>
                  <Text className="mt-0.5 text-[13px] text-gray-500 dark:text-[#A3A3A3]">
                    {tz.id}
                  </Text>
                </View>
                {tz.id === selectedTimezoneId && (
                  <View className="rounded-full bg-[#007AFF] p-1.5">
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                )}
              </View>
            </View>
          </AppPressable>
        )}
        ListEmptyComponent={
          <View className="items-center py-8">
            <Text className="text-[15px] text-gray-500 dark:text-[#A3A3A3]">
              No matching timezones
            </Text>
          </View>
        }
      />
    </>
  );

  if (!schedule) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <Text className="text-gray-500 dark:text-[#A3A3A3]">No schedule data</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-white dark:bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-2 text-[13px] font-medium uppercase tracking-wide text-gray-500 dark:text-[#A3A3A3]">
          Schedule Name
        </Text>
        <TextInput
          className="mb-4 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-[17px] text-black dark:border-[#4D4D4D] dark:bg-[#171717] dark:text-white"
          placeholder="Enter schedule name"
          placeholderTextColor={isDark ? "#A3A3A3" : "#9CA3AF"}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          editable={!isSaving}
        />

        <Text className="mb-2 text-[13px] font-medium uppercase tracking-wide text-gray-500 dark:text-[#A3A3A3]">
          Timezone
        </Text>
        <AppPressable onPress={() => setShowTimezoneModal(true)}>
          <View className="flex-row items-center justify-between rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-4 dark:border-[#4D4D4D] dark:bg-[#171717]">
            <View className="flex-row items-center">
              <Ionicons
                name="globe-outline"
                size={20}
                color="#007AFF"
                style={{ marginRight: 12 }}
              />
              <View>
                <Text className="text-[17px] text-black dark:text-white">
                  {selectedTimezoneLabel}
                </Text>
                <Text className="mt-0.5 text-[13px] text-gray-500 dark:text-[#A3A3A3]">
                  {timezone}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={20} color={isDark ? "#A3A3A3" : "#C7C7CC"} />
          </View>
        </AppPressable>
      </ScrollView>

      <FullScreenModal
        visible={showTimezoneModal}
        animationType={Platform.OS === "web" ? "fade" : "slide"}
        onRequestClose={closeTimezoneModal}
      >
        {Platform.OS === "web" ? (
          <TouchableOpacity
            className="flex-1 items-center justify-center bg-black/50 p-4"
            activeOpacity={1}
            onPress={closeTimezoneModal}
          >
            <TouchableOpacity
              className="max-h-[80%] w-full max-w-[500px] overflow-hidden rounded-2xl bg-white p-2 dark:bg-[#171717]"
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={shadows.xl()}
            >
              {renderTimezoneContent()}
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          <View className="flex-1 bg-white p-2 dark:bg-[#171717]">{renderTimezoneContent()}</View>
        )}
      </FullScreenModal>
    </KeyboardAvoidingView>
  );
});

export default EditAvailabilityNameScreen;
