import { describe, it, expect, beforeEach, vi } from "vitest";
import { setGlobalJsonMode, isGlobalJsonMode, stdoutIsTTY } from "./output";

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
