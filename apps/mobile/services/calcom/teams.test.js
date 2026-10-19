import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockMakeRequest = jest.fn();
jest.mock("./request", () => ({
  // Avoids loading request.ts and its native networking.
  makeRequest: (...args) => mockMakeRequest(...args),
}));

const { getTeamMembers } = require("./teams");

const membership = (userId, accepted = true) => ({
  userId,
  accepted,
  user: { name: `User ${userId}`, email: `user${userId}@example.test` },
});

const page = (from, count) =>
  Array.from({ length: count }, (_, offset) => membership(from + offset));

describe("getTeamMembers", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
  });

  test("asks for one page when the team fits in it", async () => {
    mockMakeRequest.mockResolvedValueOnce({
      status: "success",
      data: [membership(1), membership(2, false)],
    });

    const members = await getTeamMembers(7);

    expect(mockMakeRequest).toHaveBeenCalledTimes(1);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/teams/7/memberships?take=250&skip=0",
      {},
      "2024-06-14"
    );
    expect(members).toEqual([
      {
        userId: 1,
        name: "User 1",
        username: null,
        email: "user1@example.test",
        avatarUrl: null,
      },
    ]);
  });

  test("pages through skip until a short page, so members past 250 can be hosts", async () => {
    mockMakeRequest
      .mockResolvedValueOnce({ status: "success", data: page(1, 250) })
      .mockResolvedValueOnce({ status: "success", data: page(251, 3) });

    const members = await getTeamMembers(7);

    expect(mockMakeRequest).toHaveBeenNthCalledWith(
      2,
      "/teams/7/memberships?take=250&skip=250",
      {},
      "2024-06-14"
    );
    expect(mockMakeRequest).toHaveBeenCalledTimes(2);
    expect(members).toHaveLength(253);
    expect(members.at(-1)?.userId).toBe(253);
  });

  test("stops when a full page brings nobody new instead of looping forever", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success", data: page(1, 250) });

    const members = await getTeamMembers(7);

    expect(mockMakeRequest).toHaveBeenCalledTimes(2);
    expect(members).toHaveLength(250);
  });
});
