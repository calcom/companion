import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Linking } from "react-native";
import { RichText } from "./RichText";

jest.mock("react-native", () => ({
  ...jest.requireActual("react-native"),
  Text: "Text",
  View: "View",
  useColorScheme: () => "dark",
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
}));
jest.mock("react-native-web/dist/exports/View", () => ({ __esModule: true, default: "View" }));
jest.mock("react-native-web/dist/exports/Text", () => ({ __esModule: true, default: "Text" }));

describe("read-only rich-text previews", () => {
  test("renders short values and multiline text without tags or escaping", async () => {
    const screen = await render(React.createElement(RichText, null, "hello"));
    expect(screen.getByText("hello")).toBeTruthy();
    await screen.rerender(React.createElement(RichText, null, "x"));
    expect(screen.getByText("x")).toBeTruthy();
    await screen.rerender(React.createElement(RichText, null, "First & second\nNext line"));
    expect(
      screen.getByText("First & second\nNext line", { normalizer: (text) => text })
    ).toBeTruthy();
    await screen.rerender(
      React.createElement(RichText, null, "<p>Hello <strong>world</strong><br>Next</p>")
    );
    expect(screen.getByText("Hello world\nNext", { normalizer: (text) => text })).toBeTruthy();
  });

  test("renders Markdown paragraphs and lists as text, not Markdown markers", async () => {
    const screen = await render(
      React.createElement(RichText, null, "**First**\n\nSecond\n\n- One\n- Two")
    );
    for (const text of ["First", "Second", "One", "Two"]) {
      expect(screen.getByText(text, { exact: true })).toBeTruthy();
    }
    expect(screen.queryByText(/\*\*First\*\*|- One|- Two/)).toBeNull();
  });

  test("opens safe links but leaves unsafe links as inert text", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue();
    const screen = await render(
      React.createElement(
        RichText,
        null,
        '<a href="https://example.com/?a=1&amp;b=2">Example</a> <a href="javascript:alert(1)">Unsafe</a>'
      )
    );
    fireEvent.press(screen.getByText("Example"));
    expect(openURL).toHaveBeenCalledWith("https://example.com/?a=1&b=2");
    jest.clearAllMocks();
    fireEvent.press(screen.getByText("Unsafe"));
    expect(openURL).not.toHaveBeenCalled();
  });

  test("removes executable content and remote media before rendering", async () => {
    const screen = await render(
      React.createElement(
        RichText,
        null,
        '<p>Kept<img src="https://tracker.example/pixel"></p><script>hidden script</script><iframe>hidden frame</iframe>'
      )
    );
    expect(screen.getByText("Kept", { exact: true })).toBeTruthy();
    expect(screen.queryByText(/hidden/)).toBeNull();
    expect(screen.queryByRole("image")).toBeNull();
  });

  test("renders nothing for empty rich text", async () => {
    const screen = await render(React.createElement(RichText, null, "<p><br></p>"));
    expect(screen.toJSON()).toBeNull();
  });
});
