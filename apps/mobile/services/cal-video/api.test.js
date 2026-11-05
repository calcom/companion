import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockFetch = jest.fn();
jest.mock("@/utils/network", () => ({ fetchWithTimeout: (...args) => mockFetch(...args) }));

const { knockRoom, knockStatus } = require("./api");

const room = { origin: "https://cal.video", slug: "room" };
const reply = (body, status = 200) => ({ status, ok: status < 400, json: async () => body });

describe("the knock", () => {
  beforeEach(() => mockFetch.mockReset());

  test("waits on the server's answer alone: the cookie identifies the knock, not the body", async () => {
    mockFetch.mockResolvedValue(reply({ outcome: "waiting", expiresInSeconds: 120 }));

    await expect(knockRoom(room, "Guest")).resolves.toEqual({
      outcome: "waiting",
      expiresInSeconds: 120,
    });
  });

  test("goes straight in when the host has already admitted this person", async () => {
    mockFetch.mockResolvedValue(reply({ outcome: "admitted" }));

    await expect(knockRoom(room, "Guest")).resolves.toEqual({ outcome: "admitted" });
  });

  test("polls without sending anything but the cookie", async () => {
    mockFetch.mockResolvedValue(reply({ state: "admitted" }));

    await expect(knockStatus(room)).resolves.toEqual({ state: "admitted" });
    expect(mockFetch.mock.calls[0][1].body).toBeUndefined();
  });
});
