import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/cache.config";

// The API client is the test boundary: each test decides when a call answers.
const mockCheckIn = jest.fn();
const mockUndo = jest.fn();
const mockCheckInByTicket = jest.fn();
jest.mock("@/services/calcom", () => ({
  CalComAPIService: {
    checkInCalEventGuest: (...args) => mockCheckIn(...args),
    undoCalEventGuestCheckIn: (...args) => mockUndo(...args),
    checkInCalEventGuestByTicket: (...args) => mockCheckInByTicket(...args),
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

const { act, renderHook } = require("@testing-library/react-native");
const {
  checkInCalEventGuestByTicketMutationOptions,
  checkInCalEventGuestMutationOptions,
  isCalEventGuestPending,
  refetchCalEventGuestsIfIdle,
  undoCalEventGuestCheckInMutationOptions,
  useCalEventCheckInAvailability,
} = require("./useCalEventGuests");
const { getCalEventCheckInProgress } = require("@/utils/cal-events");

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
  queryClient.setQueryData(queryKeys.calEvents.guests(UUID), { guests });
  const checkedInAt = (guestId) =>
    queryClient
      .getQueryData(queryKeys.calEvents.guests(UUID))
      .guests.find((guest) => guest.id === guestId).checkedInAt;
  return { queryClient, checkedInAt };
}

function createGuest(id, checkedInAt = null) {
  return { id, name: `Guest ${id}`, email: `${id}@example.com`, phoneNumber: null, checkedInAt };
}

describe("refetchCalEventGuestsIfIdle", () => {
  test("invalidates the guest list when no guest mutation is pending", () => {
    const { queryClient } = setup([]);
    const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");

    refetchCalEventGuestsIfIdle(queryClient, UUID);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.calEvents.guests(UUID),
    });
  });

  test("does not invalidate the guest list while a guest mutation is pending", async () => {
    const { queryClient } = setup([createGuest("a")]);
    const answer = deferred();
    mockCheckIn.mockReturnValue(answer.promise);
    const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");
    const tap = new MutationObserver(
      queryClient,
      checkInCalEventGuestMutationOptions(queryClient, UUID)
    ).mutate("a");
    await flush();
    invalidateQueries.mockClear();

    refetchCalEventGuestsIfIdle(queryClient, UUID);

    expect(invalidateQueries).not.toHaveBeenCalled();

    answer.resolve({ kind: "checked_in" });
    await tap;
  });
});

beforeEach(() => {
  mockCheckIn.mockReset();
  mockUndo.mockReset();
  mockCheckInByTicket.mockReset();
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

  test("checks in and undoes a guest past the API's first page of 250", async () => {
    const guests = Array.from({ length: 300 }, (_, n) => createGuest(`g${n}`));
    const { queryClient, checkedInAt } = setup(guests);
    mockCheckIn.mockResolvedValue({ kind: "checked_in", checkedInAt: EARLIER });
    mockUndo.mockResolvedValue(undefined);
    const guestList = () => queryClient.getQueryData(queryKeys.calEvents.guests(UUID));

    await new MutationObserver(
      queryClient,
      checkInCalEventGuestMutationOptions(queryClient, UUID)
    ).mutate("g299");
    expect(checkedInAt("g299")).toBe(EARLIER);
    expect(getCalEventCheckInProgress(guestList())).toBe("1 of 300 checked in");

    await new MutationObserver(
      queryClient,
      undoCalEventGuestCheckInMutationOptions(queryClient, UUID)
    ).mutate("g299");
    expect(checkedInAt("g299")).toBeNull();
    expect(getCalEventCheckInProgress(guestList())).toBe("0 of 300 checked in");
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

describe("checking a guest in from a ticket", () => {
  const scan = (queryClient, token) =>
    new MutationObserver(
      queryClient,
      checkInCalEventGuestByTicketMutationOptions(queryClient, UUID)
    ).mutate(token);

  test("checks in the guest the server names, at the server's time", async () => {
    const { queryClient, checkedInAt } = setup([createGuest("a"), createGuest("b")]);
    mockCheckInByTicket.mockResolvedValue({
      kind: "checked_in",
      guest: createGuest("b", EARLIER),
    });

    await scan(queryClient, "ticket-b");

    expect(mockCheckInByTicket).toHaveBeenCalledWith(UUID, "ticket-b");
    expect(checkedInAt("a")).toBeNull();
    expect(checkedInAt("b")).toBe(EARLIER);
  });

  test("shows the first check-in's time for a ticket used before", async () => {
    const { queryClient, checkedInAt } = setup([createGuest("a")]);
    mockCheckInByTicket.mockResolvedValue({
      kind: "already_checked_in",
      guest: createGuest("a", EARLIER),
      checkedInAt: EARLIER,
    });

    await scan(queryClient, "ticket-a");

    expect(checkedInAt("a")).toBe(EARLIER);
  });

  test("holds no guest's row while in flight, even when the token matches a guest id", async () => {
    const { queryClient } = setup([createGuest("a")]);
    const answer = deferred();
    mockCheckInByTicket.mockReturnValue(answer.promise);

    const scanning = scan(queryClient, "a");
    await flush();

    expect(isCalEventGuestPending(queryClient, UUID, "a")).toBe(false);

    answer.resolve({ kind: "not_confirmed" });
    await scanning;
  });

  test("refetches the list only once the last of a scan and a tap settles", async () => {
    const { queryClient } = setup([createGuest("a"), createGuest("b")]);
    const tapAnswer = deferred();
    mockCheckIn.mockReturnValue(tapAnswer.promise);
    const scanAnswer = deferred();
    mockCheckInByTicket.mockReturnValue(scanAnswer.promise);
    const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");

    const tap = new MutationObserver(
      queryClient,
      checkInCalEventGuestMutationOptions(queryClient, UUID)
    ).mutate("a");
    const scanning = scan(queryClient, "ticket-b");
    await flush();

    scanAnswer.resolve({ kind: "checked_in", guest: createGuest("b", EARLIER) });
    await scanning;
    expect(invalidateQueries).not.toHaveBeenCalled();

    tapAnswer.resolve({ kind: "checked_in" });
    await tap;
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.calEvents.guests(UUID),
    });
  });
});

describe("useCalEventCheckInAvailability", () => {
  const T0 = new Date("2026-10-13T10:00:00.000Z").getTime();
  const HOUR = 60 * 60 * 1000;
  // The door takes check-ins from 12 h before the start until 12 h after the end.
  const eventAt = (startOffset, endOffset) => ({
    startTime: new Date(T0 + startOffset).toISOString(),
    endTime: new Date(T0 + endOffset).toISOString(),
  });
  // The hook's own timers wait for a window boundary; React's and the test renderer's are short.
  const windowTimers = (setTimeoutSpy) =>
    setTimeoutSpy.mock.calls.filter(([, delay]) => delay >= 60 * 1000);
  const render = (event) =>
    renderHook((props) => useCalEventCheckInAvailability(props.event), {
      initialProps: { event },
    });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(T0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("closes when the window does, then stops ticking", async () => {
    // Ends an hour from now, so check-in closes 13 h from now.
    const { result } = await render(eventAt(-HOUR, HOUR));
    expect(result.current.kind).toBe("open");

    await act(() => jest.advanceTimersByTime(13 * HOUR + 1));
    expect(result.current.kind).toBe("closed");

    const setTimeoutSpy = jest.spyOn(global, "setTimeout");
    await act(() => jest.advanceTimersByTime(48 * HOUR));
    expect(result.current.kind).toBe("closed");
    expect(windowTimers(setTimeoutSpy)).toHaveLength(0);
  });

  test("reads a rescheduled event against the current time, not the last tick", async () => {
    const { result, rerender } = await render(eventAt(HOUR, 3 * HOUR));
    expect(result.current.kind).toBe("open");

    // Two hours pass with no tick, then a refetch brings the event moved into the past: its window
    // closed an hour ago, though it was still open at the last tick.
    jest.setSystemTime(T0 + 2 * HOUR);
    const setTimeoutSpy = jest.spyOn(global, "setTimeout");
    await rerender({ event: eventAt(-13 * HOUR, -11 * HOUR) });

    expect(result.current).toEqual({
      kind: "closed",
      closedAt: new Date(T0 + HOUR).toISOString(),
    });
    expect(windowTimers(setTimeoutSpy)).toHaveLength(0);
  });
});
