import { useColorScheme, View } from "react-native";
import { Skeleton } from "@/components/ui/skeleton";
import { getColors } from "@/constants/colors";

export function CalEventListItemSkeleton() {
  const colorScheme = useColorScheme();
  const theme = getColors(colorScheme === "dark");

  return (
    <View
      style={{
        backgroundColor: theme.background,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 20,
        marginHorizontal: 16,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <Skeleton style={{ width: "100%", aspectRatio: 2, borderRadius: 0 }} />
      <View style={{ padding: 16 }}>
        <Skeleton style={{ height: 20, width: "80%", borderRadius: 4 }} />
        <Skeleton style={{ height: 16, width: 160, borderRadius: 4, marginTop: 10 }} />
        <Skeleton style={{ height: 16, width: 220, borderRadius: 4, marginTop: 8 }} />
        <Skeleton style={{ height: 16, width: 120, borderRadius: 4, marginTop: 8 }} />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <Skeleton style={{ height: 22, width: 80, borderRadius: 6 }} />
          <Skeleton style={{ height: 36, width: 36, borderRadius: 10 }} />
        </View>
      </View>
    </View>
  );
}

export function CalEventListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, index) => `cal-event-skeleton-${index}`).map((key) => (
        <CalEventListItemSkeleton key={key} />
      ))}
    </View>
  );
}
