import { isValidElement, type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { AppIcon, type AppIconName } from "@/components/AppIcon";
import { systemColor } from "@/constants/systemColors";

/**
 * An inset grouped list in the style of iOS Settings: rounded sections on the grouped
 * background, 17pt rows at least 44pt tall, hairline separators inset to the text, footnote
 * headers and footers, and the system's gray highlight while a row is pressed.
 */
export function GroupedSection({
  header,
  footer,
  children,
}: {
  header?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const isDark = useColorScheme() === "dark";
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];
  // Separators start under the title, like Settings: past the icon when rows have one.
  const hasIcons = rows.some(
    (row) => isValidElement<GroupedRowProps>(row) && Boolean(row.props.icon)
  );

  return (
    <View style={styles.section}>
      {header ? (
        <Text
          accessibilityRole="header"
          style={[styles.header, { color: systemColor("secondaryLabel", isDark) }]}
        >
          {header.toUpperCase()}
        </Text>
      ) : null}
      <View
        style={[
          styles.card,
          { backgroundColor: systemColor("secondarySystemGroupedBackground", isDark) },
        ]}
      >
        {rows.map((row, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are static children in order
          <View key={index}>
            {index > 0 ? (
              <View
                style={[
                  styles.separator,
                  hasIcons && styles.separatorPastIcon,
                  { backgroundColor: systemColor("separator", isDark) },
                ]}
              />
            ) : null}
            {row}
          </View>
        ))}
      </View>
      {footer ? (
        typeof footer === "string" ? (
          <Text style={[styles.footer, { color: systemColor("secondaryLabel", isDark) }]}>
            {footer}
          </Text>
        ) : (
          footer
        )
      ) : null}
    </View>
  );
}

type GroupedRowProps = {
  title: string;
  icon?: AppIconName;
  /** Secondary text on the trailing edge, like a setting's current value. */
  value?: string;
  /** "chevron" pushes or opens a picker; "external" leaves the app. */
  accessory?: "chevron" | "external" | "none";
  destructive?: boolean;
  /** Centers the title, for a lone action such as Sign Out. */
  centered?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
};

export function GroupedRow({
  title,
  icon,
  value,
  accessory = "chevron",
  destructive = false,
  centered = false,
  onPress,
  accessibilityHint,
}: GroupedRowProps) {
  const isDark = useColorScheme() === "dark";
  const tint = destructive ? systemColor("systemRed", isDark) : systemColor("label", isDark);
  const tertiary = systemColor("tertiaryLabel", isDark);

  // Pressed state is tracked by hand: NativeWind's Pressable wrapper drops function styles,
  // which left the row unstyled.
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityHint={
        accessibilityHint ?? (accessory === "external" ? "Opens in the browser" : undefined)
      }
      style={[
        styles.row,
        centered && styles.rowCentered,
        pressed && { backgroundColor: systemColor("systemGray4", isDark) },
      ]}
    >
      {icon ? (
        <View style={styles.iconSlot}>
          <AppIcon name={icon} size={20} color={tint} />
        </View>
      ) : null}
      <Text
        numberOfLines={1}
        style={[styles.title, centered && styles.titleCentered, { color: tint }]}
      >
        {title}
      </Text>
      {!centered && value ? (
        <Text
          numberOfLines={1}
          style={[styles.value, { color: systemColor("secondaryLabel", isDark) }]}
        >
          {value}
        </Text>
      ) : null}
      {!centered && accessory === "chevron" ? (
        <AppIcon name="chevron-forward" size={14} color={tertiary} />
      ) : null}
      {!centered && accessory === "external" ? (
        <AppIcon name="open-outline" size={16} color={tertiary} />
      ) : null}
    </Pressable>
  );
}

const ROW_LEADING = 16;
const ICON_SLOT = 30;

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
  },
  header: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
    marginHorizontal: ROW_LEADING + 4,
  },
  footer: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    marginHorizontal: ROW_LEADING + 4,
  },
  card: {
    borderRadius: 26,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: ROW_LEADING,
  },
  separatorPastIcon: {
    marginLeft: ROW_LEADING + ICON_SLOT + 8,
  },
  row: {
    minHeight: 52,
    paddingHorizontal: ROW_LEADING,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowCentered: {
    justifyContent: "center",
  },
  iconSlot: {
    width: ICON_SLOT,
    alignItems: "flex-start",
  },
  title: {
    flex: 1,
    fontSize: 17,
    letterSpacing: -0.4,
  },
  titleCentered: {
    flex: 0,
    textAlign: "center",
  },
  value: {
    fontSize: 17,
    letterSpacing: -0.4,
    maxWidth: "45%",
  },
});
