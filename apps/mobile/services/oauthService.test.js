import { beforeEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  CryptoEncoding: { BASE64: "base64" },
  getRandomBytes: jest.fn(() => new Uint8Array(32).fill(7)),
  digestStringAsync: jest.fn(async () => "challenge+/="),
}));
jest.mock("@/utils/network", () => ({ fetchWithTimeout: jest.fn() }));
jest.mock("@/utils/storage", () => ({
  generalStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() },
  isChromeStorageAvailable: () => false,
}));

// The node preset isn't a native platform; these cover the iOS/Android auth-session path.
const { Platform } = require("react-native");
Platform.OS = "ios";

const WebBrowser = require("expo-web-browser");
const { fetchWithTimeout } = require("@/utils/network");
const { CalComOAuthService, OAuthCancelledError } = require("@/services/oauthService");
const { NativeSignupError, SignupUnderReviewError } = require("@/utils/native-signup");

const config = {
  clientId: "companion",
  redirectUri: "calcom://oauth/callback",
  calcomBaseUrl: "https://app.example.test",
  scope: "PROFILE_READ",
};
const account = { email: "person@example.com", username: "person", password: "long enough pw" };

const jsonResponse = (status, body) => ({ ok: status < 400, status, json: async () => body });

describe("CalComOAuthService", () => {
  let service;

  beforeEach(() => {
    service = new CalComOAuthService(config);
  });

  test("opens Cal.com signup that continues into the authorize page", async () => {
    WebBrowser.openAuthSessionAsync.mockResolvedValue({ type: "cancel" });

    await expect(service.startAuthorizationFlow("signup")).rejects.toBeInstanceOf(
      OAuthCancelledError
    );

    const [openedUrl, redirectUri] = WebBrowser.openAuthSessionAsync.mock.calls[0];
    const url = new URL(openedUrl);
    expect(url.pathname).toBe("/signup");
    expect(new URL(url.searchParams.get("redirect")).pathname).toBe("/auth/oauth2/authorize");
    expect(redirectUri).toBe(config.redirectUri);
  });

  test("reports a dismissed browser as a cancel, not a failure", async () => {
    WebBrowser.openAuthSessionAsync.mockResolvedValue({ type: "dismiss" });

    await expect(service.startAuthorizationFlow()).rejects.toBeInstanceOf(OAuthCancelledError);
  });

  test("native signup exchanges its authorization code with the PKCE verifier", async () => {
    fetchWithTimeout.mockImplementation(async (url, init) => {
      if (url.endsWith("/api/auth/oauth/signup")) {
        const body = JSON.parse(init.body);
        expect(body).toMatchObject({
          ...account,
          client_id: "companion",
          verification_code: "123456",
          redirect_uri: config.redirectUri,
          code_challenge: "challenge-_",
          code_challenge_method: "S256",
          scope: "PROFILE_READ",
        });
        return jsonResponse(201, { status: "created", code: "auth-code", state: body.state });
      }
      const form = new URLSearchParams(init.body);
      expect(form.get("code")).toBe("auth-code");
      expect(form.get("code_verifier")).toBeTruthy();
      return jsonResponse(200, { access_token: "access", refresh_token: "refresh" });
    });

    const tokens = await service.completeNativeSignup(account, " 123456 ");

    expect(tokens).toMatchObject({ accessToken: "access", refreshToken: "refresh" });
  });

  test("native signup held for review signs nobody in", async () => {
    fetchWithTimeout.mockResolvedValue(jsonResponse(202, { status: "under_review" }));

    await expect(service.completeNativeSignup(account, "123456")).rejects.toBeInstanceOf(
      SignupUnderReviewError
    );
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
  });

  test("passes the server's error code and suggestion to the form", async () => {
    fetchWithTimeout.mockResolvedValue(
      jsonResponse(409, { error: "username_unavailable", suggestion: "person1" })
    );

    const error = await service.requestSignupVerificationCode(account).catch((e) => e);

    expect(error).toBeInstanceOf(NativeSignupError);
    expect(error).toMatchObject({ code: "username_unavailable", suggestion: "person1" });
  });

  test("reads a bare 403 as signup being unavailable", async () => {
    fetchWithTimeout.mockResolvedValue(jsonResponse(403, { message: "Signup is disabled" }));

    await expect(service.requestSignupVerificationCode(account)).rejects.toMatchObject({
      code: "signup_unavailable",
    });
  });
});
