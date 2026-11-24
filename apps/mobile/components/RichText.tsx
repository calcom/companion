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

// The renderer's default heading sizes, relative to the body text.
const HEADING_SCALES = { h1: 2, h2: 1.5, h3: 1.17, h4: 1, h5: 0.83, h6: 0.67 };

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
  const fontSize = typeof style?.fontSize === "number" ? style.fontSize : 14;
  const lineHeight = typeof style?.lineHeight === "number" ? style.lineHeight : undefined;
  const tagsStyles = useMemo(
    () => ({
      a: { color: theme.link },
      p: { marginTop: 0, marginBottom: 8 },
      // Match paragraph spacing; the renderer's default list margins leave a blank line around lists.
      ul: { marginTop: 0, marginBottom: 8 },
      ol: { marginTop: 0, marginBottom: 8 },
      // Headings inherit a fixed line height, which clips their larger glyphs; scale it with them.
      ...(lineHeight === undefined
        ? {}
        : Object.fromEntries(
            Object.entries(HEADING_SCALES).map(([tag, scale]) => [
              tag,
              { fontSize: fontSize * scale, lineHeight: Math.round(lineHeight * scale) },
            ])
          )),
    }),
    [theme.link, fontSize, lineHeight]
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
