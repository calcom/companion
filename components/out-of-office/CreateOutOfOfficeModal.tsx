import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Modal,
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
import type { OutOfOfficeEntry, OutOfOfficeReason } from "@/services/types/ooo.types";
import { showErrorAlert, showSuccessAlert } from "@/utils/alerts";

interface CreateOutOfOfficeModalProps {
  visible: boolean;
  onClose: () => void;
  editingEntry: OutOfOfficeEntry | null;
  onSuccess: () => void;
}

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

export function CreateOutOfOfficeModal({
  visible,
  onClose,
  editingEntry,
  onSuccess,
}: CreateOutOfOfficeModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);

  const colors = {
    background: isDark ? "#171717" : "#FFFFFF",
    backgroundSecondary: isDark ? "#2C2C2E" : "#F3F4F6",
    border: isDark ? "#4D4D4D" : "#E5E5EA",
    text: isDark ? "#FFFFFF" : "#333333",
    textSecondary: isDark ? "#A3A3A3" : "#666666",
    inputBackground: isDark ? "#262626" : "#FFFFFF",
  };

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState<OutOfOfficeReason>("unspecified");
  const [notes, setNotes] = useState("");

  const { mutate: createEntry, isPending: creating } = useCreateOutOfOfficeEntry();
  const { mutate: updateEntry, isPending: updating } = useUpdateOutOfOfficeEntry();

  const isSubmitting = creating || updating;

  useEffect(() => {
    if (editingEntry) {
      setStartDate(editingEntry.start.split("T")[0]);
      setEndDate(editingEntry.end.split("T")[0]);
      setReason(editingEntry.reason || "unspecified");
      setNotes(editingEntry.notes || "");
    } else {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      setStartDate(today.toISOString().split("T")[0]);
      setEndDate(nextWeek.toISOString().split("T")[0]);
      setReason("unspecified");
      setNotes("");
    }
  }, [editingEntry]);

  const handleSubmit = () => {
    if (!startDate || !endDate) {
      showErrorAlert("Error", "Please select both start and end dates");
      return;
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (endDateObj < startDateObj) {
      showErrorAlert("Error", "End date must be after start date");
      return;
    }

    const payload = {
      start: startDate,
      end: endDate,
      reason,
      notes: notes.trim() || undefined,
    };

    if (editingEntry) {
      updateEntry(
        { id: editingEntry.id, ...payload },
        {
          onSuccess: () => {
            showSuccessAlert("Success", "Entry updated successfully");
            onSuccess();
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
          onSuccess();
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : "Failed to create entry";
          showErrorAlert("Error", message);
        },
      });
    }
  };

  const selectedReason = REASON_OPTIONS.find((r) => r.value === reason) || REASON_OPTIONS[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity onPress={onClose} disabled={isSubmitting}>
            <Text style={{ color: theme.accent, fontSize: 17 }}>Cancel</Text>
          </TouchableOpacity>

          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>
            {editingEntry ? "Edit Entry" : "New Entry"}
          </Text>

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
        </View>

        <ScrollView
          style={{ flex: 1 }}
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
                  }}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
                  End Date
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
                  }}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
                />
              </View>
            </View>
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
      </View>
    </Modal>
  );
}
