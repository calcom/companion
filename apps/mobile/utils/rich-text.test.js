import { describe, expect, test } from "@jest/globals";
import { normalizeMarkdown } from "./normalizeMarkdown";
import {
  isSafeRichTextUrl,
  richTextToHtml,
  richTextToNativeHtml,
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

  test("prepares iOS native input without changing the saved HTML", () => {
    const lines = "First & second\nNext line";
    expect(richTextToNativeHtml(lines)).toBe("<p>First &amp; second\nNext line</p>");
    expect(richTextToNativeHtml("<p>Hello <strong>world</strong><br>Next</p>")).toBe(
      "<p>Hello <strong>world</strong>\nNext</p>"
    );
    expect(richTextToNativeHtml("hello")).toBe("<html><p>hello</p></html>");
    expect(richTextToNativeHtml("<h1>x</h1>")).toBe("<html><h1>x</h1></html>");
    expect(richTextToHtml("hello")).toBe("<p>hello</p>");
    expect(richTextToNativeHtml("<p><br></p>")).toBe("");
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

  test("ignores inter-block HTML indentation but keeps text whitespace and empty paragraphs", () => {
    expect(richTextToPlainText("**First**\n\nSecond")).toBe(
      richTextToPlainText("<p><b>First</b></p><p>Second</p>")
    );
    expect(richTextToPlainText("- One\n- Two")).toBe(
      richTextToPlainText("<ul><li>One</li><li>Two</li></ul>")
    );
    expect(richTextToPlainText("<p>First\n\nSecond</p>")).toBe("First\n\nSecond");
    expect(richTextToPlainText("<p>First</p><p></p><p>Second</p>")).toBe("First\n\nSecond");
    expect(richTextToPlainText("<p><b>First</b> <i>Second</i></p>")).toBe("First Second");
  });
});
