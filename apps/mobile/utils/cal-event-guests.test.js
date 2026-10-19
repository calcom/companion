import { describe, expect, jest, test } from "@jest/globals";

jest.mock("@/utils/region", () => ({
  getCalAppUrl: () => "https://app.example.test",
  getCalWebUrl: () => "https://example.test",
}));

const {
  buildRosterCsv,
  countMessageRecipients,
  countRoster,
  filterRoster,
  formatGuestPayment,
  formatLocationSeats,
  formatMessageCounts,
  formatMessageRecipients,
  formatMessageSender,
  formatMessageStatus,
  formatRelativeTime,
  getApproveAllMessage,
  getApproveAllPrompt,
  getDecisionMessage,
  getGuestAnswerEntries,
  getGuestBadge,
  getGuestContact,
  getGuestContext,
  getGuestDecidedLabel,
  getGuestDecisions,
  getGuestDisplayName,
  getGuestFilterCounts,
  getGuestFilters,
  getGuestInitial,
  getGuestIntent,
  getGuestLocationLabel,
  getGuestLocationOptions,
  getInviteResultMessage,
  getRosterPage,
  isCalEventPaid,
  isGuestNoShow,
  parseInviteEmails,
  rosterCsvFilename,
} = require("./cal-event-guests");

function guest(overrides = {}) {
  return {
    registrationId: "r1",
    status: "CONFIRMED",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phoneNumber: null,
    rsvpResponse: "YES",
    responses: {},
    locationId: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    checkedInAt: null,
    avatarUrl: null,
    payment: null,
    noShow: false,
    decidedAt: null,
    ...overrides,
  };
}

const hall = { id: "l1", type: "address", address: "Main St 1", label: "Main hall" };
const stream = { id: "l2", type: "link", link: "https://zoom.us/j/1" };
const meet = { id: "l3", type: "integration", integration: "google-meet" };

describe("how a guest reads", () => {
  test("a phone guest shows their number, not the placeholder address", () => {
    const phoneGuest = guest({ name: "", email: "x@sms.cal.com", phoneNumber: "+37120000000" });
    expect(getGuestContact(phoneGuest)).toEqual({ kind: "phone", value: "+37120000000" });
    expect(getGuestDisplayName(phoneGuest)).toBe("+37120000000");
  });

  test("a guest without a name shows their email", () => {
    expect(getGuestDisplayName(guest({ name: "  " }))).toBe("ada@example.com");
  });

  test("the avatar shows the first letter, like the web's", () => {
    expect(getGuestInitial("Ada King Lovelace")).toBe("A");
    expect(getGuestInitial("ada@example.com")).toBe("A");
    expect(getGuestInitial("😀 Party")).toBe("😀");
    expect(getGuestInitial(" ")).toBe("?");
  });

  test("the badge shows a status that needs something, else the RSVP", () => {
    expect(getGuestBadge(guest({ status: "PENDING_APPROVAL" }))).toEqual({
      label: "Needs approval",
      tone: "warning",
    });
    expect(getGuestBadge(guest({ status: "WAITLISTED" }))).toEqual({
      label: "Waitlisted",
      tone: "neutral",
    });
    expect(getGuestBadge(guest({ status: "PENDING_PAYMENT" })).label).toBe("Payment needed");
    expect(getGuestBadge(guest({ status: "DECLINED" }))).toEqual({
      label: "Declined",
      tone: "error",
    });
    expect(getGuestBadge(guest({ rsvpResponse: "MAYBE" }))).toEqual({
      label: "Maybe",
      tone: "warning",
    });
  });

  test("a waiting guest shows whether they mean to come", () => {
    expect(getGuestIntent(guest({ status: "PENDING_APPROVAL" }))).toBe("Wants to attend");
    expect(getGuestIntent(guest({ status: "WAITLISTED", rsvpResponse: "NO" }))).toBe(
      "Doesn't plan to attend"
    );
    expect(getGuestIntent(guest())).toBeNull();
  });

  test("a paying guest shows what they paid, as the web's", () => {
    const payment = { success: true, refunded: false, amount: 2000, currency: "eur" };
    expect(formatGuestPayment(guest({ payment }))).toBe("Paid · €20.00");
    expect(formatGuestPayment(guest({ payment: { ...payment, refunded: true } }))).toBe(
      "Refunded · €20.00"
    );
    expect(
      formatGuestPayment(
        guest({ status: "PENDING_PAYMENT", payment: { ...payment, success: false } })
      )
    ).toBe("Awaiting payment · €20.00");
    expect(formatGuestPayment(guest())).toBeNull();
  });

  test("the line under the name: intent while waiting, else payment, else when they registered", () => {
    const payment = { success: true, refunded: false, amount: 1500, currency: "usd" };
    expect(getGuestContext(guest({ status: "PENDING_APPROVAL", payment }))).toBe("Wants to attend");
    expect(getGuestContext(guest({ payment }))).toBe("Paid · $15.00");
    expect(
      getGuestContext(guest({ status: "PENDING_PAYMENT", payment: { ...payment, success: false } }))
    ).toBe("Payment · $15.00");
    expect(getGuestContext(guest({ createdAt: new Date().toISOString() }))).toMatch(/^Registered /);
  });

  test("a no-show shows only on a confirmed guest", () => {
    expect(isGuestNoShow(guest({ noShow: true }))).toBe(true);
    expect(isGuestNoShow(guest({ noShow: true, status: "CANCELLED" }))).toBe(false);
    expect(isGuestNoShow(guest())).toBe(false);
  });

  test("the decision time reads as what the host decided", () => {
    expect(getGuestDecidedLabel("DECLINED")).toBe("Declined");
    expect(getGuestDecidedLabel("CONFIRMED")).toBe("Approved");
    expect(getGuestDecidedLabel("PENDING_PAYMENT")).toBe("Approved");
  });
});

describe("deciding one guest", () => {
  test("a pending guest can be approved or declined, a waitlisted one only declined", () => {
    expect(getGuestDecisions("PENDING_APPROVAL")).toEqual(["approve", "decline"]);
    expect(getGuestDecisions("WAITLISTED")).toEqual(["decline"]);
    expect(getGuestDecisions("CONFIRMED")).toEqual([]);
    expect(getGuestDecisions("PENDING_PAYMENT")).toEqual([]);
  });

  test("tells the host when an approval didn't seat the guest", () => {
    expect(getDecisionMessage("payment_pending")).toEqual({
      title: "Payment link sent",
      message: "Approved. The guest has been sent a payment link to confirm their spot.",
    });
    expect(getDecisionMessage("event_full_offer_waitlist")).toEqual({
      title: "Event is full",
      message: "The guest wasn't seated and stays pending.",
    });
    expect(getDecisionMessage("confirmed")).toBeNull();
    expect(getDecisionMessage("declined")).toBeNull();
  });
});

describe("filters, counts and pages", () => {
  const roster = [
    guest({ registrationId: "a", name: "Ada", rsvpResponse: "YES", locationId: "l1" }),
    guest({ registrationId: "b", name: "Bob", email: "bob@x.com", rsvpResponse: "MAYBE" }),
    guest({ registrationId: "c", name: "Cy", email: "cy@x.com", rsvpResponse: "NO" }),
    guest({ registrationId: "d", name: "Di", email: "di@x.com", rsvpResponse: "YES" }),
    guest({ registrationId: "e", name: "Ed", status: "PENDING_APPROVAL", rsvpResponse: "YES" }),
    guest({ registrationId: "f", name: "Flo", status: "WAITLISTED", rsvpResponse: "MAYBE" }),
    guest({ registrationId: "g", name: "Gus", status: "DECLINED", rsvpResponse: "YES" }),
  ];
  const ids = (rows) => rows.map((row) => row.registrationId);

  test("filters by search, location and chip together", () => {
    expect(ids(filterRoster(roster, { search: "", locationId: null, filter: "GOING" }))).toEqual([
      "a",
      "d",
    ]);
    expect(ids(filterRoster(roster, { search: "X.COM", locationId: null, filter: "ALL" }))).toEqual(
      ["b", "c", "d"]
    );
    expect(ids(filterRoster(roster, { search: "", locationId: "l1", filter: "ALL" }))).toEqual([
      "a",
    ]);
  });

  test("Going is confirmed guests going; Maybe and Not going are that answer in any status", () => {
    const only = (filter) => ids(filterRoster(roster, { search: "", locationId: null, filter }));
    expect(only("MAYBE")).toEqual(["b", "f"]);
    expect(only("PENDING_APPROVAL")).toEqual(["e"]);
    expect(only("WAITLISTED")).toEqual(["f"]);
    expect(only("PENDING_PAYMENT")).toEqual([]);
    expect(only("ALL")).toHaveLength(7);
  });

  test("counts follow the search and location but not the chip", () => {
    expect(countRoster(roster, { search: "", locationId: null })).toEqual({
      ALL: 7,
      GOING: 2,
      MAYBE: 2,
      NOT_GOING: 1,
      PENDING_APPROVAL: 1,
      WAITLISTED: 1,
      PENDING_PAYMENT: 0,
    });
    expect(countRoster(roster, { search: "bob", locationId: null })).toMatchObject({
      ALL: 1,
      GOING: 0,
      MAYBE: 1,
    });
  });

  test("reads each chip's count from the server's, as the web's tabs do", () => {
    expect(
      getGuestFilterCounts({
        pendingApproval: 2,
        waitlisted: 3,
        pendingPayment: 1,
        offerExpired: 9,
        declined: 4,
        cancelled: 5,
        confirmed: 20,
        going: 15,
        checkedIn: 6,
        rsvpResponses: { yes: 18, no: 4, maybe: 7 },
        byLocation: [],
      })
    ).toEqual({
      ALL: 35,
      GOING: 15,
      MAYBE: 7,
      NOT_GOING: 4,
      PENDING_APPROVAL: 2,
      WAITLISTED: 3,
      PENDING_PAYMENT: 1,
    });
  });

  test("shows Waitlist and Pending payment where the event has them, or guests are there", () => {
    const confirmed = [guest()];
    expect(getGuestFilters(confirmed, { waitlistEnabled: false, paid: false })).toEqual([
      "ALL",
      "GOING",
      "MAYBE",
      "NOT_GOING",
      "PENDING_APPROVAL",
    ]);
    expect(getGuestFilters(confirmed, { waitlistEnabled: true, paid: true }).slice(5)).toEqual([
      "WAITLISTED",
      "PENDING_PAYMENT",
    ]);
    expect(
      getGuestFilters([guest({ status: "PENDING_PAYMENT" })], {
        waitlistEnabled: false,
        paid: false,
      })
    ).toContain("PENDING_PAYMENT");
  });

  test("an event is paid when it or one of its locations has a price", () => {
    expect(isCalEventPaid({ price: null }, [hall])).toBe(false);
    expect(isCalEventPaid({ price: 1500 }, [])).toBe(true);
    expect(isCalEventPaid({ price: null }, [{ ...hall, price: 500 }])).toBe(true);
  });

  test("pages 25 rows at a time and holds the page to the last one", () => {
    const rows = Array.from({ length: 60 }, (_, index) => index);
    expect(getRosterPage(rows, 0)).toMatchObject({ page: 0, pageCount: 3, range: "1-25 of 60" });
    expect(getRosterPage(rows, 9)).toMatchObject({ page: 2, range: "51-60 of 60" });
    expect(getRosterPage(rows, 2).rows).toHaveLength(10);
    expect(getRosterPage([1, 2, 3, 4, 5, 6], 0).range).toBe("1-6 of 6");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-10-19T12:00:00.000Z");
  const ago = (seconds) => new Date(now - seconds * 1000).toISOString();

  test("matches Intl.RelativeTimeFormat with numeric auto, in the web's steps", () => {
    const intl = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    expect(formatRelativeTime(ago(0), now)).toBe(intl.format(0, "second"));
    expect(formatRelativeTime(ago(30), now)).toBe("30 seconds ago");
    expect(formatRelativeTime(ago(60 * 60), now)).toBe("1 hour ago");
    expect(formatRelativeTime(ago(26 * 3600), now)).toBe("yesterday");
    expect(formatRelativeTime(ago(3 * 86400), now)).toBe("3 days ago");
    expect(formatRelativeTime(ago(8 * 86400), now)).toBe("last week");
    expect(formatRelativeTime(ago(65 * 86400), now)).toBe("2 months ago");
    expect(formatRelativeTime(ago(800 * 86400), now)).toBe("2 years ago");
    expect(formatRelativeTime(new Date(now + 3 * 86400 * 1000), now)).toBe("in 3 days");
  });
});

describe("locations", () => {
  test("offers locations only when there are two or more", () => {
    expect(getGuestLocationOptions([hall])).toEqual([]);
    expect(getGuestLocationOptions([hall, stream, meet])).toEqual([
      { id: "l1", label: "In person · Main hall", capacity: null },
      { id: "l2", label: "Online link · https://zoom.us/j/1", capacity: null },
      { id: "l3", label: "Online meeting", capacity: null },
    ]);
  });

  test("says how full each location is, against its cap when it has one", () => {
    const [capped, open] = getGuestLocationOptions([{ ...hall, capacity: 10 }, stream]);
    const byLocation = [
      { locationId: "l1", count: 3 },
      { locationId: null, count: 2 },
    ];
    expect(formatLocationSeats(capped, byLocation)).toBe("3 / 10 seats taken");
    expect(formatLocationSeats(open, byLocation)).toBe("0 seats taken");
    expect(formatLocationSeats(open, [{ locationId: "l2", count: 1 }])).toBe("1 seat taken");
    expect(formatLocationSeats(capped, undefined)).toBeNull();
  });

  test("a removed location still reads as one", () => {
    const options = getGuestLocationOptions([hall, stream]);
    expect(getGuestLocationLabel("l2", options)).toBe("Online link · https://zoom.us/j/1");
    expect(getGuestLocationLabel("gone", options)).toBe("Removed location");
    expect(getGuestLocationLabel(null, options)).toBeNull();
    expect(getGuestLocationLabel("l1", [])).toBeNull();
  });
});

describe("getGuestAnswerEntries", () => {
  test("labels answers by question and skips name, email and blanks", () => {
    const fields = [
      { field: "name" },
      { field: "custom", slug: "company", label: "Company" },
      { field: "custom", slug: "topics", label: "Topics" },
      { field: "attendeePhoneNumber" },
    ];
    const responses = {
      name: "Ada",
      email: "ada@example.com",
      company: "Acme",
      topics: ["AI", "Design"],
      attendeePhoneNumber: "+1555",
      notes: "  ",
      unknownKey: 3,
    };
    expect(getGuestAnswerEntries(responses, fields)).toEqual([
      { key: "company", label: "Company", value: "Acme" },
      { key: "topics", label: "Topics", value: "AI, Design" },
      { key: "attendeePhoneNumber", label: "Phone number", value: "+1555" },
      { key: "unknownKey", label: "unknownKey", value: "3" },
    ]);
  });
});

describe("parseInviteEmails", () => {
  test("splits a paste on commas, semicolons, spaces and new lines and reads Name <email>", () => {
    expect(parseInviteEmails("a@x.com, b@x.com;c@x.com\nAda Lovelace <ada@x.com> d@x.com")).toEqual(
      {
        emails: ["ada@x.com", "a@x.com", "b@x.com", "c@x.com", "d@x.com"],
        invalid: [],
        duplicates: [],
      }
    );
  });

  test("reports invalid and repeated addresses, including ones already added", () => {
    expect(parseInviteEmails("nope A@x.com a@x.com b@x.com", ["b@x.com"])).toEqual({
      emails: ["A@x.com"],
      invalid: ["nope"],
      duplicates: ["a@x.com", "b@x.com"],
    });
  });
});

describe("getInviteResultMessage", () => {
  const result = (overrides = {}) => ({
    invitedCount: 0,
    skippedAlreadyInvited: 0,
    skippedAlreadyRegistered: 0,
    skippedOnCooldown: 0,
    skippedInvalid: 0,
    failedCount: 0,
    outcomes: [],
    ...overrides,
  });

  test("uses the web's wording for each outcome", () => {
    expect(getInviteResultMessage(result({ invitedCount: 3 })).title).toBe("Invited 3 guests");
    expect(
      getInviteResultMessage(result({ invitedCount: 2, skippedAlreadyRegistered: 1 })).title
    ).toBe("Invited 2. Skipped 1 (already invited, registered, or invalid).");
    expect(getInviteResultMessage(result({ invitedCount: 2, failedCount: 1 })).title).toBe(
      "Invited 2. 1 failed to send."
    );
    expect(getInviteResultMessage(result({ skippedAlreadyInvited: 1 })).title).toBe(
      "No new invitations were sent. 1 address was skipped."
    );
    expect(getInviteResultMessage(result({ skippedInvalid: 2, failedCount: 1 })).title).toBe(
      "No new invitations were sent. 1 failed to send. 2 addresses were skipped."
    );
  });

  test("groups skipped addresses by reason in the web's order", () => {
    const { skippedGroups } = getInviteResultMessage(
      result({
        outcomes: [
          { email: "a@x.com", reason: "already-invited" },
          { email: "b@x.com", reason: "invited" },
          { email: "c@x.com", reason: "invalid-format" },
          { email: "d@x.com", reason: "already-invited" },
        ],
      })
    );
    expect(skippedGroups).toEqual([
      { reason: "invalid-format", label: "1 address isn't valid", emails: ["c@x.com"] },
      {
        reason: "already-invited",
        label: "2 guests were already invited",
        emails: ["a@x.com", "d@x.com"],
      },
    ]);
  });
});

describe("messages", () => {
  const roster = [
    guest({ registrationId: "a", rsvpResponse: "YES", checkedInAt: "2026-10-01T10:00:00Z" }),
    guest({ registrationId: "b", rsvpResponse: "YES", locationId: "l1" }),
    guest({ registrationId: "c", rsvpResponse: "YES", email: "p@sms.cal.com", phoneNumber: "+1" }),
    guest({ registrationId: "d", rsvpResponse: "MAYBE" }),
    guest({ registrationId: "e", status: "PENDING_APPROVAL", rsvpResponse: "YES" }),
    guest({ registrationId: "f", status: "WAITLISTED", rsvpResponse: "MAYBE" }),
    guest({ registrationId: "g", status: "DECLINED", rsvpResponse: "YES" }),
  ];

  test("counts the guests with an address in the group", () => {
    const count = (filters) =>
      countMessageRecipients(roster, { locationId: null, checkIn: "ANY", ...filters });
    expect(count({ segment: "GOING" })).toBe(2);
    expect(count({ segment: "MAYBE" })).toBe(1);
    expect(count({ segment: "GOING", checkIn: "CHECKED_IN" })).toBe(1);
    expect(count({ segment: "GOING", checkIn: "NOT_CHECKED_IN" })).toBe(1);
    expect(count({ segment: "GOING", locationId: "l1" })).toBe(1);
    expect(count({ segment: "PENDING" })).toBe(2);
  });

  test("words the recipient line", () => {
    expect(formatMessageRecipients(1)).toBe("1 guest will get this email");
    expect(formatMessageRecipients(4)).toBe("4 guests will get this email");
    expect(formatMessageRecipients(0)).toBe("No guests in this group have an email address");
  });

  test("words a sent message's status, counts and sender", () => {
    const counts = {
      sentCount: 3,
      failedCount: 1,
      skippedPhoneCount: 0,
      skippedUnsubscribedCount: 2,
    };
    expect(formatMessageStatus({ status: "SENDING", counts: null })).toBe("Sending…");
    expect(formatMessageStatus({ status: "SENT", counts })).toBe("Sent to 3 guests");
    expect(formatMessageStatus({ status: "PARTIALLY_SENT", counts })).toBe("Sent to 3 of 4 guests");
    expect(formatMessageStatus({ status: "NOT_SENT", counts: null })).toBe("Not sent");
    expect(formatMessageStatus({ status: "NOT_SENT_EVENT_UNSENDABLE", counts: null })).toBe(
      "Not sent. This event can no longer be messaged."
    );
    expect(formatMessageCounts(counts)).toBe(
      "3 sent · 1 failed · 0 skipped by phone · 2 unsubscribed"
    );
    expect(formatMessageCounts(null)).toBeNull();
    expect(formatMessageSender(null)).toBe("Deleted user");
    expect(formatMessageSender({ id: 1, name: null })).toBe("Unnamed user");
    expect(formatMessageSender({ id: 1, name: "Ada" })).toBe("Ada");
  });
});

describe("approve all", () => {
  test("asks in the web's words", () => {
    expect(getApproveAllPrompt(1, { paid: false })).toBe(
      "Approve 1 pending guest in registration order."
    );
    expect(getApproveAllPrompt(3, { paid: true })).toBe(
      "Start payment approval for 3 pending guests in registration order."
    );
  });

  test("reports in the web's words", () => {
    expect(getApproveAllMessage({ kind: "completed", approvedCount: 3, notSeatedCount: 0 })).toBe(
      "Approved 3 pending registrations"
    );
    expect(getApproveAllMessage({ kind: "completed", approvedCount: 2, notSeatedCount: 1 })).toBe(
      "Approved 2, but 1 could not be seated because the event is full"
    );
    expect(getApproveAllMessage({ kind: "completed", approvedCount: 0, notSeatedCount: 0 })).toBe(
      "No pending registrations to approve"
    );
    expect(getApproveAllMessage({ kind: "started", total: 4 })).toBe(
      "Approval started. Refresh the guest list to see updates."
    );
  });
});

describe("buildRosterCsv", () => {
  test("writes the web's columns, a column per visible question, and a BOM", () => {
    const event = {
      registrationFields: [
        { field: "name" },
        { field: "email" },
        { field: "custom", slug: "company", label: "Company" },
        { field: "custom", slug: "loc", label: "location" },
        { field: "custom", slug: "secret", label: "Secret", hidden: true },
      ],
    };
    const csv = buildRosterCsv(
      [
        guest({
          name: 'Ada "The" Lovelace',
          responses: { company: "Acme, Inc", loc: "=SUM(A1)" },
          locationId: "l2",
          checkedInAt: "2026-10-02T09:00:00.000Z",
          payment: { success: true, refunded: false, amount: 2000, currency: "eur" },
          decidedAt: "2026-10-01T12:00:00.000Z",
          noShow: true,
        }),
        guest({
          name: "",
          email: "p@sms.cal.com",
          phoneNumber: "+1555",
          status: "PENDING_APPROVAL",
          rsvpResponse: "MAYBE",
        }),
      ],
      event,
      [hall, stream]
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\n")).toEqual([
      "name,email,phone,status,rsvp_response,payment_status,registered_at,decided_at,checked_in_at,location,no_show,Company,location (loc)",
      '"Ada ""The"" Lovelace",ada@example.com,,CONFIRMED,YES,paid,2026-10-01T10:00:00.000Z,2026-10-01T12:00:00.000Z,2026-10-02T09:00:00.000Z,Online link · https://zoom.us/j/1,yes,"Acme, Inc",\'=SUM(A1)',
      ",,'+1555,PENDING_APPROVAL,MAYBE,,2026-10-01T10:00:00.000Z,,,,,,",
    ]);
  });

  test("names the file after the slug and the day", () => {
    const date = new Date("2026-10-19T12:00:00.000Z");
    expect(rosterCsvFilename("summer party!", date)).toBe("summer-party--all-2026-10-19.csv");
    expect(rosterCsvFilename("", date)).toBe("event-all-2026-10-19.csv");
  });
});
