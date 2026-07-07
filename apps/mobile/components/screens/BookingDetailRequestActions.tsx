import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Text, useColorScheme, View } from "react-native";
import { AppPressable } from "@/components/AppPressable";
import { getBookingRequestActionState } from "@/components/screens/BookingDetailRequestActions.state";
import type { Booking } from "@/services/calcom";

export {
  canRespondToBookingRequest,
  getBookingRequestActionState,
} from "@/components/screens/BookingDetailRequestActions.state";

type RequestActionColors = {
  cardBackground: string;
  text: string;
  textSecondary: string;
  border: string;
  destructive: string;
};

type BookingDetailRequestActionsProps = {
  booking: Booking;
  currentUserId?: number;
  currentUserEmail?: string;
  isConfirming: boolean;
  isDeclining: boolean;
  onConfirm: () => void;
  onReject: () => void;
  colors: RequestActionColors;
};

export function BookingDetailRequestActions({
  booking,
  currentUserId,
  currentUserEmail,
  isConfirming,
  isDeclining,
  onConfirm,
  onReject,
  colors,
}: BookingDetailRequestActionsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { canConfirm, canReject } = getBookingRequestActionState({
    booking,
    currentUserId,
    currentUserEmail,
  });

  if (!canReject) return null;

  const isProcessing = isConfirming || isDeclining;
  const primaryBackground = isDark ? "#FFFFFF" : "#111827";
  const primaryText = isDark ? "#000000" : "#FFFFFF";
  const iconBackground = isDark ? "#262626" : "#F2F2F7";
  const helperText = canConfirm
    ? "Confirm or reject this request."
    : "Payment is still pending. You can reject this request.";

  return (
    <View
      className="mb-4 overflow-hidden rounded-xl border"
      style={{ backgroundColor: colors.cardBackground, borderColor: colors.border }}
    >
      <View className="gap-4 p-4">
        <View className="flex-row gap-3">
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: iconBackground }}
          >
            <Ionicons name="time-outline" size={18} color={colors.text} />
          </View>
          <View className="flex-1">
            <Text className="text-[17px] font-semibold" style={{ color: colors.text }}>
              Booking request
            </Text>
            <Text className="mt-1 text-[14px] leading-5" style={{ color: colors.textSecondary }}>
              {helperText}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-2">
          <AppPressable
            className="h-11 flex-1 flex-row items-center justify-center rounded-lg border"
            style={{
              borderColor: colors.border,
              opacity: isProcessing ? 0.6 : 1,
            }}
            disabled={isProcessing}
            onPress={onReject}
          >
            {isDeclining ? (
              <ActivityIndicator size="small" color={colors.destructive} />
            ) : (
              <Ionicons name="close" size={17} color={colors.destructive} />
            )}
            <Text className="ml-1.5 text-[15px] font-semibold" style={{ color: colors.text }}>
              Reject
            </Text>
          </AppPressable>

          {canConfirm ? (
            <AppPressable
              className="h-11 flex-1 flex-row items-center justify-center rounded-lg"
              style={{
                backgroundColor: primaryBackground,
                opacity: isProcessing ? 0.6 : 1,
              }}
              disabled={isProcessing}
              onPress={onConfirm}
            >
              {isConfirming ? (
                <ActivityIndicator size="small" color={primaryText} />
              ) : (
                <Ionicons name="checkmark" size={17} color={primaryText} />
              )}
              <Text className="ml-1.5 text-[15px] font-semibold" style={{ color: primaryText }}>
                Confirm
              </Text>
            </AppPressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
