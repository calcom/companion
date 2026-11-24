import { expect, jest, test } from "@jest/globals";

jest.mock("react-native-web/dist/exports/Text", () => ({ __esModule: true, default: "Text" }));
jest.mock("react-native-web/dist/exports/View", () => ({ __esModule: true, default: "View" }));
jest.mock("react-native-web/dist/exports/Pressable", () => ({ __esModule: true, default: "View" }));
// React Native 0.86 can't load under Node, so this stands in for the parts these tests reach.
jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (options) => options.ios ?? options.default },
  Pressable: "View",
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) =>
      Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity)) : (style ?? {}),
  },
  Text: "Text",
  View: "View",
}));
jest.mock("lucide-react-native", () => ({ Hand: () => null }));
jest.mock("./GlassSurface", () => ({ GlassSurface: require("react-native").View }));
const { render, fireEvent } = require("@testing-library/react-native");
const { ReactionBar } = require("./ReactionBar");

test("offers the eight call emojis in web order without a hand on unsupported drivers", async () => {
  const onReact = jest.fn();
  const screen = await render(<ReactionBar onReact={onReact} hand={null} />);
  expect(
    screen
      .getAllByLabelText(
        /^(Heart|Thumbs up|Celebrate|Clapping|Laughing|Surprised|Sad|Thumbs down)$/
      )
      .map((button) => button.props.accessibilityLabel)
  ).toEqual([
    "Heart",
    "Thumbs up",
    "Celebrate",
    "Clapping",
    "Laughing",
    "Surprised",
    "Sad",
    "Thumbs down",
  ]);
  expect(screen.queryByLabelText("Raise hand")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Clapping"));
  expect(onReact).toHaveBeenCalledWith("👏");
});

test("keeps hand toggles for drivers that support them", async () => {
  const onToggle = jest.fn();
  const screen = await render(
    <ReactionBar onReact={jest.fn()} hand={{ raised: false, onToggle }} />
  );
  await fireEvent.press(screen.getByLabelText("Raise hand"));
  expect(onToggle).toHaveBeenCalledTimes(1);
});
