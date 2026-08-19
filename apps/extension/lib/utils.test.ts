import { describe, expect, it } from "vitest";
import {
  buildSafeBookingUrl,
  validateExtensionOAuthAuthorizeUrl,
  validateExtensionOAuthTokenEndpoint,
} from "./utils";

describe("buildSafeBookingUrl", () => {
  it("accepts https Cal.com booking URLs", () => {
    expect(
      buildSafeBookingUrl({
        slug: "intro",
        users: [{ username: "alice" }],
        bookingUrl: "https://cal.com/alice/intro?overlayCalendar=true",
      })
    ).toBe("https://cal.com/alice/intro?overlayCalendar=true");
  });

  it("falls back to an encoded Cal.com URL when the API returns an unsafe host", () => {
    expect(
      buildSafeBookingUrl({
        slug: "team/intro",
        users: [{ username: "alice@example.com" }],
        bookingUrl: "https://evil.example/phish",
      })
    ).toBe("https://cal.com/alice%40example.com/team%2Fintro");
  });

  it("falls back when the API returns a javascript URL", () => {
    expect(
      buildSafeBookingUrl({
        slug: "intro",
        users: [{ username: "alice" }],
        bookingUrl: "javascript:alert(1)",
      })
    ).toBe("https://cal.com/alice/intro");
  });
});

describe("validateExtensionOAuthAuthorizeUrl", () => {
  it("rejects authorize URLs outside Cal app origins", () => {
    const result = validateExtensionOAuthAuthorizeUrl(
      "https://evil.example/auth/oauth2/authorize?state=s&redirect_uri=https%3A%2F%2Fexample.com",
      "https://extension.example/callback"
    );

    expect(result.ok).toBe(false);
  });

  it("rejects redirect URIs that do not match the browser identity redirect URL", () => {
    const result = validateExtensionOAuthAuthorizeUrl(
      "https://app.cal.com/auth/oauth2/authorize?state=s&redirect_uri=https%3A%2F%2Fevil.example%2Fcallback",
      "https://extension.example/callback"
    );

    expect(result.ok).toBe(false);
  });

  it("rejects redirect URIs that only share the extension redirect origin prefix", () => {
    const result = validateExtensionOAuthAuthorizeUrl(
      "https://app.cal.com/auth/oauth2/authorize?state=s&redirect_uri=https%3A%2F%2Fextension.example.evil.com%2Fcallback",
      "https://extension.example"
    );

    expect(result.ok).toBe(false);
  });

  it("rejects redirect URIs that only share the extension redirect path prefix", () => {
    const result = validateExtensionOAuthAuthorizeUrl(
      "https://app.cal.com/auth/oauth2/authorize?state=s&redirect_uri=https%3A%2F%2Fextension.example%2Fcallback-extra",
      "https://extension.example/callback"
    );

    expect(result.ok).toBe(false);
  });

  it("rejects authorize URLs when the extension redirect URL is unavailable", () => {
    const result = validateExtensionOAuthAuthorizeUrl(
      "https://app.cal.com/auth/oauth2/authorize?state=s&redirect_uri=https%3A%2F%2Fextension.example%2Fcallback"
    );

    expect(result.ok).toBe(false);
  });

  it("accepts Cal authorize URLs with matching extension redirects", () => {
    expect(
      validateExtensionOAuthAuthorizeUrl(
        "https://app.cal.com/auth/oauth2/authorize?state=s&redirect_uri=https%3A%2F%2Fextension.example%2Fcallback",
        "https://extension.example/callback"
      )
    ).toEqual({ ok: true });
  });

  it("accepts Cal authorize URLs matching any configured extension redirect", () => {
    expect(
      validateExtensionOAuthAuthorizeUrl(
        "https://app.cal.com/auth/oauth2/authorize?state=s&redirect_uri=https%3A%2F%2Feu-extension.example%2Fcallback",
        ["https://extension.example/callback", "https://eu-extension.example/callback"]
      )
    ).toEqual({ ok: true });
  });
});

describe("validateExtensionOAuthTokenEndpoint", () => {
  it("rejects token exchange endpoints outside Cal API origins", () => {
    expect(validateExtensionOAuthTokenEndpoint("https://evil.example/oauth/token").ok).toBe(false);
  });

  it("accepts Cal API token endpoints", () => {
    expect(validateExtensionOAuthTokenEndpoint("https://api.cal.com/v2/oauth/token")).toEqual({
      ok: true,
    });
    expect(validateExtensionOAuthTokenEndpoint("https://api.cal.eu/v2/oauth/token")).toEqual({
      ok: true,
    });
  });
});
