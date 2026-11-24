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

function richTextToBlockHtml(source: string): string {
  // Ignore HTML indentation between blocks, not line breaks inside their text.
  return richTextToHtml(source).replace(
    /(<\/(?:p|div|li|blockquote|h[1-6]|pre)>|<\/?(?:ul|ol)>)[ \t\r\n]+(?=<\/?(?:p|div|li|blockquote|h[1-6]|pre|ul|ol)\b)/gi,
    "$1"
  );
}

export function richTextToPlainText(source: string): string {
  return decodeHTML(textFilter.process(richTextToBlockHtml(source))).trim();
}

export function richTextToClipboardText(source: string): string {
  // Plain text that keeps what a reader needs after pasting: blank lines between blocks,
  // list markers and link targets.
  const lists: (number | null)[] = [];
  let link: { href: string; text: string } | null = null;
  let atLineStart = true;
  const emit = (text: string) => {
    if (text) atLineStart = text.endsWith("\n");
    return text;
  };
  const filter = new FilterXSS({
    whiteList: {},
    stripIgnoreTag: true,
    escapeHtml: (text) => {
      if (link) link.text += text;
      return emit(text);
    },
    onTag: (tag, html, { isClosing }) => {
      if (tag === "ul" || tag === "ol") {
        if (!isClosing) {
          lists.push(tag === "ol" ? Number(/\bstart="(\d+)"/.exec(html)?.[1] ?? 1) - 1 : null);
          return emit(atLineStart ? "" : "\n");
        }
        lists.pop();
        return emit(lists.length ? "" : "\n");
      }
      if (tag === "li") {
        if (isClosing) return emit(atLineStart ? "" : "\n");
        const count = lists[lists.length - 1];
        const indent = "  ".repeat(Math.max(lists.length - 1, 0));
        if (count === null || count === undefined) return emit(`${indent}• `);
        lists[lists.length - 1] = count + 1;
        return emit(`${indent}${count + 1}. `);
      }
      if (tag === "a") {
        if (!isClosing) {
          link = { href: decodeHTML(/\bhref="([^"]*)"/.exec(html)?.[1] ?? ""), text: "" };
          return "";
        }
        const { href = "", text = "" } = link ?? {};
        link = null;
        const label = decodeHTML(text).trim();
        const repeatsLabel = [href, href.replace(/^(mailto|tel):/i, "")].includes(label);
        return emit(!href || repeatsLabel ? "" : ` (${href})`);
      }
      if (tag === "br") return emit("\n");
      return emit(isClosing && /^(p|div|blockquote|h[1-6]|pre)$/.test(tag) ? "\n\n" : "");
    },
  });
  return decodeHTML(filter.process(richTextToBlockHtml(source)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
