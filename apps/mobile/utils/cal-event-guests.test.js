import { describe, expect, jest, test } from "@jest/globals";

jest.mock("@/utils/region", () => ({
  getCalAppUrl: () => "https://app.example.test",
  getCalWebUrl: () => "https://example.test",
}));

const {
  buildRosterCsv,
  countMessageRecipients,
  countRosterByRsvp,
  filterRoster,
  formatMessageCounts,
  formatMessageRecipients,
  formatMessageSender,
  formatMessageStatus,
  formatRelativeTime,
  getApproveAllMessage,
  getGuestAnswerEntries,
  getGuestContact,
  getGuestDisplayName,
  getGuestInitial,
  getGuestLocationLabel,
  getGuestLocationOptions,
  getInviteResultMessage,
  getRosterPage,
  parseInviteEmails,
  rosterCsvFilename,
} = require("./cal-event-guests");

function guest(overrides = {}) {
  return {
    registrationId: "r1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phoneNumber: null,
    rsvpResponse: "YES",
    responses: {},
    locationId: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    checkedInAt: null,
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
});

describe("filters, counts and pages", () => {
  const roster = [
    guest({ registrationId: "a", name: "Ada", rsvpResponse: "YES", locationId: "l1" }),
    guest({ registrationId: "b", name: "Bob", email: "bob@x.com", rsvpResponse: "MAYBE" }),
    guest({ registrationId: "c", name: "Cy", email: "cy@x.com", rsvpResponse: "NO" }),
    guest({ registrationId: "d", name: "Di", email: "di@x.com", rsvpResponse: "YES" }),
  ];

  test("filters by search, location and RSVP together", () => {
    const ids = (rows) => rows.map((row) => row.registrationId);
    expect(ids(filterRoster(roster, { search: "", locationId: null, rsvp: "YES" }))).toEqual([
      "a",
      "d",
    ]);
    expect(ids(filterRoster(roster, { search: "X.COM", locationId: null, rsvp: "ALL" }))).toEqual([
      "b",
      "c",
      "d",
    ]);
    expect(ids(filterRoster(roster, { search: "", locationId: "l1", rsvp: "ALL" }))).toEqual(["a"]);
  });

  test("counts follow the search and location but not the chip", () => {
    expect(countRosterByRsvp(roster, { search: "", locationId: null })).toEqual({
      ALL: 4,
      YES: 2,
      MAYBE: 1,
      NO: 1,
    });
    expect(countRosterByRsvp(roster, { search: "bob", locationId: null })).toEqual({
      ALL: 1,
      YES: 0,
      MAYBE: 1,
      NO: 0,
    });
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
      { id: "l1", label: "In person · Main hall" },
      { id: "l2", label: "Online link · https://zoom.us/j/1" },
      { id: "l3", label: "Online meeting" },
    ]);
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
  ];

  test("counts the guests with an address in the group", () => {
    const count = (filters) =>
      countMessageRecipients(roster, { locationId: null, checkIn: "ANY", ...filters });
    expect(count({ segment: "GOING" })).toBe(2);
    expect(count({ segment: "MAYBE" })).toBe(1);
    expect(count({ segment: "GOING", checkIn: "CHECKED_IN" })).toBe(1);
    expect(count({ segment: "GOING", checkIn: "NOT_CHECKED_IN" })).toBe(1);
    expect(count({ segment: "GOING", locationId: "l1" })).toBe(1);
    expect(count({ segment: "PENDING" })).toBeNull();
  });

  test("words the recipient line", () => {
    expect(formatMessageRecipients(1)).toBe("1 guest will get this email");
    expect(formatMessageRecipients(4)).toBe("4 guests will get this email");
    expect(formatMessageRecipients(0)).toBe("No guests in this group have an email address");
    expect(formatMessageRecipients(null)).toBeNull();
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

describe("getApproveAllMessage", () => {
  test("uses the web's wording", () => {
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
        }),
        guest({ name: "", email: "p@sms.cal.com", phoneNumber: "+1555", rsvpResponse: "MAYBE" }),
      ],
      event,
      [hall, stream]
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\n")).toEqual([
      "name,email,phone,rsvp_response,registered_at,checked_in_at,location,Company,location (loc)",
      '"Ada ""The"" Lovelace",ada@example.com,,YES,2026-10-01T10:00:00.000Z,2026-10-02T09:00:00.000Z,Online link · https://zoom.us/j/1,"Acme, Inc",\'=SUM(A1)',
      ",,'+1555,MAYBE,2026-10-01T10:00:00.000Z,,,,",
    ]);
  });

  test("names the file after the slug and the day", () => {
    const date = new Date("2026-10-19T12:00:00.000Z");
    expect(rosterCsvFilename("summer party!", date)).toBe("summer-party--all-2026-10-19.csv");
    expect(rosterCsvFilename("", date)).toBe("event-all-2026-10-19.csv");
  });
});
