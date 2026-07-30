import { describe, expect, jest, test } from "@jest/globals";
import { useBookingListItemData } from "./useBookingListItemData";

jest.mock("@/utils/booking", () => ({
  getMeetingUrl: () => null,
}));

jest.mock("@/utils/bookings-utils", () => ({
  formatDate: () => "",
  formatTime: () => "",
  getHostAndAttendeesDisplay: () => null,
}));

jest.mock("@/utils/meetings-utils", () => ({
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
    const booking = createBooking({
      status: "requires_confirmation",
    });

    expect(useBookingListItemData(booking).isPending).toBe(true);
  });

  test("does not treat accepted requires-confirmation bookings as pending", async () => {
    const booking = createBooking({
      requiresConfirmation: true,
    });

    expect(useBookingListItemData(booking).isPending).toBe(false);
  });
});
