import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { oauthConfig } from "../__tests__/helpers/fixtures";

// Mock node:fs before importing the module under test
vi.mock("node:fs");
vi.mock("node:os", () => ({
  homedir: () => "/home/user",
}));

// Mock the output module
vi.mock("./output", () => ({
  renderError: vi.fn(),
  renderSuccess: vi.fn(),
}));

// Mock the client module
vi.mock("./client", () => ({
  initializeClientWithoutAuth: vi.fn(),
}));

// Mock the generated SDK
vi.mock("../generated/sdk.gen", () => ({
  oAuth2ControllerToken: vi.fn(),
}));

import * as fs from "node:fs";
import { oAuth2ControllerToken } from "../generated/sdk.gen";
import { ApiKeyAuth, OAuthAuth } from "./auth";
import { renderSuccess } from "./output";

describe("auth", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("ApiKeyAuth", () => {
    describe("login", () => {
      it("saves provided API key", async () => {
        const auth = new ApiKeyAuth({ apiKey: "my-api-key" });

        await auth.login();

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
        expect(writeCall[0]).toBe("/home/user/.calcom/config.json");
        const writtenConfig = JSON.parse(writeCall[1] as string);
        expect(writtenConfig.apiKey).toBe("my-api-key");
        expect(renderSuccess).toHaveBeenCalledWith("Logged in successfully.");
      });

      it("clears existing OAuth config", async () => {
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(oauthConfig));

        const auth = new ApiKeyAuth({ apiKey: "my-api-key" });

        await auth.login();

        const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
        const writtenConfig = JSON.parse(writeCall[1] as string);
        expect(writtenConfig.oauth).toBeUndefined();
        expect(writtenConfig.apiKey).toBe("my-api-key");
      });

      it("sets custom apiUrl", async () => {
        const auth = new ApiKeyAuth({
          apiKey: "my-api-key",
          apiUrl: "https://custom.api.com",
        });

        await auth.login();

        const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
        const writtenConfig = JSON.parse(writeCall[1] as string);
        expect(writtenConfig.apiKey).toBe("my-api-key");
        expect(writtenConfig.apiUrl).toBe("https://custom.api.com");
      });

      // Note: Testing empty string without options requires mocking stdin
      // which is complex. The core functionality is tested in other cases.
    });
  });

  describe("OAuthAuth", () => {
    describe("refreshToken", () => {
      it("throws when no OAuth config exists", async () => {
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

        await expect(OAuthAuth.refreshToken()).rejects.toThrow(
          "No OAuth credentials found. Please run 'calcom login --oauth' first."
        );
      });

      it("refreshes token and saves new credentials", async () => {
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(oauthConfig));
        vi.mocked(oAuth2ControllerToken).mockResolvedValue({
          data: {
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
          },
        } as never);

        await OAuthAuth.refreshToken();

        expect(oAuth2ControllerToken).toHaveBeenCalledWith({
          body: {
            grant_type: "refresh_token",
            client_id: "test-client-id",
            client_secret: "test-client-secret",
            refresh_token: "test-refresh-token",
          },
        });

        const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
        const writtenConfig = JSON.parse(writeCall[1] as string);
        expect(writtenConfig.oauth.accessToken).toBe("new-access-token");
        expect(writtenConfig.oauth.refreshToken).toBe("new-refresh-token");
      });

      it("throws when token exchange fails", async () => {
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(oauthConfig));
        vi.mocked(oAuth2ControllerToken).mockResolvedValue({
          data: undefined,
        } as never);

        await expect(OAuthAuth.refreshToken()).rejects.toThrow(
          "Token refresh failed: no response"
        );
      });
    });
  });
});
