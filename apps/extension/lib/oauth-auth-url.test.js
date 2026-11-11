import { getAuthorizeUrl } from "./oauth-auth-url";

const authorize =
  "https://app.example.test/auth/oauth2/authorize?client_id=ext&redirect_uri=https%3A%2F%2Fext.example%2Fcb&state=abc";

describe("getAuthorizeUrl", () => {
  test("returns a plain authorize URL unchanged", () => {
    expect(getAuthorizeUrl(authorize).searchParams.get("state")).toBe("abc");
  });

  test("unwraps the authorize URL a signup entry redirects to", () => {
    const signup = `https://app.example.test/signup?redirect=${encodeURIComponent(authorize)}`;
    const url = getAuthorizeUrl(signup);
    expect(url.searchParams.get("state")).toBe("abc");
    expect(url.searchParams.get("redirect_uri")).toBe("https://ext.example/cb");
  });

  test("unwraps the authorize URL an SSO entry calls back to", () => {
    const sso = `https://app.example.test/auth/sso/google?callbackUrl=${encodeURIComponent(authorize)}`;
    expect(getAuthorizeUrl(sso).searchParams.get("state")).toBe("abc");
  });

  test("ignores a nested URL on another origin", () => {
    const foreign = authorize.replace("app.example.test", "evil.example");
    const signup = `https://app.example.test/signup?redirect=${encodeURIComponent(foreign)}`;
    expect(getAuthorizeUrl(signup).searchParams.get("state")).toBeNull();
  });
});
