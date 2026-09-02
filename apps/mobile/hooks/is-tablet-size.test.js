const { isTabletSize, TABLET_MIN_SHORTEST_SIDE } = require("./is-tablet-size");

describe("isTabletSize", () => {
  it("classifies typical phone portrait dimensions as non-tablet", () => {
    expect(isTabletSize(390, 844)).toBe(false);
  });

  it("classifies typical phone landscape dimensions as non-tablet", () => {
    expect(isTabletSize(844, 390)).toBe(false);
  });

  it("classifies iPad portrait dimensions as tablet", () => {
    expect(isTabletSize(820, 1180)).toBe(true);
  });

  it("classifies iPad landscape dimensions as tablet", () => {
    expect(isTabletSize(1180, 820)).toBe(true);
  });

  it("uses the shortest side, so orientation does not change the result", () => {
    expect(isTabletSize(744, 1133)).toBe(isTabletSize(1133, 744));
  });

  it("treats the exact threshold on the shortest side as a tablet", () => {
    expect(isTabletSize(TABLET_MIN_SHORTEST_SIDE, 2000)).toBe(true);
  });

  it("treats one pixel below the threshold as non-tablet", () => {
    expect(isTabletSize(TABLET_MIN_SHORTEST_SIDE - 1, 2000)).toBe(false);
  });
});
