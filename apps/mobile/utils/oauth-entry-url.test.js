import { describe, expect, test } from "@jest/globals";
import { buildAuthorizationEntryUrl } from "@/utils/oauth-entry-url";

const authorize =
  "https://app.example.test/auth/oauth2/authorize?client_id=companion&redirect_uri=calcom%3A%2F%2Fcb&state=abc";

describe("buildAuthorizationEntryUrl", () => {
  test("signs in on the authorize page itself", () => {
    expect(buildAuthorizationEntryUrl(authorize, "signin")).toBe(authorize);
  });

  test("signs up on the same origin and redirects back to authorize", () => {
    const url = new URL(buildAuthorizationEntryUrl(authorize, "signup"));
    expect(url.origin).toBe("https://app.example.test");
    expect(url.pathname).toBe("/signup");
    expect(url.searchParams.get("redirect")).toBe(authorize);
  });

  test.each(["google", "microsoft"])("starts %s SSO and calls back to authorize", (provider) => {
    const url = new URL(buildAuthorizationEntryUrl(authorize, provider));
    expect(url.pathname).toBe(`/auth/sso/${provider}`);
    expect(url.searchParams.get("callbackUrl")).toBe(authorize);
  });
});
