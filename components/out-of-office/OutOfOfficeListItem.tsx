import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { getColors } from "@/constants/colors";
import type { OutOfOfficeEntry } from "@/services/types/ooo.types";

interface OutOfOfficeListItemProps {
  entry: OutOfOfficeEntry;
  onEdit: () => void;
  onDelete: () => void;
  getReasonEmoji: (reason?: string) => string;
  getReasonLabel: (reason?: string) => string;
}

export function OutOfOfficeListItem({
  entry,
  onEdit,
  onDelete,
  getReasonEmoji,
  getReasonLabel,
}: OutOfOfficeListItemProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);

  const colors = {
    background: isDark ? "#171717" : "#FFFFFF",
    border: isDark ? "#4D4D4D" : "#E5E5EA",
    text: isDark ? "#FFFFFF" : "#333333",
    textSecondary: isDark ? "#A3A3A3" : "#666666",
    emojiBackground: isDark ? "#2C2C2E" : "#F3F4F6",
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const startDate = formatDate(entry.start);
  const endDate = formatDate(entry.end);

  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 flex-row">
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.emojiBackground,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Text style={{ fontSize: 24 }}>{getReasonEmoji(entry.reason)}</Text>
          </View>

          <View className="flex-1">
            <Text style={{ color: colors.text }} className="text-base font-semibold">
              {startDate} - {endDate}
            </Text>

            <Text style={{ color: colors.textSecondary }} className="mt-1 text-sm">
              {getReasonLabel(entry.reason)}
            </Text>

            {entry.toUser && (
              <Text style={{ color: colors.textSecondary }} className="mt-1 text-sm">
                Forwarding to{" "}
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {entry.toUser.name || entry.toUser.username}
                </Text>
              </Text>
            )}

            {entry.notes && (
              <Text
                style={{ color: colors.textSecondary }}
                className="mt-2 text-sm"
                numberOfLines={2}
              >
                {entry.notes}
              </Text>
            )}
          </View>
        </View>

        <View className="ml-2 flex-row gap-2">
          <TouchableOpacity
            onPress={onEdit}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDelete}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.destructive,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="trash-outline" size={18} color={theme.destructive} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
