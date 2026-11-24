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
  return {
    Check: Icon,
    Copy: Icon,
    Ellipsis: Icon,
    SwitchCamera: Icon,
    Users: Icon,
    Volume2: Icon,
  };
});
jest.mock("./ParticipantGrid", () => ({ ParticipantGrid: () => null }));
jest.mock("./ControlTray", () => ({ ControlTray: () => null }));
jest.mock("./ReactionFloats", () => ({ ReactionFloats: () => null }));

const { fireEvent, render } = require("@testing-library/react-native");
const { initialCallState } = require("@/services/cal-video/types");
const { CallScreen } = require("./CallScreen");

function renderCall(props) {
  const noop = () => {};
  return render(
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
      onCopyLink={async () => true}
      onInfo={noop}
      onPeople={noop}
      onMore={noop}
      onTilePress={noop}
      onToggleMicrophone={noop}
      onToggleCamera={noop}
      onLeave={noop}
      {...props}
    />
  );
}

test("copies the link and confirms from the call header without opening meeting details", async () => {
  const onCopyLink = jest.fn().mockResolvedValue(true);
  const onInfo = jest.fn();
  const screen = await renderCall({ onCopyLink, onInfo });

  await fireEvent.press(screen.getByLabelText("Copy meeting link"));
  expect(onCopyLink).toHaveBeenCalledTimes(1);
  expect(onInfo).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Meeting link copied")).toBeTruthy();
});

test("a room's header opens the meeting details menu", async () => {
  const onInfo = jest.fn();
  const onPeople = jest.fn();
  const screen = await renderCall({ onInfo, onPeople });

  expect(screen.queryByLabelText("People")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Meeting details"));
  expect(onInfo).toHaveBeenCalledTimes(1);
  expect(onPeople).not.toHaveBeenCalled();
});

test("a booking's header opens People directly, with no meeting details menu", async () => {
  const onPeople = jest.fn();
  const screen = await renderCall({ onInfo: null, onPeople });

  expect(screen.queryByLabelText("Meeting details")).toBeNull();
  await fireEvent.press(screen.getByLabelText("People"));
  expect(onPeople).toHaveBeenCalledTimes(1);
});
