import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setGlobalJsonMode,
  isGlobalJsonMode,
  setCompactMode,
  isCompactMode,
  stdoutIsTTY,
  outputJson,
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

  it("can be toggled off", () => {
    setCompactMode(true);
    setCompactMode(false);
    expect(isCompactMode()).toBe(false);
  });
});

describe("stdoutIsTTY", () => {
  it("returns a boolean", () => {
    expect(typeof stdoutIsTTY()).toBe("boolean");
  });

  it("returns false when stdout.isTTY is undefined", () => {
    const original = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", { value: undefined, configurable: true });
    expect(stdoutIsTTY()).toBe(false);
    Object.defineProperty(process.stdout, "isTTY", { value: original, configurable: true });
  });

  it("returns true when stdout.isTTY is true", () => {
    const original = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    expect(stdoutIsTTY()).toBe(true);
    Object.defineProperty(process.stdout, "isTTY", { value: original, configurable: true });
  });
});

describe("outputJson", () => {
  beforeEach(() => {
    setCompactMode(false);
  });

  it("pretty-prints by default", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    outputJson({ a: 1 });
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ a: 1 }, null, 2));
    spy.mockRestore();
  });

  it("outputs single-line when compact", () => {
    setCompactMode(true);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    outputJson({ a: 1 });
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ a: 1 }));
    spy.mockRestore();
  });
});
