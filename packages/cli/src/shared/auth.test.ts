import * as net from "node:net";
import { describe, expect, it, vi } from "vitest";
import { getBrowserLaunchCommand, OAuthAuth } from "./auth";

const { getOAuth2Token } = vi.hoisted(() => ({
  getOAuth2Token: vi.fn(async () => ({
    data: {
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
    },
  })),
}));

vi.mock("../generated/sdk.gen", () => ({
  oAuth2ControllerToken: getOAuth2Token,
}));

vi.mock("./client", () => ({
  initializeClientWithoutAuth: vi.fn(async () => undefined),
}));

vi.mock("./config", () => ({
  getAppUrl: () => "https://app.cal.com",
  readConfig: () => ({}),
  writeConfig: vi.fn(),
}));

vi.mock("./output", () => ({
  renderError: vi.fn(),
  renderSuccess: vi.fn(),
}));

type OAuthAuthTestAccess = {
  buildAuthorizeUrl(clientId: string, redirectUri: string): string;
  handleOAuthCallback(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    expectedState: string
  ): {
    ready: Promise<void>;
    completion: Promise<void>;
  };
};

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Could not resolve test port"));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

describe("OAuthAuth", () => {
  it("opens OAuth URLs on Windows without cmd shell query parsing", () => {
    const url =
      "https://app.cal.com/auth/oauth2/authorize?client_id=client-id&redirect_uri=http%3A%2F%2Flocalhost%3A8019%2Fcallback&state=state";

    expect(getBrowserLaunchCommand(url, "win32")).toEqual({
      command: "rundll32",
      args: ["url.dll,FileProtocolHandler", url],
    });
  });

  it("generates a high-entropy OAuth state value", () => {
    const auth = new OAuthAuth();
    const authorizeUrl = (auth as unknown as OAuthAuthTestAccess).buildAuthorizeUrl(
      "client-id",
      "http://localhost:8019/callback"
    );
    const state = new URL(authorizeUrl).searchParams.get("state");

    expect(state).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });

  it("rejects callback requests when the OAuth state does not match", async () => {
    const port = await getAvailablePort();
    const auth = new OAuthAuth({ port });
    const callback = (auth as unknown as OAuthAuthTestAccess).handleOAuthCallback(
      "client-id",
      "client-secret",
      `http://localhost:${port}/callback`,
      "expected-state"
    );
    await callback.ready;
    const rejection = expect(callback.completion).rejects.toThrow("Invalid OAuth state");

    const response = await fetch(
      `http://127.0.0.1:${port}/callback?code=attacker-code&state=attacker-state`
    );
    await rejection;
    expect(response.status).toBe(400);
    expect(getOAuth2Token).not.toHaveBeenCalled();
  });
});
