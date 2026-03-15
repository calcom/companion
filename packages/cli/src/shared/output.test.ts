import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setGlobalJsonMode,
  isGlobalJsonMode,
  setCompactMode,
  isCompactMode,
  setDryRunMode,
  isDryRunMode,
  outputJson,
  stdoutIsTTY,
} from "./output";

describe("global JSON mode", () => {
  beforeEach(() => {
    setGlobalJsonMode(false);
  });

  it("defaults to false", () => {
    expect(isGlobalJsonMode()).toBe(false);
  });

  it("can be enabled", () => {
    setGlobalJsonMode(true);
    expect(isGlobalJsonMode()).toBe(true);
  });

  it("can be toggled off", () => {
    setGlobalJsonMode(true);
    setGlobalJsonMode(false);
    expect(isGlobalJsonMode()).toBe(false);
  });
});

describe("compact mode", () => {
  beforeEach(() => {
    setCompactMode(false);
  });

  it("defaults to false", () => {
    expect(isCompactMode()).toBe(false);
  });

  it("can be enabled", () => {
    setCompactMode(true);
    expect(isCompactMode()).toBe(true);
  });
});

describe("dry-run mode", () => {
  beforeEach(() => {
    setDryRunMode(false);
  });

  it("defaults to false", () => {
    expect(isDryRunMode()).toBe(false);
  });

  it("can be enabled", () => {
    setDryRunMode(true);
    expect(isDryRunMode()).toBe(true);
  });
});

describe("outputJson", () => {
  beforeEach(() => {
    setCompactMode(false);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("outputs pretty-printed JSON by default", () => {
    const data = { name: "test", value: 42 };
    outputJson(data);
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  it("outputs single-line JSON in compact mode", () => {
    setCompactMode(true);
    const data = { name: "test", nested: { a: 1 } };
    outputJson(data);
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(data));
  });
});

describe("stdoutIsTTY", () => {
  it("returns a boolean", () => {
    expect(typeof stdoutIsTTY()).toBe("boolean");
  });
});
