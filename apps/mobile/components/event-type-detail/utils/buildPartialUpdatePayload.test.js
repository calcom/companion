import { describe, expect, jest, test } from "@jest/globals";
import { buildPartialUpdatePayload, hasChanges } from "./buildPartialUpdatePayload";

jest.mock("@/utils/locationHelpers", () => ({
  mapItemToApiLocation: (item) => {
    if (item.type === "address") {
      return {
        type: "address",
        address: item.address || "",
        public: item.public ?? true,
      };
    }

    if (item.type === "integration") {
      return {
        type: "integration",
        integration: item.integration,
      };
    }

    return {
      type: item.type,
    };
  },
}));

function createOriginalEventType(overrides = {}) {
  return {
    id: 11,
    title: "Quick Chat",
    slug: "quick-chat",
    description: "A short introductory call",
    length: 30,
    lengthInMinutes: 30,
    locations: [],
    hidden: false,
    disableGuests: false,
    scheduleId: 100,
    beforeEventBuffer: 0,
    afterEventBuffer: 0,
    minimumBookingNotice: 60,
    onlyShowFirstAvailableSlot: false,
    requiresConfirmation: false,
    requiresBookerEmailVerification: false,
    hideCalendarNotes: false,
    hideCalendarEventDetails: false,
    hideOrganizerEmail: false,
    lockTimeZoneToggleOnBookingPage: false,
    allowReschedulingPastBookings: false,
    allowReschedulingCancelledBookings: false,
    forwardParamsSuccessRedirect: false,
    disableCancelling: { disabled: false },
    disableRescheduling: { disabled: false },
    calVideoSettings: { sendTranscriptionEmails: false },
    showOptimizedSlots: false,
    metadata: {},
    ...overrides,
  };
}

function createFormState(overrides = {}) {
  return {
    eventTitle: "Quick Chat",
    eventSlug: "quick-chat",
    eventDescription: "A short introductory call",
    eventDuration: "30",
    isHidden: false,
    locations: [],
    disableGuests: false,
    allowMultipleDurations: false,
    selectedDurations: [],
    defaultDuration: "",
    selectedScheduleId: 100,
    beforeEventBuffer: "No buffer time",
    afterEventBuffer: "No buffer time",
    minimumNoticeValue: "1",
    minimumNoticeUnit: "Hours",
    slotInterval: "Default",
    limitBookingFrequency: false,
    frequencyLimits: [],
    limitTotalDuration: false,
    durationLimits: [],
    onlyShowFirstAvailableSlot: false,
    maxActiveBookingsPerBooker: false,
    maxActiveBookingsValue: "1",
    offerReschedule: false,
    limitFutureBookings: false,
    futureBookingType: "rolling",
    rollingDays: "30",
    rollingCalendarDays: true,
    rangeStartDate: "2026-07-01",
    rangeEndDate: "2026-07-31",
    requiresConfirmation: false,
    requiresBookerEmailVerification: false,
    hideCalendarNotes: false,
    hideCalendarEventDetails: false,
    hideOrganizerEmail: false,
    lockTimezone: false,
    allowReschedulingPastEvents: false,
    allowBookingThroughRescheduleLink: false,
    successRedirectUrl: "",
    forwardParamsSuccessRedirect: false,
    customReplyToEmail: "",
    eventTypeColorLight: "#292929",
    eventTypeColorDark: "#FAFAFA",
    calendarEventName: "",
    addToCalendarEmail: "",
    selectedLayouts: [],
    defaultLayout: "month",
    disableCancelling: false,
    disableRescheduling: false,
    sendCalVideoTranscription: false,
    interfaceLanguage: "",
    showOptimizedSlots: false,
    seatsEnabled: false,
    seatsPerTimeSlot: "2",
    showAttendeeInfo: false,
    showAvailabilityCount: false,
    recurringEnabled: false,
    recurringInterval: "1",
    recurringFrequency: "weekly",
    recurringOccurrences: "12",
    ...overrides,
  };
}

function buildPayload(formOverrides = {}, originalOverrides = {}) {
  return buildPartialUpdatePayload(
    createFormState(formOverrides),
    createOriginalEventType(originalOverrides)
  );
}

describe("buildPartialUpdatePayload", () => {
  test("returns an empty payload when the edit form matches the original event type", () => {
    const formState = createFormState();
    const original = createOriginalEventType();

    expect(buildPartialUpdatePayload(formState, original)).toEqual({});
    expect(hasChanges(formState, original)).toBe(false);
  });

  test("includes only changed basic fields and schedule id", () => {
    expect(
      buildPayload({
        eventTitle: "Deep Dive",
        eventSlug: "deep-dive",
        eventDescription: "",
        isHidden: true,
        disableGuests: true,
        selectedScheduleId: 200,
      })
    ).toEqual({
      title: "Deep Dive",
      slug: "deep-dive",
      description: "",
      hidden: true,
      disableGuests: true,
      scheduleId: 200,
    });
  });

  test("builds the API payload for multiple duration event types", () => {
    expect(
      buildPayload({
        allowMultipleDurations: true,
        selectedDurations: ["15 mins", "30 mins", "45 mins"],
        defaultDuration: "30 mins",
      })
    ).toEqual({
      lengthInMinutes: 30,
      lengthInMinutesOptions: [15, 30, 45],
    });
  });

  test("maps changed UI locations to API locations", () => {
    expect(
      buildPayload({
        locations: [
          {
            id: "location-1",
            type: "address",
            address: "1 Main St",
            public: false,
            displayName: "In Person",
            iconUrl: null,
          },
          {
            id: "location-2",
            type: "integration",
            integration: "google-meet",
            displayName: "Google Meet",
            iconUrl: null,
          },
        ],
      })
    ).toEqual({
      locations: [
        {
          type: "address",
          address: "1 Main St",
          public: false,
        },
        {
          type: "integration",
          integration: "google-meet",
        },
      ],
    });
  });

  test("uses API v2 objects for confirmation, cancellation, and Cal Video settings", () => {
    expect(
      buildPayload({
        requiresConfirmation: true,
        disableCancelling: true,
        disableRescheduling: true,
        sendCalVideoTranscription: true,
        interfaceLanguage: "en",
        showOptimizedSlots: true,
      })
    ).toEqual({
      confirmationPolicy: { type: "always" },
      disableCancelling: { disabled: true },
      disableRescheduling: { disabled: true },
      calVideoSettings: { sendTranscriptionEmails: true },
      interfaceLanguage: "en",
      showOptimizedSlots: true,
    });
  });

  test("uses API v2 customName when the calendar event name is cleared", () => {
    expect(
      buildPayload(
        {
          calendarEventName: "",
        },
        {
          customName: "Quick Chat",
        }
      )
    ).toEqual({
      customName: "",
    });
  });

  test("falls back to legacy metadata when comparing the original calendar event name", () => {
    expect(
      buildPayload(
        {
          calendarEventName: "Updated event name",
        },
        {
          metadata: {
            calendarEventName: "Quick Chat",
          },
        }
      )
    ).toEqual({
      customName: "Updated event name",
    });
  });

  test("does not emit unsupported add-to-calendar metadata changes", () => {
    expect(
      buildPayload(
        {
          addToCalendarEmail: "",
        },
        {
          metadata: {
            addToCalendarEmail: "owner@example.com",
          },
        }
      )
    ).toEqual({});
  });

  test("emits disabled objects when advanced limits are turned off", () => {
    expect(
      buildPayload(
        {},
        {
          bookingLimitsCount: { day: 2 },
          bookingLimitsDuration: { week: 120 },
          bookerActiveBookingsLimit: {
            maximumActiveBookings: 3,
            offerReschedule: true,
          },
          bookingWindow: { type: "calendarDays", value: 30 },
          recurrence: { interval: 1, frequency: "weekly", occurrences: 4 },
          seats: {
            seatsPerTimeSlot: 5,
            showAttendeeInfo: true,
            showAvailabilityCount: true,
          },
        }
      )
    ).toEqual({
      bookingLimitsCount: { disabled: true },
      bookingLimitsDuration: { disabled: true },
      bookerActiveBookingsLimit: { disabled: true },
      bookingWindow: { disabled: true },
      recurrence: { disabled: true },
      seats: { disabled: true },
    });
  });
});
