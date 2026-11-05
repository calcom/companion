import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "@jest/globals";
import {
  buildNextCallPayload,
  NEXT_CALL_LEAD_TIME_MS,
  pickNextCall,
  planNextCallLiveActivity,
} from "@/utils/next-call-live-activity";
import { getCalAppUrl } from "@/utils/region";

const now = new Date("2026-11-04T10:00:00.000Z");
const minutes = (count) => count * 60 * 1000;
const iso = (offsetMs) => new Date(now.getTime() + offsetMs).toISOString();

function booking(overrides = {}) {
  return {
    id: 1,
    uid: "booking-1",
    title: "Product Review",
    startTime: iso(minutes(30)),
    endTime: iso(minutes(60)),
    status: "accepted",
    attendees: [{ name: "Jane Smith", email: "jane@example.com", timeZone: "UTC" }],
    ...overrides,
  };
}

describe("pickNextCall", () => {
  test("returns null when nothing is upcoming", () => {
    expect(pickNextCall([], now)).toBeNull();
    expect(pickNextCall([booking({ endTime: iso(-minutes(1)) })], now)).toBeNull();
  });

  test("picks the soonest confirmed booking that has not ended", () => {
    const later = booking({
      uid: "later",
      startTime: iso(minutes(90)),
      endTime: iso(minutes(120)),
    });
    const cancelled = booking({
      uid: "cancelled",
      status: "cancelled",
      startTime: iso(minutes(5)),
    });
    const pending = booking({ uid: "pending", status: "pending", startTime: iso(minutes(5)) });
    const soonest = booking({ uid: "soonest" });
    expect(pickNextCall([later, cancelled, pending, soonest], now)?.uid).toBe("soonest");
  });

  test("keeps a call that is already in progress", () => {
    const inProgress = booking({
      uid: "now",
      startTime: iso(-minutes(10)),
      endTime: iso(minutes(20)),
    });
    const next = booking({ uid: "next" });
    expect(pickNextCall([next, inProgress], now)?.uid).toBe("now");
  });

  test("reads start/end when startTime/endTime are missing", () => {
    const legacy = booking({
      startTime: undefined,
      endTime: undefined,
      start: iso(minutes(2)),
      end: iso(minutes(30)),
    });
    expect(pickNextCall([legacy], now)?.uid).toBe("booking-1");
  });
});

describe("buildNextCallPayload", () => {
  test("describes the booking for the activity", () => {
    const payload = buildNextCallPayload(
      booking({
        attendees: [
          { name: "Jane Smith", email: "jane@example.com", timeZone: "UTC" },
          { name: "John Doe", email: "john@example.com", timeZone: "UTC" },
        ],
        location: `${getCalAppUrl("us")}/video/abc123`,
      })
    );
    expect(payload).toEqual({
      uid: "booking-1",
      title: "Product Review",
      startTime: iso(minutes(30)),
      endTime: iso(minutes(60)),
      attendeeName: "Jane Smith",
      attendeeCount: 2,
      locationLabel: "Cal Video",
      isVideo: true,
      deepLinkUrl: "calcom://(tabs)/(bookings)/booking-detail?uid=booking-1",
    });
  });

  test("labels non-video locations and falls back to the numeric id", () => {
    const payload = buildNextCallPayload(
      booking({ uid: "", id: 42, attendees: [], location: "Office 3" })
    );
    expect(payload).toMatchObject({
      uid: "42",
      attendeeName: null,
      attendeeCount: 0,
      locationLabel: "Office 3",
      isVideo: false,
    });
    expect(buildNextCallPayload(booking({ location: "integrations:daily" }))?.locationLabel).toBe(
      "Cal Video"
    );
    expect(buildNextCallPayload(booking({ location: "integrations:daily" }))?.isVideo).toBe(true);
  });

  test("only treats meeting links and conferencing integrations as video", () => {
    expect(buildNextCallPayload(booking({ location: "Meeting room 3" }))?.isVideo).toBe(false);
    expect(buildNextCallPayload(booking({ location: "Teams offsite" }))?.isVideo).toBe(false);
    expect(buildNextCallPayload(booking({ location: "integrations:zoom" }))?.isVideo).toBe(true);
    expect(buildNextCallPayload(booking({ location: "https://zoom.us/j/1" }))?.isVideo).toBe(true);
    expect(
      buildNextCallPayload(booking({ location: "integrations:cal-video" }))?.locationLabel
    ).toBe("Cal Video");
  });
});

describe("planNextCallLiveActivity", () => {
  test("waits until five minutes before the call", () => {
    const plan = planNextCallLiveActivity([booking()], now);
    expect(plan.action).toBe("wait");
    expect(plan.startAt.getTime()).toBe(now.getTime() + minutes(30) - NEXT_CALL_LEAD_TIME_MS);
    expect(plan.payload.uid).toBe("booking-1");
  });

  test("shows the activity inside the lead window and during the call", () => {
    const soon = planNextCallLiveActivity([booking({ startTime: iso(minutes(5)) })], now);
    expect(soon.action).toBe("show");
    expect(soon.endsAt.toISOString()).toBe(iso(minutes(60)));

    const running = planNextCallLiveActivity([booking({ startTime: iso(-minutes(3)) })], now);
    expect(running.action).toBe("show");
  });

  test("does nothing without a confirmed upcoming booking", () => {
    expect(planNextCallLiveActivity([booking({ status: "cancelled" })], now)).toEqual({
      action: "none",
    });
    expect(planNextCallLiveActivity([booking({ startTime: "not a date" })], now)).toEqual({
      action: "none",
    });
  });
});

describe("NextCallAttributes", () => {
  test("app and widget extension copies stay identical", () => {
    const root = path.resolve(__dirname, "..");
    const app = fs.readFileSync(
      path.join(root, "modules/next-call-live-activity/ios/NextCallAttributes.swift"),
      "utf8"
    );
    const widget = fs.readFileSync(
      path.join(root, "targets/widget/NextCallAttributes.swift"),
      "utf8"
    );
    expect(widget).toBe(app);
  });
});
