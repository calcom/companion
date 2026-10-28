import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { RichTextEditor } from "./RichTextEditor";

const mockSetValue = jest.fn();
const mockToggleBold = jest.fn();
jest.mock("react-native", () => ({
  ...jest.requireActual("react-native"),
  useColorScheme: () => "light",
  View: "View",
  Pressable: "View",
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-web/dist/exports/Pressable", () => ({ __esModule: true, default: "View" }));
jest.mock("react-native-web/dist/exports/View", () => ({ __esModule: true, default: "View" }));
jest.mock("react-native-enriched-html", () => {
  const React = require("react");
  return {
    EnrichedTextInput: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        setValue: mockSetValue,
        toggleBold: mockToggleBold,
        focus: () => props.onFocus(),
      }));
      // biome-ignore lint/complexity/useLiteralKeys: avoid NativeWind injecting an out-of-scope import into the hoisted mock
      return React["createElement"]("TextInput", props);
    }),
  };
});

const props = {
  value: "**Original**",
  placeholder: "Enter description",
  accessibilityLabel: "Description",
};

describe("rich-text description editor", () => {
  test("persists the first edit even when HTML arrives before onChangeText", async () => {
    const onChangeText = jest.fn();
    const screen = await render(React.createElement(RichTextEditor, { ...props, onChangeText }));
    const input = screen.getByLabelText("Description");
    await fireEvent(input, "focus");
    await fireEvent(input, "changeHtml", { nativeEvent: { value: "<p><b>Original</b></p>" } });
    expect(onChangeText).not.toHaveBeenCalled();

    await fireEvent(input, "changeHtml", { nativeEvent: { value: "<p><b>Origina</b></p>" } });
    expect(onChangeText).toHaveBeenLastCalledWith("<p><b>Origina</b></p>");
    await fireEvent(input, "changeHtml", { nativeEvent: { value: "<p><br></p>" } });
    expect(onChangeText).toHaveBeenLastCalledWith("");
  });

  test("ignores initialization and focus, but emits sanitized HTML after editing", async () => {
    const onChangeText = jest.fn();
    const screen = await render(React.createElement(RichTextEditor, { ...props, onChangeText }));
    const input = screen.getByLabelText("Description");
    await fireEvent(input, "changeHtml", { nativeEvent: { value: "<p><b>Original</b></p>" } });
    await fireEvent(input, "focus");
    await fireEvent(input, "changeHtml", { nativeEvent: { value: "<p><b>Original</b></p>" } });
    expect(onChangeText).not.toHaveBeenCalled();

    await fireEvent(input, "changeText", { nativeEvent: { value: "Edited" } });
    await fireEvent(input, "changeHtml", {
      nativeEvent: { value: '<p onclick="bad()">Edited</p>' },
    });
    expect(onChangeText).toHaveBeenLastCalledWith("<p>Edited</p>");
    await fireEvent(input, "changeHtml", { nativeEvent: { value: "<p><br></p>" } });
    expect(onChangeText).toHaveBeenLastCalledWith("");
  });

  test("applies formatting and loads externally changed descriptions without stale content", async () => {
    const onChangeText = jest.fn();
    const screen = await render(React.createElement(RichTextEditor, { ...props, onChangeText }));
    await fireEvent.press(screen.getByLabelText("Bold"));
    expect(mockToggleBold).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByLabelText("Description"), "changeHtml", {
      nativeEvent: { value: "<p><b>Edited</b></p>" },
    });
    expect(onChangeText).toHaveBeenLastCalledWith("<p><b>Edited</b></p>");

    await screen.rerender(
      React.createElement(RichTextEditor, { ...props, value: "New *description*", onChangeText })
    );
    expect(mockSetValue).toHaveBeenLastCalledWith("<p>New <em>description</em></p>");
  });
});
