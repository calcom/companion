import { describe, expect, jest, test } from "@jest/globals";

// cal-events.ts reads the region, which loads React Native storage.
jest.mock("@/utils/region", () => ({
  getCalAppUrl: () => "https://app.example.test",
  getCalWebUrl: () => "https://example.test",
}));

const {
  buildAddCalEventLocationInput,
  buildCalEventUpdateInput,
  buildEditFormValues,
  canEditCalEvent,
  describeCalEventLocation,
  formatWallDateTime,
  getAddCalEventLocationError,
  getEditCalEventErrors,
  getRegistrationFieldsError,
  moveItem,
  slugForRegistrationField,
} = require("./cal-event-edit");
const { formatCalEventPrice } = require("./cal-events");

const NOW = new Date("2026-10-19T12:00:00Z");

function event(overrides = {}) {
  return {
    uuid: "e1",
    slug: "rooftop-meetup-2",
    title: "Rooftop meetup 2",
    description: "Drinks on the roof",
    startTime: "2026-11-01T18:00:00.000Z",
    endTime: "2026-11-01T20:00:00.000Z",
    timeZone: "Europe/London",
    visibility: "PUBLIC",
    hidden: false,
    publishedAt: null,
    cancelledAt: null,
    locations: [{ id: "l1", type: "address", address: "Calle Mayor 1, Madrid" }],
    coverImageUrl: null,
    requiresApproval: false,
    waitlistEnabled: false,
    hosts: [{ userId: 1, name: "Owner 1", avatarUrl: "" }],
    capacity: null,
    price: null,
    currency: null,
    cancellationReason: null,
    userId: 1,
    teamId: null,
    status: "draft",
    locationAddress: "Calle Mayor 1, Madrid",
    publicUrl: "https://example.test/rooftop-meetup-2",
    category: "meetup",
    theme: null,
    background: null,
    liveStreams: [],
    lineup: null,
    schedule: [],
    registrationFields: [
      { field: "name", variant: "fullName", label: "Your name" },
      { field: "email", label: "Email", required: true, hidden: false },
    ],
    guestList: "names",
    showOrganizerEmail: false,
    showPresentedBy: false,
    paymentTimeoutMinutes: null,
    ...overrides,
  };
}

describe("buildEditFormValues", () => {
  test("shows the times as the event's own wall clock", () => {
    const values = buildEditFormValues(event());
    expect(values.startWallTime).toBe("2026-11-01T18:00");
    expect(values.endWallTime).toBe("2026-11-01T20:00");
    expect(values.timeZone).toBe("Europe/London");
  });

  test("maps the API's nulls to empty fields", () => {
    const values = buildEditFormValues(event({ description: null }));
    expect(values.description).toBe("");
    expect(values.capacityEnabled).toBe(false);
    expect(values.paymentTimeoutMinutes).toBe("");
    expect(values.lineupPeople).toEqual([]);
  });

  test("keeps schedule times in the event's zone", () => {
    const values = buildEditFormValues(
      event({
        timeZone: "America/New_York",
        schedule: [
          { startTime: "2026-11-01T19:00:00.000Z", endTime: null, content: "Doors" },
          { timeLabel: "Later", content: "Afterparty", people: [] },
        ],
      })
    );
    expect(values.schedule[0]).toMatchObject({
      startWallTime: "2026-11-01T14:00",
      endWallTime: null,
    });
    expect(values.schedule[1]).toMatchObject({ startWallTime: null, timeLabel: "Later" });
  });
});

describe("buildCalEventUpdateInput", () => {
  const edit = (patch, source = event()) => {
    const initial = buildEditFormValues(source);
    return buildCalEventUpdateInput(initial, { ...initial, ...patch }, source);
  };

  test("sends nothing when nothing changed", () => {
    expect(edit({})).toEqual({});
  });

  test("sends only the changed fields", () => {
    expect(edit({ name: "  Rooftop meetup 3 ", requiresApproval: true })).toEqual({
      title: "Rooftop meetup 3",
      requiresApproval: true,
    });
  });

  test("sends start and end together when either moves", () => {
    expect(edit({ endWallTime: "2026-11-01T21:00" })).toEqual({
      startTime: "2026-11-01T18:00:00.000Z",
      endTime: "2026-11-01T21:00:00.000Z",
    });
  });

  test("a new timezone keeps the wall times, so the instants move", () => {
    expect(edit({ timeZone: "Europe/Madrid" })).toEqual({
      startTime: "2026-11-01T17:00:00.000Z",
      endTime: "2026-11-01T19:00:00.000Z",
      timeZone: "Europe/Madrid",
    });
  });

  test("clears the description and capacity with null", () => {
    const source = event({ capacity: 40 });
    expect(edit({ description: "  ", capacityEnabled: false }, source)).toEqual({
      description: null,
      capacity: null,
    });
    expect(edit({ capacity: "50" }, source)).toEqual({ capacity: 50 });
  });

  test("never sends the slug or guest list once published", () => {
    const published = event({ publishedAt: "2026-10-01T00:00:00.000Z", status: "published" });
    expect(edit({ slug: "another-slug-1", guestList: "hidden" }, published)).toEqual({});
    expect(edit({ slug: "another-slug-1", guestList: "hidden" })).toEqual({
      slug: "another-slug-1",
      guestList: "hidden",
    });
  });

  test("sends lists whole, without empty rows", () => {
    expect(edit({ liveStreams: ["https://youtube.com/live/1", " "] })).toEqual({
      liveStreams: [{ url: "https://youtube.com/live/1" }],
    });
    expect(edit({ hostUserIds: [1, 2] })).toEqual({ hosts: [{ userId: 1 }, { userId: 2 }] });
  });

  test("sends the lineup cleaned, and null once it is emptied", () => {
    expect(
      edit({
        lineupTitle: "Speakers",
        lineupPeople: [{ name: " Ada ", role: "", links: [{ url: "" }], media: [] }],
      })
    ).toEqual({
      lineup: {
        title: "Speakers",
        people: [{ name: "Ada", role: null, avatarUrl: null, links: [], media: [] }],
      },
    });
    const withLineup = event({ lineup: { title: "Speakers", people: [{ name: "Ada" }] } });
    expect(edit({ lineupTitle: "", lineupPeople: [] }, withLineup)).toEqual({ lineup: null });
  });

  test("sends schedule items in UTC, or with their label", () => {
    expect(
      edit({
        schedule: [
          {
            startWallTime: "2026-11-01T18:30",
            endWallTime: null,
            timeLabel: "",
            content: "Talk",
            people: [],
          },
          { startWallTime: null, endWallTime: null, timeLabel: "Late", content: "DJ", people: [] },
        ],
      })
    ).toEqual({
      schedule: [
        { startTime: "2026-11-01T18:30:00.000Z", endTime: null, content: "Talk", people: [] },
        { timeLabel: "Late", content: "DJ", people: [] },
      ],
    });
  });

  test("resends the schedule when the timezone moves it", () => {
    const source = event({
      schedule: [{ startTime: "2026-11-01T18:30:00.000Z", endTime: null, content: "Talk" }],
    });
    expect(edit({ timeZone: "Europe/Madrid" }, source).schedule).toEqual([
      { startTime: "2026-11-01T17:30:00.000Z", endTime: null, content: "Talk", people: [] },
    ]);
  });

  test("background colors compare case-insensitively", () => {
    const source = event({
      background: { effect: "tide", colors: ["#aabbcc", "#000000", "#ffffff"] },
    });
    expect(
      edit({ background: { effect: "tide", colors: ["#AABBCC", "#000000", "#FFFFFF"] } }, source)
    ).toEqual({});
    expect(edit({ background: null }, source)).toEqual({ background: null });
  });
});

describe("getEditCalEventErrors", () => {
  const errors = (patch, source = event()) => {
    const initial = buildEditFormValues(source);
    return getEditCalEventErrors({ ...initial, ...patch }, initial, source, NOW);
  };

  test("an untouched event is valid", () => {
    expect(errors({})).toEqual({});
  });

  test("a start that has passed only counts once it is moved", () => {
    const live = event({
      startTime: "2026-10-19T10:00:00.000Z",
      endTime: "2026-10-19T14:00:00.000Z",
    });
    expect(errors({ name: "Renamed" }, live)).toEqual({});
    expect(errors({ startWallTime: "2026-10-19T10:30" }, live).time).toBe(
      "Start date must be in the future"
    );
  });

  test("the end must be 15 minutes after the start", () => {
    expect(errors({ endWallTime: "2026-11-01T18:10" }).time).toMatch(/15 minutes/);
  });

  test("checks the slug only while it can change", () => {
    expect(errors({ slug: "Bad Slug" }).slug).toBeDefined();
    expect(errors({ slug: "short" }).slug).toBeDefined();
    expect(errors({ slug: "a-good-slug-1" }).slug).toBeUndefined();
  });

  test("capacity can't go below the confirmed guests", () => {
    const source = event({ capacity: 10, confirmedCount: 8 });
    expect(errors({ capacity: "5" }, source).capacity).toBe("8 guests are already confirmed");
    expect(errors({ capacity: "abc" }, source).capacity).toMatch(/number/);
  });

  test("payment timeout is 10 to 10080 minutes or empty", () => {
    expect(errors({ paymentTimeoutMinutes: "5" }).paymentTimeoutMinutes).toBeDefined();
    expect(errors({ paymentTimeoutMinutes: "30" }).paymentTimeoutMinutes).toBeUndefined();
  });

  test("live streams are links, at most five", () => {
    expect(errors({ liveStreams: ["youtube"] }).liveStreams).toBeDefined();
    expect(
      errors({ liveStreams: Array.from({ length: 6 }, (_, i) => `https://x.com/${i}`) }).liveStreams
    ).toMatch(/up to 5/);
  });

  test("schedule items must sit inside the event", () => {
    const item = (startWallTime, endWallTime = null) => ({
      startWallTime,
      endWallTime,
      timeLabel: "",
      content: "Talk",
      people: [],
    });
    expect(errors({ schedule: [item("2026-11-01T17:00")] }).schedule).toMatch(/during/);
    expect(errors({ schedule: [item("2026-11-01T19:00", "2026-11-01T21:00")] }).schedule).toMatch(
      /end by/
    );
    expect(errors({ schedule: [item("2026-11-01T19:00", "2026-11-01T19:30")] }).schedule).toBe(
      undefined
    );
  });

  test("schedule items need a start time unless they already have a label", () => {
    const item = (timeLabel) => ({
      startWallTime: null,
      endWallTime: null,
      timeLabel,
      content: "Talk",
      people: [],
    });
    expect(errors({ schedule: [item("")] }).schedule).toMatch(/start time/);
    expect(errors({ schedule: [item("Doors open")] }).schedule).toBe(undefined);
  });

  test("lineup people need a name", () => {
    expect(errors({ lineupPeople: [{ name: " " }] }).lineup).toMatch(/name/);
  });
});

describe("registration questions", () => {
  test("custom questions need a label, a unique identifier and options", () => {
    const question = (patch) => ({
      field: "custom",
      type: "shortText",
      slug: "company",
      label: "Company",
      ...patch,
    });
    expect(getRegistrationFieldsError([question()])).toBeNull();
    expect(getRegistrationFieldsError([question({ label: "" })])).toMatch(/label/);
    expect(getRegistrationFieldsError([question(), question()])).toMatch(/share/);
    expect(getRegistrationFieldsError([question({ type: "select", options: [""] })])).toMatch(
      /option/
    );
  });

  test("a new identifier comes from the label and stays unique", () => {
    expect(slugForRegistrationField("Your company?", [])).toBe("your-company");
    expect(slugForRegistrationField("Company", [{ field: "custom", slug: "company" }])).toBe(
      "company-2"
    );
  });
});

describe("moveItem", () => {
  test("swaps an item with its neighbour", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
  });

  test("leaves the list alone when the item or its target is out of range", () => {
    const items = ["a", "b"];
    expect(moveItem(items, 0, -1)).toBe(items);
    expect(moveItem(items, 1, 1)).toBe(items);
    expect(moveItem(items, -1, 1)).toBe(items);
    expect(moveItem(items, 2, -1)).toBe(items);
  });
});

describe("canEditCalEvent", () => {
  test("owners and hosts edit anything but a cancelled event", () => {
    expect(canEditCalEvent(event(), 1)).toBe(true);
    expect(canEditCalEvent(event(), 2)).toBe(false);
    expect(canEditCalEvent(event({ status: "cancelled" }), 1)).toBe(false);

    // A team event the viewer hosts but doesn't own.
    const hosted = event({
      userId: null,
      teamId: 3,
      hosts: [
        { userId: 1, name: "Owner 1", avatarUrl: "" },
        { userId: 2, name: "Host 2", avatarUrl: "" },
      ],
    });
    expect(canEditCalEvent(hosted, 2)).toBe(true);
    expect(canEditCalEvent({ ...hosted, status: "cancelled" }, 2)).toBe(false);
  });
});

describe("adding a location", () => {
  const form = (patch) => ({
    kind: "link",
    value: "zoom.us/j/1",
    label: "",
    capacity: "",
    price: "",
    currency: "USD",
    ...patch,
  });
  const address = [{ id: "l1", type: "address", address: "Calle Mayor 1" }];

  test("allows one address, and links that parse", () => {
    expect(
      getAddCalEventLocationError(form({ kind: "address", value: "Plaza 2" }), address)
    ).toMatch(/one address/);
    expect(getAddCalEventLocationError(form({ value: "not a link" }), address)).toMatch(/link/);
    expect(getAddCalEventLocationError(form(), address)).toBeNull();
  });

  test("checks seats and price", () => {
    expect(getAddCalEventLocationError(form({ capacity: "0" }), [])).toMatch(/Seats/);
    expect(getAddCalEventLocationError(form({ price: "1.234" }), [])).toMatch(/price/);
    expect(getAddCalEventLocationError(form({ price: "5", currency: "??" }), [])).toMatch(
      /currency/
    );
  });

  test("builds the body with the price in the smallest unit", () => {
    expect(
      buildAddCalEventLocationInput(form({ label: " Stream ", capacity: "20", price: "15.50" }))
    ).toEqual({
      type: "link",
      link: "https://zoom.us/j/1",
      label: "Stream",
      capacity: 20,
      price: 1550,
      currency: "USD",
    });
    expect(buildAddCalEventLocationInput(form({ price: "1500", currency: "jpy" })).price).toBe(
      1500
    );
    // Intl gives ISK no decimals and KWD three; Cal.com stores both in hundredths.
    expect(buildAddCalEventLocationInput(form({ price: "150", currency: "isk" })).price).toBe(
      15000
    );
    expect(buildAddCalEventLocationInput(form({ price: "1.5", currency: "kwd" })).price).toBe(150);
    expect(getAddCalEventLocationError(form({ price: "1.25", currency: "kwd" }), [])).toBeNull();
    expect(getAddCalEventLocationError(form({ price: "15.5", currency: "jpy" }), [])).toMatch(
      /price/
    );
  });

  test("adds a price that reads back as it was typed", () => {
    const shown = (price, currency) => {
      const body = buildAddCalEventLocationInput(form({ price, currency }));
      return formatCalEventPrice(body.price, body.currency);
    };
    expect(shown("1500", "JPY")).toBe("¥1,500");
    expect(shown("15.50", "EUR")).toBe("€15.50");
    expect(shown("150", "ISK")).toMatch(/^ISK\s150$/);
  });

  test("describes every kind of location", () => {
    expect(describeCalEventLocation({ type: "link", link: "https://zoom.us/j/1" })).toBe(
      "zoom.us/j/1"
    );
    expect(describeCalEventLocation({ type: "integration", integration: "google-meet" })).toBe(
      "Google Meet"
    );
    expect(describeCalEventLocation({ type: "unknown", location: "{}" })).toBe("Other location");
  });
});

describe("formatWallDateTime", () => {
  test("reads like the web editor's date-time trigger", () => {
    expect(formatWallDateTime("2027-01-15T16:00")).toBe("Jan 15, 2027 · 16:00");
  });
});
