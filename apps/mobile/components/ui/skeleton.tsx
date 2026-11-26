import { useColorScheme, View, type ViewInstance } from "react-native";
import { semanticColors } from "@/constants/colors";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  style,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<ViewInstance>) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const backgroundColor = isDark ? semanticColors.skeleton.dark : semanticColors.skeleton.light;

  return (
    <View className={cn("rounded-md", className)} style={[{ backgroundColor }, style]} {...props} />
  );
}

export { Skeleton };
