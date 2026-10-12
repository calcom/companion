import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/cache.config";

// The API client is the test boundary: each test decides when a call answers.
const mockCheckIn = jest.fn();
const mockUndo = jest.fn();
jest.mock("@/services/calcom", () => ({
  CalComAPIService: {
    checkInCalEventGuest: (...args) => mockCheckIn(...args),
    undoCalEventGuestCheckIn: (...args) => mockUndo(...args),
  },
}));
// Same exports as services/calcom/cal-events.test.js mocks: bun shares module mocks across files.
jest.mock("@/services/calcom/request", () => ({
  ApiRequestError: class ApiRequestError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  },
  makeRequest: () => Promise.reject(new Error("not under test")),
}));
jest.mock("@/utils/region", () => ({
  getCalAppUrl: () => "https://app.example.test",
  getCalWebUrl: () => "https://example.test",
}));

const {
  checkInCalEventGuestMutationOptions,
  isCalEventGuestPending,
  undoCalEventGuestCheckInMutationOptions,
} = require("./useCalEventGuests");

const UUID = "event-uuid";
const EARLIER = "2026-10-12T10:05:00.000Z";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Lets the optimistic update (behind an awaited cancelQueries) land.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(guests) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.calEvents.guests(UUID), { guests, hasMore: false });
  const checkedInAt = (guestId) =>
    queryClient
      .getQueryData(queryKeys.calEvents.guests(UUID))
      .guests.find((guest) => guest.id === guestId).checkedInAt;
  return { queryClient, checkedInAt };
}

function createGuest(id, checkedInAt = null) {
  return { id, name: `Guest ${id}`, email: `${id}@example.com`, phoneNumber: null, checkedInAt };
}

beforeEach(() => {
  mockCheckIn.mockReset();
  mockUndo.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "debug").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("checking a guest in", () => {
  test("checks the guest in at once, and holds their row until the API answers", async () => {
    const { queryClient, checkedInAt } = setup([createGuest("a"), createGuest("b")]);
    const answer = deferred();
    mockCheckIn.mockReturnValue(answer.promise);
    // One observer per screen, like useMutation; each tap is its own call.
    const observer = new MutationObserver(
      queryClient,
      checkInCalEventGuestMutationOptions(queryClient, UUID)
    );

    const tap = observer.mutate("a");
    await flush();

    expect(mockCheckIn).toHaveBeenCalledWith(UUID, "a");
    expect(checkedInAt("a")).toEqual(expect.any(String));
    expect(isCalEventGuestPending(queryClient, UUID, "a")).toBe(true);
    expect(isCalEventGuestPending(queryClient, UUID, "b")).toBe(false);

    answer.resolve({ kind: "checked_in" });
    await expect(tap).resolves.toEqual({ kind: "checked_in" });
    expect(checkedInAt("a")).toEqual(expect.any(String));
    expect(isCalEventGuestPending(queryClient, UUID, "a")).toBe(false);
  });

  test("uses the server's check-in time instead of the optimistic time", async () => {
    const { queryClient, checkedInAt } = setup([createGuest("a")]);
    const answer = deferred();
    mockCheckIn.mockReturnValue(answer.promise);
    const observer = new MutationObserver(
      queryClient,
      checkInCalEventGuestMutationOptions(queryClient, UUID)
    );

    const tap = observer.mutate("a");
    await flush();
    const optimisticTime = checkedInAt("a");

    answer.resolve({ kind: "checked_in", checkedInAt: EARLIER });
    await expect(tap).resolves.toEqual({ kind: "checked_in", checkedInAt: EARLIER });

    expect(checkedInAt("a")).toBe(EARLIER);
    expect(checkedInAt("a")).not.toBe(optimisticTime);
  });

  test("puts back only the guest whose check-in failed, and answers each tap on its own", async () => {
    const { queryClient, checkedInAt } = setup([createGuest("a"), createGuest("b")]);
    const answers = { a: deferred(), b: deferred() };
    mockCheckIn.mockImplementation((_uuid, guestId) => answers[guestId].promise);
    const observer = new MutationObserver(
      queryClient,
      checkInCalEventGuestMutationOptions(queryClient, UUID)
    );

    const first = observer.mutate("a");
    const second = observer.mutate("b");
    await flush();
    const closed = new Error("Check-in is closed outside the event window");
    answers.a.reject(closed);

    // The earlier tap still hears about its own failure while the later one is in flight.
    await expect(first).rejects.toBe(closed);
    expect(checkedInAt("a")).toBeNull();
    expect(checkedInAt("b")).toEqual(expect.any(String));

    answers.b.resolve({ kind: "checked_in" });
    await expect(second).resolves.toEqual({ kind: "checked_in" });
    expect(checkedInAt("b")).toEqual(expect.any(String));
  });

  test("shows another host's earlier check-in time", async () => {
    const { queryClient, checkedInAt } = setup([createGuest("a")]);
    mockCheckIn.mockResolvedValue({ kind: "already_checked_in", checkedInAt: EARLIER });

    await new MutationObserver(
      queryClient,
      checkInCalEventGuestMutationOptions(queryClient, UUID)
    ).mutate("a");

    expect(checkedInAt("a")).toBe(EARLIER);
  });

  test("leaves a guest who is no longer confirmed unchecked", async () => {
    const { queryClient, checkedInAt } = setup([createGuest("a")]);
    mockCheckIn.mockResolvedValue({ kind: "not_confirmed" });

    await new MutationObserver(
      queryClient,
      checkInCalEventGuestMutationOptions(queryClient, UUID)
    ).mutate("a");

    expect(checkedInAt("a")).toBeNull();
  });
});

describe("undoing a check-in", () => {
  test("unchecks the guest at once, holds their row, and puts the check-in back on failure", async () => {
    const { queryClient, checkedInAt } = setup([createGuest("a", EARLIER)]);
    const answer = deferred();
    mockUndo.mockReturnValue(answer.promise);
    const observer = new MutationObserver(
      queryClient,
      undoCalEventGuestCheckInMutationOptions(queryClient, UUID)
    );

    const tap = observer.mutate("a");
    await flush();

    expect(mockUndo).toHaveBeenCalledWith(UUID, "a");
    expect(checkedInAt("a")).toBeNull();
    // Check-in and undo share the in-flight lookup, so a check-in tap now waits too.
    expect(isCalEventGuestPending(queryClient, UUID, "a")).toBe(true);

    const failure = new Error("Network request failed");
    answer.reject(failure);
    await expect(tap).rejects.toBe(failure);
    expect(checkedInAt("a")).toBe(EARLIER);
    expect(isCalEventGuestPending(queryClient, UUID, "a")).toBe(false);
  });
});
