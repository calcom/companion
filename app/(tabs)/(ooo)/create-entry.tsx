import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { AppPressable } from "@/components/AppPressable";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getColors } from "@/constants/colors";
import { useCreateOutOfOfficeEntry, useUpdateOutOfOfficeEntry } from "@/hooks/useOutOfOffice";
import type { OutOfOfficeReason } from "@/services/types/ooo.types";
import { showErrorAlert, showSuccessAlert } from "@/utils/alerts";

interface ReasonOption {
  value: OutOfOfficeReason;
  label: string;
  emoji: string;
}

const REASON_OPTIONS: ReasonOption[] = [
  { value: "unspecified", label: "Out of Office", emoji: "\u{1F3DD}\u{FE0F}" },
  { value: "vacation", label: "Vacation", emoji: "\u{1F3DD}\u{FE0F}" },
  { value: "travel", label: "Travel", emoji: "\u{2708}\u{FE0F}" },
  { value: "sick", label: "Sick Leave", emoji: "\u{1F912}" },
  { value: "public_holiday", label: "Public Holiday", emoji: "\u{1F389}" },
];

export default function CreateOOOEntry() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    start?: string;
    end?: string;
    reason?: string;
    notes?: string;
  }>();

  const isEditing = Boolean(params.id);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);

  const colors = {
    background: isDark ? "#000000" : "#FFFFFF",
    backgroundSecondary: isDark ? "#171717" : "#F3F4F6",
    border: isDark ? "#4D4D4D" : "#E5E5EA",
    text: isDark ? "#FFFFFF" : "#333333",
    textSecondary: isDark ? "#A3A3A3" : "#666666",
    inputBackground: isDark ? "#262626" : "#FFFFFF",
  };

  const [startDate, setStartDate] = useState<Date>(() => {
    if (params.start) {
      return new Date(params.start);
    }
    return new Date();
  });

  const [endDate, setEndDate] = useState<Date>(() => {
    if (params.end) {
      return new Date(params.end);
    }
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  });

  const [reason, setReason] = useState<OutOfOfficeReason>(
    (params.reason as OutOfOfficeReason) || "unspecified"
  );
  const [notes, setNotes] = useState(params.notes || "");

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const { mutate: createEntry, isPending: creating } = useCreateOutOfOfficeEntry();
  const { mutate: updateEntry, isPending: updating } = useUpdateOutOfOfficeEntry();

  const isSubmitting = creating || updating;

  useEffect(() => {
    if (params.start) {
      setStartDate(new Date(params.start));
    }
    if (params.end) {
      setEndDate(new Date(params.end));
    }
    if (params.reason) {
      setReason(params.reason as OutOfOfficeReason);
    }
    if (params.notes) {
      setNotes(params.notes);
    }
  }, [params.start, params.end, params.reason, params.notes]);

  const handleSubmit = () => {
    if (endDate < startDate) {
      showErrorAlert("Error", "End date must be after start date");
      return;
    }

    const payload = {
      start: startDate.toISOString().split("T")[0],
      end: endDate.toISOString().split("T")[0],
      reason,
      notes: notes.trim() || undefined,
    };

    if (isEditing && params.id) {
      updateEntry(
        { id: parseInt(params.id, 10), ...payload },
        {
          onSuccess: () => {
            showSuccessAlert("Success", "Entry updated successfully");
            router.back();
          },
          onError: (error) => {
            const message = error instanceof Error ? error.message : "Failed to update entry";
            showErrorAlert("Error", message);
          },
        }
      );
    } else {
      createEntry(payload, {
        onSuccess: () => {
          showSuccessAlert("Success", "Entry created successfully");
          router.back();
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : "Failed to create entry";
          showErrorAlert("Error", message);
        },
      });
    }
  };

  const selectedReason = REASON_OPTIONS.find((r) => r.value === reason) || REASON_OPTIONS[0];

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleStartDateChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowStartPicker(false);
    }
    if (selectedDate) {
      setStartDate(selectedDate);
      if (selectedDate > endDate) {
        const newEndDate = new Date(selectedDate);
        newEndDate.setDate(newEndDate.getDate() + 7);
        setEndDate(newEndDate);
      }
    }
  };

  const handleEndDateChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowEndPicker(false);
    }
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditing ? "Edit Entry" : "New Entry",
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} disabled={isSubmitting}>
              <Text style={{ color: theme.accent, fontSize: 17 }}>Cancel</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting}>
              <Text
                style={{
                  color: isSubmitting ? colors.textSecondary : theme.accent,
                  fontSize: 17,
                  fontWeight: "600",
                }}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", marginBottom: 12 }}>
            Dates
          </Text>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                Start Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowStartPicker(true)}
                style={{
                  backgroundColor: colors.inputBackground,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 14 }}>{formatDate(startDate)}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                End Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowEndPicker(true)}
                style={{
                  backgroundColor: colors.inputBackground,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 14 }}>{formatDate(endDate)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {(showStartPicker || Platform.OS === "ios") && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                Select Start Date
              </Text>
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={handleStartDateChange}
                minimumDate={new Date()}
                themeVariant={isDark ? "dark" : "light"}
              />
            </View>
          )}

          {(showEndPicker || Platform.OS === "ios") && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                Select End Date
              </Text>
              <DateTimePicker
                value={endDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={handleEndDateChange}
                minimumDate={startDate}
                themeVariant={isDark ? "dark" : "light"}
              />
            </View>
          )}
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", marginBottom: 12 }}>
            Reason
          </Text>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <AppPressable
                style={{
                  backgroundColor: colors.inputBackground,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontSize: 20, marginRight: 8 }}>{selectedReason.emoji}</Text>
                  <Text style={{ color: colors.text, fontSize: 16 }}>{selectedReason.label}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </AppPressable>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              insets={{ top: 60, bottom: 20, left: 12, right: 12 }}
              sideOffset={8}
              className="w-64"
              align="start"
            >
              {REASON_OPTIONS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={reason === option.value}
                  onCheckedChange={() => setReason(option.value)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 18, marginRight: 8 }}>{option.emoji}</Text>
                    <Text style={{ color: colors.text, fontSize: 16 }}>{option.label}</Text>
                  </View>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", marginBottom: 12 }}>
            Notes (optional)
          </Text>

          <TextInput
            style={{
              backgroundColor: colors.inputBackground,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 12,
              fontSize: 16,
              color: colors.text,
              minHeight: 100,
              textAlignVertical: "top",
            }}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any additional notes..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
          />
        </View>

        <View
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 8,
            padding: 16,
            marginTop: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.textSecondary}
              style={{ marginRight: 8, marginTop: 2 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                Note: Full out of office functionality requires API v2 user-level endpoints which
                are not yet available. This feature is currently in preview mode.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
