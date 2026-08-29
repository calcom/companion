import { describe, expect, it } from "@jest/globals";
import {
  buildSlotUrl,
  composeKeyboardInsertion,
  transformToKeyboardData,
} from "./keyboardStorage.shared";

const eventType = (id) => ({
  id,
  title: `Event ${id}`,
  slug: `event-${id}`,
  length: 30,
});

describe("keyboard storage data", () => {
  it("adds slot query parameters while preserving an existing query", () => {
    expect(
      buildSlotUrl(
        "https://app.cal.com/alex/meeting?theme=dark",
        "2026-09-01T17:00:00.000Z",
        "America/New_York"
      )
    ).toBe(
      "https://app.cal.com/alex/meeting?theme=dark&date=2026-09-01&month=2026-09&slot=2026-09-01T17%3A00%3A00.000Z"
    );
  });

  it("caps links, days, and slots", () => {
    const slotsByEventType = {};
    for (let eventId = 1; eventId <= 11; eventId += 1) {
      slotsByEventType[eventId] = Array.from({ length: 64 }, (_, index) => ({
        start: new Date(Date.UTC(2026, 8, 1 + Math.floor(index / 8), index % 8)).toISOString(),
      }));
    }
    const result = transformToKeyboardData({
      eventTypes: Array.from({ length: 11 }, (_, index) => eventType(index + 1)),
      slotsByEventType,
      timeZone: "UTC",
      bookingUrlForEventType: (event) => `https://app.cal.com/alex/${event.slug}`,
    });

    expect(result.links).toHaveLength(10);
    expect(result.links[0].days).toHaveLength(7);
    expect(result.links[0].days.every((day) => day.slots.length <= 8)).toBe(true);
  });

  it("composes single and multiple slot insertions", () => {
    const data = transformToKeyboardData({
      eventTypes: [eventType(1)],
      slotsByEventType: {
        1: [{ start: "2026-09-01T10:00:00.000Z" }, { start: "2026-09-01T11:00:00.000Z" }],
      },
      timeZone: "UTC",
      bookingUrlForEventType: () => "https://app.cal.com/alex/event-1",
    });
    const [link] = data.links;
    const [day] = link.days;
    const [slot] = day.slots;

    expect(composeKeyboardInsertion(link, [{ day, slot }], "UTC")).toBe(
      `${day.label} at ${slot.label} — ${slot.url}`
    );
    const secondSlot = day.slots[1];
    expect(
      composeKeyboardInsertion(
        link,
        [
          { day, slot },
          { day, slot: secondSlot },
        ],
        "UTC"
      )
    ).toBe(
      [
        `${link.title} — pick a time:`,
        `${day.label} at ${slot.label} — ${slot.url}`,
        `${day.label} at ${secondSlot.label} — ${secondSlot.url}`,
        "",
        "(times in UTC)",
      ].join("\n")
    );
  });
});
