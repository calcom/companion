import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppPressable } from "@/components/AppPressable";
import { getColors } from "@/constants/colors";
import { type Schedule, useUpdateSchedule } from "@/hooks/useSchedules";
import { showErrorAlert, showSilentSuccessAlert } from "@/utils/alerts";
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
>(function EditAvailabilityNameScreen(
  { schedule, onSuccess, onSavingChange, transparentBackground = false },
  ref
) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);
  const backgroundColor = transparentBackground
    ? "transparent"
    : isDark
      ? theme.background
      : theme.backgroundMuted;

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

  const handleTimezoneSelect = useCallback(
    (tz: string) => {
      setTimezone(tz);
      closeTimezoneModal();
    },
    [closeTimezoneModal]
  );

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

  if (!schedule) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor }}>
        <Text className="text-[#A3A3A3]">No schedule data</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1" style={{ backgroundColor }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={!transparentBackground}
      >
        {transparentBackground ? (
          <>
            {/* Name Input - Glass UI */}
            <Text className="mb-2 px-1 text-[13px] font-medium text-[#A3A3A3]">Schedule Name</Text>
            <View
              className={`mb-4 overflow-hidden rounded-xl ${
                isDark
                  ? "border border-[#4D4D4D]/40 bg-[#171717]/80"
                  : "border border-gray-300/40 bg-white/60"
              }`}
            >
              <TextInput
                className={`px-4 py-3.5 text-[17px] ${isDark ? "text-white" : "text-black"}`}
                placeholder="Enter schedule name"
                placeholderTextColor={isDark ? "#A3A3A3" : "#9CA3AF"}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!isSaving}
              />
            </View>

            {/* Timezone Selector - Glass UI */}
            <Text className="mb-2 px-1 text-[13px] font-medium text-[#A3A3A3]">Timezone</Text>
            <AppPressable onPress={() => setShowTimezoneModal(true)} disabled={isSaving}>
              <View
                className={`mb-4 flex-row items-center rounded-xl px-4 py-3 ${
                  isDark
                    ? "border border-[#4D4D4D]/40 bg-[#171717]/80"
                    : "border border-gray-300/40 bg-white/60"
                }`}
              >
                <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-[#007AFF]/20">
                  <Ionicons name="globe-outline" size={20} color="#007AFF" />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-[17px] font-medium ${isDark ? "text-white" : "text-black"}`}
                  >
                    {selectedTimezoneLabel}
                  </Text>
                  <Text className="mt-0.5 text-[13px] text-[#A3A3A3]">{timezone}</Text>
                </View>
                <Ionicons name="chevron-expand" size={18} color="#A3A3A3" />
              </View>
            </AppPressable>
          </>
        ) : (
          <>
            <Text className="mb-2 px-1 text-[13px] font-medium uppercase tracking-wide text-[#A3A3A3]">
              Schedule Name
            </Text>
            <View
              className={`mb-4 overflow-hidden rounded-xl ${isDark ? "bg-[#171717]" : "bg-white"}`}
            >
              <TextInput
                className={`px-4 py-3.5 text-[17px] ${isDark ? "text-white" : "text-black"}`}
                placeholder="Enter schedule name"
                placeholderTextColor={isDark ? "#A3A3A3" : "#9CA3AF"}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!isSaving}
              />
            </View>

            <Text className="mb-2 px-1 text-[13px] font-medium uppercase tracking-wide text-[#A3A3A3]">
              Timezone
            </Text>
            <AppPressable onPress={() => setShowTimezoneModal(true)} disabled={isSaving}>
              <View
                className={`mb-4 flex-row items-center rounded-xl px-4 py-3 ${isDark ? "bg-[#171717]" : "bg-white"}`}
              >
                <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-[#007AFF]/10">
                  <Ionicons name="globe-outline" size={20} color="#007AFF" />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-[17px] font-medium ${isDark ? "text-white" : "text-black"}`}
                  >
                    {selectedTimezoneLabel}
                  </Text>
                  <Text className="mt-0.5 text-[13px] text-[#A3A3A3]">{timezone}</Text>
                </View>
                <Ionicons name="chevron-expand" size={18} color="#A3A3A3" />
              </View>
            </AppPressable>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showTimezoneModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={closeTimezoneModal}
      >
        <View className="flex-1" style={{ backgroundColor: theme.backgroundSecondary }}>
          <View
            className="flex-row items-center justify-between border-b px-4 py-4"
            style={{ borderBottomColor: theme.borderSubtle }}
          >
            <Text className="text-[17px] font-semibold" style={{ color: theme.text }}>
              Select Timezone
            </Text>
            <TouchableOpacity
              onPress={closeTimezoneModal}
              accessibilityLabel="Close timezone picker"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <View className="border-b px-4 py-3" style={{ borderBottomColor: theme.borderSubtle }}>
            <TextInput
              className="rounded-lg px-3 py-2.5 text-[17px]"
              style={{
                backgroundColor: isDark ? "#262626" : "#F2F2F7",
                color: theme.text,
              }}
              placeholder="Search city or timezone"
              placeholderTextColor={theme.textMuted}
              value={timezoneSearch}
              onChangeText={setTimezoneSearch}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={filteredTimezones}
            keyExtractor={(tz) => tz.id}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            initialNumToRender={15}
            maxToRenderPerBatch={20}
            windowSize={7}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            renderItem={({ item: tz }) => {
              const isSelected = tz.id === selectedTimezoneId;
              return (
                <TouchableOpacity
                  className="flex-row items-center justify-between border-b px-4 py-3.5"
                  style={{ borderBottomColor: theme.borderSubtle }}
                  onPress={() => handleTimezoneSelect(tz.id)}
                >
                  <View className="mr-3 flex-1">
                    <Text
                      className={`text-[17px] ${isSelected ? "font-semibold" : "font-normal"}`}
                      style={{ color: isSelected ? theme.accent : theme.text }}
                    >
                      {tz.label}
                    </Text>
                    <Text className="mt-0.5 text-[13px]" style={{ color: theme.textMuted }}>
                      {tz.id}
                    </Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark" size={20} color={theme.accent} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View className="items-center py-10">
                <Text className="text-[15px]" style={{ color: theme.textMuted }}>
                  No matching timezones
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
});

export default EditAvailabilityNameScreen;
