import { richTextToPlainText } from "./rich-text";

export const normalizeMarkdown = (text: string): string =>
  richTextToPlainText(text).replace(/\s+/g, " ").trim();
