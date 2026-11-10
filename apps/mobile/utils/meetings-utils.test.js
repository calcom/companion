import { describe, expect, test } from "@jest/globals";
import { getPlainLocation } from "./meetings-utils";

describe("getPlainLocation", () => {
  test("returns an address or phone number as it is, trimmed", () => {
    expect(getPlainLocation("  QA Office, 3 Retest Road ")).toBe("QA Office, 3 Retest Road");
    expect(getPlainLocation("+1 234 567 8900")).toBe("+1 234 567 8900");
  });

  test("leaves out meeting links, which the Join button opens", () => {
    expect(getPlainLocation("https://example.com/qa-meeting")).toBeNull();
    expect(getPlainLocation("HTTP://meet.google.com/abc-defg-hij")).toBeNull();
  });

  test("leaves out integration ids and empty values", () => {
    expect(getPlainLocation("integrations:daily")).toBeNull();
    expect(getPlainLocation("")).toBeNull();
    expect(getPlainLocation(undefined)).toBeNull();
  });
});
