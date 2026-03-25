import { describe, it, expect } from "vitest";
import { CalApiError } from "./errors.js";

describe("CalApiError", () => {
  it("creates an error with status, message, and body", () => {
    const error = new CalApiError(404, "Not found", { detail: "resource missing" });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CalApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe("Not found");
    expect(error.body).toEqual({ detail: "resource missing" });
    expect(error.name).toBe("CalApiError");
  });

  it("sets the name property to CalApiError", () => {
    const error = new CalApiError(500, "Internal", null);
    expect(error.name).toBe("CalApiError");
  });

  it("handles string body", () => {
    const error = new CalApiError(400, "Bad request", "invalid input");
    expect(error.body).toBe("invalid input");
  });

  it("handles null body", () => {
    const error = new CalApiError(401, "Unauthorized", null);
    expect(error.body).toBeNull();
  });

  it("is throwable and catchable", () => {
    expect(() => {
      throw new CalApiError(403, "Forbidden", {});
    }).toThrow(CalApiError);
  });

  it("has a proper stack trace", () => {
    const error = new CalApiError(500, "Server error", {});
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("CalApiError");
  });
});
