const {
  appendCaption,
  CAPTION_BUFFER_LINES,
  CAPTION_LINGER_MS,
  visibleCaptions,
} = require("./captions");

const line = (id, overrides = {}) => ({
  id,
  participantId: "a",
  participantName: "Ada",
  text: `line ${id}`,
  final: true,
  at: 0,
  ...overrides,
});

describe("appendCaption", () => {
  test("replaces a participant's interim line in place and keeps finals", () => {
    let lines = appendCaption([], line("1", { final: false, text: "hel" }));
    lines = appendCaption(lines, line("2", { final: false, text: "hello" }));
    expect(lines.map((l) => l.text)).toEqual(["hello"]);
    lines = appendCaption(lines, line("3", { text: "hello there" }));
    lines = appendCaption(lines, line("4", { final: false, text: "and" }));
    expect(lines.map((l) => l.text)).toEqual(["hello there", "and"]);
  });

  test("bounds the buffer", () => {
    let lines = [];
    for (let i = 0; i < CAPTION_BUFFER_LINES + 5; i++)
      lines = appendCaption(lines, line(String(i), { at: i }));
    expect(lines).toHaveLength(CAPTION_BUFFER_LINES);
  });
});

describe("visibleCaptions", () => {
  test("shows the newest three and drops stale finals, never a live interim", () => {
    const lines = [
      line("old", { at: 0 }),
      line("a", { at: 10_000 }),
      line("b", { at: 11_000 }),
      line("c", { at: 12_000 }),
      line("live", { at: 0, final: false, participantId: "b" }),
    ];
    const shown = visibleCaptions(lines, 13_000);
    expect(shown.map((l) => l.id)).toEqual(["b", "c", "live"]);
    expect(visibleCaptions([line("x", { at: 0 })], CAPTION_LINGER_MS + 1)).toEqual([]);
  });
});
