import { expect, jest, test } from "@jest/globals";

jest.mock("react-native-web/dist/exports/Text", () => ({ __esModule: true, default: "Text" }));
jest.mock("react-native-web/dist/exports/View", () => ({ __esModule: true, default: "View" }));
jest.mock("react-native-web/dist/exports/Pressable", () => ({ __esModule: true, default: "View" }));
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
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock("expo-glass-effect", () => ({ isLiquidGlassAvailable: () => false }));
jest.mock("lucide-react-native", () => {
  const Icon = () => null;
  return { Check: Icon, Copy: Icon, Ellipsis: Icon, SwitchCamera: Icon, Volume2: Icon };
});
jest.mock("./ParticipantGrid", () => ({ ParticipantGrid: () => null }));
jest.mock("./ControlTray", () => ({ ControlTray: () => null }));
jest.mock("./ReactionFloats", () => ({ ReactionFloats: () => null }));

const { fireEvent, render } = require("@testing-library/react-native");
const { initialCallState } = require("@/services/cal-video/types");
const { CallScreen } = require("./CallScreen");

test("copies the link and confirms from the call header without opening meeting details", async () => {
  const onCopyLink = jest.fn().mockResolvedValue(true);
  const onInfo = jest.fn();
  const noop = () => {};
  const screen = await render(
    <CallScreen
      driver={null}
      state={{ ...initialCallState({}), status: "joined" }}
      layout={{ staged: null, strip: [] }}
      pinnedIds={[]}
      localAvatarUrl={null}
      waitingCount={0}
      chat={null}
      reactions={null}
      onFlipCamera={noop}
      onSpeaker={noop}
      onCopyLink={onCopyLink}
      onInfo={onInfo}
      onMore={noop}
      onTilePress={noop}
      onToggleMicrophone={noop}
      onToggleCamera={noop}
      onLeave={noop}
    />
  );

  await fireEvent.press(screen.getByLabelText("Copy meeting link"));
  expect(onCopyLink).toHaveBeenCalledTimes(1);
  expect(onInfo).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Meeting link copied")).toBeTruthy();
});
