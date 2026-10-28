import { decodeHTML } from "entities";
import { marked } from "marked";
import { FilterXSS } from "xss";

export function isSafeRichTextUrl(url: string): boolean {
  return (
    /^(https?:\/\/|mailto:|tel:)/i.test(url) &&
    !Array.from(url).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
  );
}

const htmlFilter = new FilterXSS({
  whiteList: {
    p: [],
    br: [],
    div: [],
    span: [],
    strong: [],
    b: [],
    em: [],
    i: [],
    u: [],
    s: [],
    del: [],
    strike: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    ul: [],
    ol: ["start"],
    li: [],
    blockquote: [],
    pre: [],
    code: [],
    a: ["href"],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "iframe", "object", "svg", "math", "template"],
  css: false,
  onTagAttr: (_tag, name, value) =>
    name === "href" && !isSafeRichTextUrl(decodeHTML(value)) ? "" : undefined,
});

const textFilter = new FilterXSS({
  whiteList: {},
  stripIgnoreTag: true,
  onTag: (tag, _html, { isClosing }) =>
    tag === "br" || (isClosing && /^(p|div|li|blockquote|h[1-6]|pre)$/.test(tag)) ? "\n" : "",
});

export function sanitizeRichTextHtml(html: string): string {
  const safeHtml = htmlFilter.process(html);
  return decodeHTML(textFilter.process(safeHtml)).trim() ? safeHtml.trim() : "";
}

export function richTextToHtml(source: string): string {
  // Markdown accepts embedded HTML, so fields need no format guess or destructive conversion.
  return sanitizeRichTextHtml(marked.parse(source, { async: false, breaks: true }));
}

export function richTextToPlainText(source: string): string {
  return decodeHTML(textFilter.process(richTextToHtml(source))).trim();
}
