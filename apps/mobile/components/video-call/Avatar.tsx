import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Who is here when there is no video: a Cal-hosted avatar if we have one, else initials. */
export function CallAvatar({
  name,
  url,
  size,
}: {
  name: string;
  url: string | null;
  size: number;
}) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (url) {
    return <Image source={{ uri: url }} style={round} contentFit="cover" transition={150} />;
  }
  return (
    <View style={[styles.initials, round]}>
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initials: { backgroundColor: "#3A3A3C", alignItems: "center", justifyContent: "center" },
  text: { color: "#FFFFFF", fontWeight: "600" },
});
