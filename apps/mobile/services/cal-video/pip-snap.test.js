const { cornerPosition, nearestCorner } = require("./pip-snap");

const bounds = {
  width: 400,
  height: 800,
  pipWidth: 100,
  pipHeight: 140,
  top: 60,
  bottom: 100,
  side: 16,
};

describe("cornerPosition", () => {
  test("keeps the tile inside the header, tray and side margins", () => {
    expect(cornerPosition("top-left", bounds)).toEqual({ x: 16, y: 60 });
    expect(cornerPosition("top-right", bounds)).toEqual({ x: 284, y: 60 });
    expect(cornerPosition("bottom-left", bounds)).toEqual({ x: 16, y: 560 });
    expect(cornerPosition("bottom-right", bounds)).toEqual({ x: 284, y: 560 });
  });

  test("never goes negative on a surface smaller than the tile", () => {
    expect(cornerPosition("bottom-right", { ...bounds, width: 50, height: 50 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("nearestCorner", () => {
  const still = { x: 0, y: 0 };

  test("picks the closest corner to where the tile was dropped", () => {
    expect(nearestCorner({ x: 30, y: 80 }, still, bounds)).toBe("top-left");
    expect(nearestCorner({ x: 250, y: 100 }, still, bounds)).toBe("top-right");
    expect(nearestCorner({ x: 40, y: 500 }, still, bounds)).toBe("bottom-left");
    expect(nearestCorner({ x: 200, y: 400 }, still, bounds)).toBe("bottom-right");
  });

  test("a flick carries the tile toward the corner it was thrown at", () => {
    // Dropped near the top-left, but thrown hard to the right.
    expect(nearestCorner({ x: 40, y: 80 }, { x: 2400, y: 0 }, bounds)).toBe("top-right");
    // Dropped near the top-right, but thrown down.
    expect(nearestCorner({ x: 280, y: 80 }, { x: 0, y: 3000 }, bounds)).toBe("bottom-right");
  });
});
