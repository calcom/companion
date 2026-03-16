import { describe, it, expect } from "vitest";
import { DryRunAbort } from "./client";

describe("DryRunAbort", () => {
  it("is an instance of Error", () => {
    const err = new DryRunAbort();
    expect(err).toBeInstanceOf(Error);
  });

  it("has name DryRunAbort", () => {
    const err = new DryRunAbort();
    expect(err.name).toBe("DryRunAbort");
  });

  it("has message dry-run", () => {
    const err = new DryRunAbort();
    expect(err.message).toBe("dry-run");
  });
});
