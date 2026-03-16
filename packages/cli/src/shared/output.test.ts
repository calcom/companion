import { describe, it, expect, beforeEach } from "vitest";
import { setGlobalJsonMode, isGlobalJsonMode } from "./output";

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
