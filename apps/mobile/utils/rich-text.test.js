import { describe, expect, test } from "@jest/globals";
import { normalizeMarkdown } from "./normalizeMarkdown";
import {
  isSafeRichTextUrl,
  richTextToHtml,
  richTextToPlainText,
  sanitizeRichTextHtml,
} from "./rich-text";

describe("rich-text descriptions", () => {
  test("renders Markdown, HTML and plain text without flattening their structure", () => {
    expect(
      richTextToHtml("# Welcome\n\n**Hello** [guests](https://example.com)\n\n- One\n- Two")
    ).toBe(
      '<h1>Welcome</h1>\n<p><strong>Hello</strong> <a href="https://example.com">guests</a></p>\n<ul>\n<li>One</li>\n<li>Two</li>\n</ul>'
    );
    expect(richTextToHtml("<p>Hello <strong>guests</strong></p><p>Next<br>line</p>")).toBe(
      "<p>Hello <strong>guests</strong></p><p>Next<br>line</p>"
    );
    expect(richTextToHtml("First & second\nNext line")).toBe(
      "<p>First &amp; second<br>Next line</p>"
    );
    expect(richTextToHtml("**Markdown** with <em>HTML</em>")).toBe(
      "<p><strong>Markdown</strong> with <em>HTML</em></p>"
    );
  });

  test("drops executable markup, attributes and remote media but keeps safe text", () => {
    expect(
      richTextToHtml(
        '<script>bad()</script><p style="color:red" onclick="bad()">Hello<img src="https://tracker.example/pixel"><iframe src="https://example.com">hidden</iframe></p>'
      )
    ).toBe("<p>Hello</p>");
    expect(richTextToHtml('<svg><a href="https://example.com">hidden</a></svg><b>Kept</b>')).toBe(
      "<p><b>Kept</b></p>"
    );
  });

  test("only permits web, email and telephone links, including entity-encoded input", () => {
    for (const url of [
      "javascript:alert(1)",
      "java&#x73;cript:alert(1)",
      "data:text/html,bad",
      "file:///etc/passwd",
      "calcom://logout",
      "//example.com",
    ]) {
      expect(sanitizeRichTextHtml(`<a href="${url}">Link</a>`)).toBe("<a>Link</a>");
    }
    for (const url of [
      "https://example.com/?a=1&amp;b=2",
      "http://example.com",
      "mailto:hello@example.com",
      "tel:+15555555555",
    ]) {
      expect(sanitizeRichTextHtml(`<a href="${url}">Link</a>`)).toBe(`<a href="${url}">Link</a>`);
      expect(isSafeRichTextUrl(url)).toBe(true);
    }
    expect(richTextToHtml("[unsafe](javascript:alert%281%29)")).not.toContain("javascript:");
    expect(isSafeRichTextUrl("https://example.com\n")).toBe(false);
  });

  test.each([
    "",
    " ",
    "<p><br></p>",
    "<p>&nbsp;&#160;</p>",
    "<script>bad()</script>",
  ])("does not render empty editor content: %s", (source) => {
    expect(richTextToHtml(source)).toBe("");
  });

  test("keeps escaped code literal, and decodes entities only for plain-text copies/previews", () => {
    expect(richTextToHtml("`<script>literal</script>`")).toBe(
      "<p><code>&lt;script&gt;literal&lt;/script&gt;</code></p>"
    );
    expect(richTextToPlainText("<p>Tom &amp; Zo&#235;</p><p><b>Next</b> line</p>")).toBe(
      "Tom & Zoë\nNext line"
    );
    expect(normalizeMarkdown("<p>Tom &amp; Zo&#235;</p><p>**Next**</p>")).toBe(
      "Tom & Zoë **Next**"
    );
    expect(normalizeMarkdown("**Bold** [link](https://example.com)\n\n- One\n- Two")).toBe(
      "Bold link One Two"
    );
  });
});
