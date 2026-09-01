import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "./config.js";
import { isPreviewSmokeMode } from "./preview-smoke-mode.js";

describe("preview smoke mode", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("requires the exact switch and Vercel preview environment", () => {
    expect(
      isPreviewSmokeMode({ VERCEL_ENV: "preview", MCP_PREVIEW_SMOKE_MODE: "empty-deny" })
    ).toBe(true);
    expect(isPreviewSmokeMode({ VERCEL_ENV: "preview", MCP_PREVIEW_SMOKE_MODE: "invalid" })).toBe(
      false
    );
    expect(
      isPreviewSmokeMode({ VERCEL_ENV: "production", MCP_PREVIEW_SMOKE_MODE: "empty-deny" })
    ).toBe(false);
  });

  it("boots HTTP preview configuration without database or OAuth secrets", () => {
    vi.stubEnv("MCP_TRANSPORT", "http");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "personal-preview.vercel.app");
    vi.stubEnv("MCP_PREVIEW_SMOKE_MODE", "empty-deny");
    vi.stubEnv("CAL_OAUTH_CLIENT_ID", "");
    vi.stubEnv("CAL_OAUTH_CLIENT_SECRET", "");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("MCP_SERVER_URL", "");

    const config = loadConfig();

    expect(config).toMatchObject({
      transport: "http",
      serverUrl: "https://personal-preview.vercel.app",
    });
  });

  it("does not relax production HTTP configuration", () => {
    vi.stubEnv("MCP_TRANSPORT", "http");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("MCP_PREVIEW_SMOKE_MODE", "empty-deny");
    vi.stubEnv("CAL_OAUTH_CLIENT_ID", "");
    vi.stubEnv("CAL_OAUTH_CLIENT_SECRET", "");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("MCP_SERVER_URL", "");

    expect(() => loadConfig()).toThrow("Invalid HTTP mode configuration");
  });
});
