import { freshAccessToken } from "./fresh-access-token";

describe("freshAccessToken", () => {
  const tokens = { accessToken: "current", refreshToken: "refresh", expiresAt: 1000 };
  const refresh = jest.fn();

  beforeEach(() => {
    refresh.mockReset();
    refresh.mockResolvedValue({ accessToken: "renewed" });
  });

  it("keeps a token that is still valid, without refreshing", async () => {
    await expect(freshAccessToken({ tokens, isExpired: () => false, refresh })).resolves.toBe(
      "current"
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes a token that is expired or about to be, and returns the new one", async () => {
    await expect(freshAccessToken({ tokens, isExpired: () => true, refresh })).resolves.toBe(
      "renewed"
    );
    expect(refresh).toHaveBeenCalledWith("refresh");
  });

  it("has no token for a guest", async () => {
    await expect(freshAccessToken({ tokens: null, isExpired: () => true, refresh })).resolves.toBe(
      null
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("joins as a guest when there is nothing to refresh with", async () => {
    await expect(
      freshAccessToken({
        tokens: { accessToken: "current" },
        isExpired: () => true,
        refresh,
      })
    ).resolves.toBe(null);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("joins as a guest when the refresh fails", async () => {
    refresh.mockRejectedValue(new Error("offline"));
    await expect(freshAccessToken({ tokens, isExpired: () => true, refresh })).resolves.toBe(null);
  });
});
