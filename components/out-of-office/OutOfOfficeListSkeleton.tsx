import { useColorScheme, View } from "react-native";
import { Skeleton } from "@/components/ui/skeleton";

export function OutOfOfficeListSkeleton() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const colors = {
    background: isDark ? "#171717" : "#FFFFFF",
    border: isDark ? "#4D4D4D" : "#E5E5EA",
  };

  const SkeletonItem = () => (
    <View
      style={{
        backgroundColor: colors.background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        marginBottom: 8,
      }}
    >
      <View className="flex-row items-start">
        <Skeleton className="mr-3 h-12 w-12 rounded-full" />

        <View className="flex-1">
          <Skeleton className="mb-2 h-5 w-3/4 rounded" />
          <Skeleton className="mb-2 h-4 w-1/2 rounded" />
          <Skeleton className="h-4 w-2/3 rounded" />
        </View>

        <View className="ml-2 flex-row gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </View>
      </View>
    </View>
  );

  return (
    <View className="px-2 pt-4">
      <SkeletonItem />
      <SkeletonItem />
      <SkeletonItem />
    </View>
  );
}
