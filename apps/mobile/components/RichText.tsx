import RenderHtml, {
  type DomVisitorCallbacks,
  type MixedStyleDeclaration,
  type RenderersProps,
} from "@native-html/render";
import { useMemo } from "react";
import { Linking, useColorScheme, useWindowDimensions, View, type ViewStyle } from "react-native";
import { getColors } from "@/constants/colors";
import { isSafeRichTextUrl, richTextToHtml } from "@/utils/rich-text";

const renderersProps: Partial<RenderersProps> = {
  a: {
    onPress: (_event, url) => {
      if (isSafeRichTextUrl(url)) void Linking.openURL(url).catch(() => {});
    },
  },
};

// The sanitizer drops unsafe hrefs; show those links as plain text instead of links that do nothing.
const domVisitors: DomVisitorCallbacks = {
  onElement: (element) => {
    if (element.name === "a" && !element.attribs.href) element.name = "span";
  },
};

export function RichText({
  children,
  style,
  containerStyle,
}: {
  children: string;
  style?: MixedStyleDeclaration;
  containerStyle?: ViewStyle;
}) {
  const theme = getColors(useColorScheme() === "dark");
  const { width } = useWindowDimensions();
  const source = useMemo(() => ({ html: richTextToHtml(children) }), [children]);
  const baseStyle = useMemo(() => ({ color: theme.text, ...style }), [theme.text, style]);
  const tagsStyles = useMemo(
    () => ({
      a: { color: theme.link },
      p: { marginTop: 0, marginBottom: 8 },
      // Match paragraph spacing; the renderer's default list margins leave a blank line around lists.
      ul: { marginTop: 0, marginBottom: 8 },
      ol: { marginTop: 0, marginBottom: 8 },
    }),
    [theme.link]
  );
  if (!source.html) return null;

  return (
    <View style={containerStyle}>
      <RenderHtml
        contentWidth={width}
        source={source}
        baseStyle={baseStyle}
        tagsStyles={tagsStyles}
        renderersProps={renderersProps}
        domVisitors={domVisitors}
        enableCSSInlineProcessing={false}
      />
    </View>
  );
}
