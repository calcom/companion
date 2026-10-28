import { useMemo } from "react";
import { Linking, type TextStyle, useColorScheme } from "react-native";
import { EnrichedText } from "react-native-enriched-html";
import { getColors } from "@/constants/colors";
import { isSafeRichTextUrl, richTextToNativeHtml } from "@/utils/rich-text";

export function RichText({
  children,
  style,
  numberOfLines,
}: {
  children: string;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const theme = getColors(useColorScheme() === "dark");
  const html = useMemo(() => richTextToNativeHtml(children), [children]);
  if (!html) return null;

  return (
    <EnrichedText
      style={style}
      htmlStyle={{
        a: { color: theme.link, pressColor: theme.link },
        ul: { bulletColor: theme.text },
        ol: { markerColor: theme.text },
      }}
      numberOfLines={numberOfLines}
      onLinkPress={({ url }) => {
        if (isSafeRichTextUrl(url)) void Linking.openURL(url).catch(() => {});
      }}
    >
      {html}
    </EnrichedText>
  );
}
