import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProcessExitError,
  mockConsoleError,
  mockProcessExit,
} from "../__tests__/helpers";
import {
  expiredOauthConfig,
  oauthConfig,
  tokenRefreshResponse,
  validConfig,
} from "../__tests__/helpers/fixtures";

// Mock node:fs before importing the module under test
vi.mock("node:fs");
vi.mock("node:os", () => ({
  homedir: () => "/home/user",
}));

// Import mocked fs for test setup
import * as fs from "node:fs";

// Import module under test after mocks are set up
import { getApiUrl, getAppUrl, getAuthToken, readConfig, writeConfig } from "./config";

describe("config", () => {
  let exitSpy: ReturnType<typeof mockProcessExit>;
  let consoleErrorSpy: ReturnType<typeof mockConsoleError>;

  beforeEach(() => {
    exitSpy = mockProcessExit();
    consoleErrorSpy = mockConsoleError();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  describe("readConfig", () => {
    it("returns empty object when config file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = readConfig();

      expect(config).toEqual({});
    });

    it("parses valid JSON config", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const config = readConfig();

      expect(config).toEqual(validConfig);
    });

    it("returns empty object on JSON parse error", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("invalid json {{{");

      const config = readConfig();

      expect(config).toEqual({});
    });

    it("returns empty object when file read throws", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("Read error");
      });

      const config = readConfig();

      expect(config).toEqual({});
    });
  });

  describe("writeConfig", () => {
    it("writes config with mode 0o600", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      writeConfig(validConfig);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "/home/user/.calcom/config.json",
        JSON.stringify(validConfig, null, 2),
        { encoding: "utf-8", mode: 0o600 }
      );
    });

    it("creates config directory if missing", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      writeConfig(validConfig);

      expect(fs.mkdirSync).toHaveBeenCalledWith("/home/user/.calcom", {
        recursive: true,
      });
    });
  });

  describe("getApiUrl", () => {
    it("returns env var CAL_API_URL first", () => {
      vi.stubEnv("CAL_API_URL", "https://custom.api.com");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ apiUrl: "https://config.api.com" })
      );

      const url = getApiUrl();

      expect(url).toBe("https://custom.api.com");
    });

    it("falls back to config.apiUrl", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ apiUrl: "https://config.api.com" })
      );

      const url = getApiUrl();

      expect(url).toBe("https://config.api.com");
    });

    it("returns default https://api.cal.com when no config or env", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const url = getApiUrl();

      expect(url).toBe("https://api.cal.com");
    });
  });

  describe("getAppUrl", () => {
    it("returns env var CAL_APP_URL first", () => {
      vi.stubEnv("CAL_APP_URL", "https://custom.app.com");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ appUrl: "https://config.app.com" })
      );

      const url = getAppUrl();

      expect(url).toBe("https://custom.app.com");
    });

    it("falls back to config.appUrl", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ appUrl: "https://config.app.com" })
      );

      const url = getAppUrl();

      expect(url).toBe("https://config.app.com");
    });

    it("returns default https://app.cal.com when no config or env", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const url = getAppUrl();

      expect(url).toBe("https://app.cal.com");
    });
  });

  describe("getAuthToken", () => {
    it("returns CAL_API_KEY from env", async () => {
      vi.stubEnv("CAL_API_KEY", "env-api-key");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const token = await getAuthToken();

      expect(token).toBe("env-api-key");
    });

    it("returns OAuth token when valid", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(oauthConfig));

      const token = await getAuthToken();

      expect(token).toBe("test-access-token");
    });

    it("refreshes expired OAuth token", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(expiredOauthConfig)
      );

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(tokenRefreshResponse),
      });
      vi.stubGlobal("fetch", mockFetch);

      const token = await getAuthToken();

      expect(token).toBe("new-access-token");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cal.com/v2/auth/oauth2/token",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("falls back to apiKey when no OAuth", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const token = await getAuthToken();

      expect(token).toBe("cal_test_api_key_123");
    });

    it("exits with error when no auth configured", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      await expect(getAuthToken()).rejects.toThrow(ProcessExitError);
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("exits with error when token refresh fails", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(expiredOauthConfig)
      );

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Invalid refresh token"),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(getAuthToken()).rejects.toThrow(ProcessExitError);
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
