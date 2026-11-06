import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  clearAuth,
  clearAuthCallbacks,
  getAuthConfig,
  refreshAuthTokensSingleFlight,
  setAccessToken,
  setRefreshTokenFunction,
  setTokenRefreshCallback,
} from "@/services/calcom/auth";
import { freshAccessToken } from "./fresh-access-token";

// The real single-flight refresh and in-memory auth; only the network and storage are faked.
const STORED = JSON.stringify({ accessToken: "stored", refreshToken: "stored-refresh" });
const refreshNetwork = jest.fn();

function fresh({ expired = true, readStoredTokens = async () => STORED } = {}) {
  return freshAccessToken({
    readStoredTokens,
    currentAuth: getAuthConfig,
    isExpired: () => expired,
    refresh: refreshAuthTokensSingleFlight,
  });
}

describe("freshAccessToken", () => {
  beforeEach(() => {
    clearAuth();
    refreshNetwork.mockReset();
    refreshNetwork.mockResolvedValue({ accessToken: "renewed", refreshToken: "next-refresh" });
    setRefreshTokenFunction(refreshNetwork);
    setTokenRefreshCallback(async () => undefined);
    setAccessToken("current", "refresh");
  });

  afterEach(() => {
    jest.useRealTimers();
    clearAuthCallbacks();
  });

  test("keeps a token that is still valid, without refreshing", async () => {
    await expect(fresh({ expired: false })).resolves.toBe("current");
    expect(refreshNetwork).not.toHaveBeenCalled();
  });

  test("refreshes a token that is expiring and returns the new one", async () => {
    await expect(fresh()).resolves.toBe("renewed");
    expect(refreshNetwork).toHaveBeenCalledWith("refresh");
  });

  test("has no token for a signed-out guest", async () => {
    clearAuth();
    await expect(fresh({ readStoredTokens: async () => null })).resolves.toBe(null);
    expect(refreshNetwork).not.toHaveBeenCalled();
  });

  test("keeps the current token when the refresh fails, since it usually still works", async () => {
    refreshNetwork.mockRejectedValue(new Error("offline"));
    await expect(fresh()).resolves.toBe("current");
  });

  test("keeps the current token when there is nothing to refresh with", async () => {
    setAccessToken("current");
    getAuthConfig().refreshToken = undefined;
    await expect(fresh()).resolves.toBe("current");
    expect(refreshNetwork).not.toHaveBeenCalled();
  });

  test("keeps the current token for a session with no stored OAuth tokens", async () => {
    await expect(fresh({ readStoredTokens: async () => null })).resolves.toBe("current");
    expect(refreshNetwork).not.toHaveBeenCalled();
  });

  test("uses the refresh token in memory when one rotated during the storage read", async () => {
    const rotating = async () => {
      setAccessToken("rotated", "rotated-refresh");
      return STORED;
    };
    await expect(fresh({ readStoredTokens: rotating })).resolves.toBe("renewed");
    expect(refreshNetwork).toHaveBeenCalledWith("rotated-refresh");
  });

  test("shares one network refresh with a refresh already in flight", async () => {
    const results = await Promise.all([fresh(), refreshAuthTokensSingleFlight("refresh")]);
    expect(results[0]).toBe("renewed");
    expect(refreshNetwork).toHaveBeenCalledTimes(1);
  });

  test("stops waiting after 5 seconds and sends the current token", async () => {
    jest.useFakeTimers();
    refreshNetwork.mockReturnValue(new Promise(() => undefined));
    const token = fresh();
    await jest.advanceTimersByTimeAsync(4_999);
    let settled = false;
    token.then(() => {
      settled = true;
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(token).resolves.toBe("current");
  });

  test("sends no token when the user logs out during the refresh", async () => {
    refreshNetwork.mockImplementation(async () => {
      clearAuth();
      return { accessToken: "renewed" };
    });
    await expect(fresh()).resolves.toBe(null);
  });
});
