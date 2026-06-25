import { describe, expect, mock, test } from "bun:test";

mock.module("@/utils/booking", () => ({
  getMeetingUrl: () => null,
}));

mock.module("@/utils/bookings-utils", () => ({
  formatDate: () => "",
  formatTime: () => "",
  getHostAndAttendeesDisplay: () => null,
}));

mock.module("@/utils/meetings-utils", () => ({
  getMeetingInfo: () => null,
}));

function createBooking(overrides = {}) {
  return {
    id: 1,
    uid: "booking-1",
    title: "Demo booking",
    status: "accepted",
    startTime: "2026-06-12T10:00:00.000Z",
    endTime: "2026-06-12T10:30:00.000Z",
    attendees: [],
    ...overrides,
  };
}

describe("useBookingListItemData", () => {
  test("treats requires_confirmation status as pending for booking request UI", async () => {
    const { useBookingListItemData } = await import("./useBookingListItemData");
    const booking = createBooking({
      status: "requires_confirmation",
    });

    expect(useBookingListItemData(booking).isPending).toBe(true);
  });

  test("does not treat accepted requires-confirmation bookings as pending", async () => {
    const { useBookingListItemData } = await import("./useBookingListItemData");
    const booking = createBooking({
      requiresConfirmation: true,
    });

    expect(useBookingListItemData(booking).isPending).toBe(false);
  });
});
