import { describe, expect, test } from "@jest/globals";
import { validateExternalRedirectUrl } from "./redirectUrlValidation";

describe("validateExternalRedirectUrl", () => {
  test("allows an empty redirect URL", () => {
    expect(validateExternalRedirectUrl("")).toEqual({ valid: true });
    expect(validateExternalRedirectUrl("   ")).toEqual({ valid: true });
  });

  test("allows https redirect URLs", () => {
    expect(validateExternalRedirectUrl("https://example.com/thanks?booking=123")).toEqual({
      valid: true,
    });
  });

  test("allows http redirect URLs to match the web app schema", () => {
    expect(validateExternalRedirectUrl("http://localhost:3000/thanks")).toEqual({ valid: true });
    expect(validateExternalRedirectUrl("http://127.0.0.1:3000/thanks")).toEqual({ valid: true });
    expect(validateExternalRedirectUrl("http://example.com/thanks")).toEqual({ valid: true });
  });

  test("rejects javascript and data URLs", () => {
    expect(validateExternalRedirectUrl("javascript:alert(1)").valid).toBe(false);
    expect(validateExternalRedirectUrl("data:text/html,<script>alert(1)</script>").valid).toBe(
      false
    );
  });

  test("rejects non-http redirect URLs", () => {
    const result = validateExternalRedirectUrl("ftp://example.com/file");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("HTTP");
  });
});
