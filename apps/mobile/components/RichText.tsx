import { useMemo } from "react";
import { Linking, type TextStyle } from "react-native";
import { EnrichedText } from "react-native-enriched-html";
import { isSafeRichTextUrl, richTextToHtml } from "@/utils/rich-text";

export function RichText({
  children,
  style,
  numberOfLines,
}: {
  children: string;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const html = useMemo(() => richTextToHtml(children), [children]);
  if (!html) return null;

  return (
    <EnrichedText
      style={style}
      numberOfLines={numberOfLines}
      onLinkPress={({ url }) => {
        if (isSafeRichTextUrl(url)) void Linking.openURL(url).catch(() => {});
      }}
    >
      {html}
    </EnrichedText>
  );
}
