/**
 * Seed data for the mock Cal.com backend: one signed-in host with the bookings, links (event
 * types), schedules, teams, webhooks, private links, Cal Video recordings and Cal Events the app
 * shows, in the exact shapes Cal.com API v2 returns in production.
 *
 * Every time is relative to `now`, so "upcoming" is always upcoming. Ids and uids are fixed, so
 * screenshots and tests see the same data on every run. All people and emails are fictional
 * (example.com / example.org).
 */
import { addDays, addMinutes, iso, zonedTime } from "./time.ts";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export interface SeedOptions {
  /** The moment the data is built around. Defaults to the current time. */
  now?: Date;
  /** The host's time zone. */
  timeZone?: string;
  /** Origin of the mock web app (booking pages, video links). */
  appUrl?: string;
}

export interface OAuthClient {
  clientId: string;
  name: string;
  redirectUris: string[];
}

export interface SeedData {
  meta: { now: string; timeZone: string; appUrl: string };
  oauthClients: OAuthClient[];
  me: JsonObject;
  teams: JsonObject[];
  /** People who can be added as Cal Event co-hosts (team members). */
  hostCandidates: JsonObject[];
  schedules: JsonObject[];
  conferencing: JsonObject[];
  eventTypes: JsonObject[];
  bookings: JsonObject[];
  privateLinks: JsonObject[];
  webhooks: JsonObject[];
  eventTypeWebhooks: JsonObject[];
  recordings: Record<string, JsonObject[]>;
  transcripts: Record<string, string[]>;
  conferencingSessions: Record<string, JsonObject[]>;
  calEvents: JsonObject[];
  calEventRegistrations: Record<string, JsonObject[]>;
  calEventMessages: Record<string, JsonObject[]>;
  calEventCoHosts: Record<string, JsonObject[]>;
}

export const MOCK_CLIENT_ID = "mock-companion-client";
export const MOCK_REDIRECT_URIS = ["expo-wxt-app://oauth/callback", "calcom://oauth/callback"];

const USER_ID = 1001;
const DEFAULT_SCHEDULE_ID = 2001;

/** Deterministic PRNG (mulberry32), so generated uids are the same on every run. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function uidFactory(seed: number) {
  const random = createRandom(seed);
  return (length = 22) =>
    Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join("");
}

function avatar(seed: string): string {
  return `https://api.dicebear.com/9.x/initials/png?seed=${encodeURIComponent(seed)}`;
}

/** The host's teammates and regular guests. */
const PEOPLE = [
  { name: "Jordan Rivera", email: "jordan.rivera@example.com", timeZone: "America/Chicago" },
  { name: "Priya Nair", email: "priya.nair@example.org", timeZone: "Asia/Kolkata" },
  { name: "Mateo Garcia", email: "mateo.garcia@example.com", timeZone: "Europe/Madrid" },
  { name: "Hannah Becker", email: "hannah.becker@example.de", timeZone: "Europe/Berlin" },
  { name: "Kenji Watanabe", email: "kenji.watanabe@example.jp", timeZone: "Asia/Tokyo" },
  { name: "Amara Okafor", email: "amara.okafor@example.com", timeZone: "Africa/Lagos" },
  { name: "Liam O'Connor", email: "liam.oconnor@example.ie", timeZone: "Europe/Dublin" },
  { name: "Sofia Rossi", email: "sofia.rossi@example.it", timeZone: "Europe/Rome" },
  { name: "Noah Williams", email: "noah.williams@example.com", timeZone: "America/Los_Angeles" },
  { name: "Chloé Martin", email: "chloe.martin@example.fr", timeZone: "Europe/Paris" },
  { name: "Ethan Park", email: "ethan.park@example.com", timeZone: "America/New_York" },
  { name: "Zara Ahmed", email: "zara.ahmed@example.co.uk", timeZone: "Europe/London" },
  { name: "Lucas Silva", email: "lucas.silva@example.com.br", timeZone: "America/Sao_Paulo" },
  { name: "Mia Johansson", email: "mia.johansson@example.se", timeZone: "Europe/Stockholm" },
  { name: "Oliver Smith", email: "oliver.smith@example.com.au", timeZone: "Australia/Sydney" },
  { name: "Isabella Moreno", email: "isabella.moreno@example.mx", timeZone: "America/Mexico_City" },
] as const;

function bookingFields(extra: JsonObject[] = []): JsonObject[] {
  return [
    {
      type: "name",
      slug: "name",
      label: "Your name",
      placeholder: "John Doe",
      required: true,
      isDefault: true,
      disableOnPrefill: false,
    },
    {
      type: "email",
      slug: "email",
      label: "Email address",
      placeholder: "john@example.com",
      required: true,
      hidden: false,
      isDefault: true,
      disableOnPrefill: false,
    },
    {
      type: "radioInput",
      slug: "location",
      label: "Location",
      required: false,
      hidden: false,
      isDefault: true,
    },
    {
      type: "text",
      slug: "title",
      label: "What is this meeting about?",
      placeholder: "",
      required: true,
      hidden: true,
      isDefault: true,
      disableOnPrefill: false,
    },
    {
      type: "textarea",
      slug: "notes",
      label: "Additional notes",
      placeholder: "Please share anything that will help prepare for our meeting.",
      required: false,
      hidden: false,
      isDefault: true,
      disableOnPrefill: false,
    },
    {
      type: "multiemail",
      slug: "guests",
      label: "Add guests",
      placeholder: "Email",
      required: false,
      hidden: false,
      isDefault: true,
      disableOnPrefill: false,
    },
    {
      type: "textarea",
      slug: "rescheduleReason",
      label: "Reason for reschedule",
      placeholder: "Let others know why you need to reschedule",
      required: false,
      hidden: false,
      isDefault: true,
      disableOnPrefill: false,
    },
    ...extra,
  ];
}

export function createSeed(options: SeedOptions = {}): SeedData {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? "America/New_York";
  const appUrl = (options.appUrl ?? "http://localhost:4010").replace(/\/+$/, "");
  const nextUid = uidFactory(20261127);
  const at = (dayOffset: number, hour: number, minute = 0) =>
    zonedTime(now, dayOffset, hour, minute, timeZone);

  // --------------------------------------------------------------------------------------------
  // The signed-in host
  // --------------------------------------------------------------------------------------------
  const me: JsonObject = {
    id: USER_ID,
    username: "avery",
    email: "avery.chen@example.com",
    name: "Avery Chen",
    avatarUrl: avatar("Avery Chen"),
    bio: "Product designer. Book a time and let's talk shop.",
    timeFormat: 12,
    defaultScheduleId: DEFAULT_SCHEDULE_ID,
    weekStart: "Monday",
    timeZone,
    organizationId: 0,
    locale: "en",
    brandColor: "#292929",
    darkBrandColor: "#fafafa",
    theme: null,
  };
  const host = {
    id: USER_ID,
    name: "Avery Chen",
    email: "avery.chen@example.com",
    displayEmail: "avery.chen@example.com",
    username: "avery",
    timeZone,
  };

  // --------------------------------------------------------------------------------------------
  // Teams and teammates
  // --------------------------------------------------------------------------------------------
  const teams: JsonObject[] = [
    {
      id: 3001,
      name: "Design Studio",
      slug: "design-studio",
      logoUrl: avatar("Design Studio"),
      bio: "Brand, product and motion design.",
      hideBranding: false,
      isOrganization: false,
      isPrivate: false,
      hideBookATeamMember: false,
      metadata: {},
      brandColor: "#292929",
      darkBrandColor: "#fafafa",
      timeFormat: 12,
      timeZone,
      weekStart: "Monday",
    },
    {
      id: 3002,
      name: "Customer Success",
      slug: "customer-success",
      logoUrl: avatar("Customer Success"),
      bio: "Onboarding and support for our customers.",
      hideBranding: false,
      isOrganization: false,
      isPrivate: false,
      hideBookATeamMember: false,
      metadata: {},
      brandColor: "#0f766e",
      darkBrandColor: "#5eead4",
      timeFormat: 12,
      timeZone,
      weekStart: "Monday",
    },
  ];
  const hostCandidates: JsonObject[] = PEOPLE.slice(0, 6).map((person, index) => ({
    userId: 1100 + index,
    name: person.name,
    username: person.name.split(" ")[0].toLowerCase(),
    email: person.email,
    avatarUrl: avatar(person.name),
  }));

  // --------------------------------------------------------------------------------------------
  // Availability schedules
  // --------------------------------------------------------------------------------------------
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const schedules: JsonObject[] = [
    {
      id: DEFAULT_SCHEDULE_ID,
      ownerId: USER_ID,
      name: "Working hours",
      timeZone,
      isDefault: true,
      availability: [
        { days: weekdays, startTime: "09:00", endTime: "12:00" },
        { days: weekdays, startTime: "13:00", endTime: "17:30" },
      ],
      overrides: [
        { date: iso(at(9, 0)).slice(0, 10), startTime: "10:00", endTime: "14:00" },
        { date: iso(at(16, 0)).slice(0, 10), startTime: "00:00", endTime: "00:00" },
      ],
    },
    {
      id: 2002,
      ownerId: USER_ID,
      name: "Evening office hours",
      timeZone,
      isDefault: false,
      availability: [
        { days: ["Monday", "Wednesday", "Thursday"], startTime: "18:00", endTime: "21:00" },
      ],
      overrides: [],
    },
    {
      id: 2003,
      ownerId: USER_ID,
      name: "Weekend workshops",
      timeZone: "Europe/London",
      isDefault: false,
      availability: [{ days: ["Saturday"], startTime: "10:00", endTime: "14:00" }],
      overrides: [],
    },
  ];

  // --------------------------------------------------------------------------------------------
  // Installed conferencing apps
  // --------------------------------------------------------------------------------------------
  const conferencing: JsonObject[] = [
    { id: 4001, type: "daily_video", appId: "daily-video", userId: USER_ID, invalid: false },
    { id: 4002, type: "google_video", appId: "google-meet", userId: USER_ID, invalid: false },
    { id: 4003, type: "zoom_video", appId: "zoom", userId: USER_ID, invalid: false },
  ];

  // --------------------------------------------------------------------------------------------
  // Links (event types)
  // --------------------------------------------------------------------------------------------
  const calVideo: JsonObject = { type: "integration", integration: "cal-video" };
  const eventType = (fields: JsonObject): JsonObject => ({
    lengthInMinutesOptions: [],
    description: "",
    locations: [calVideo],
    bookingFields: bookingFields(),
    disableGuests: false,
    slotInterval: null,
    minimumBookingNotice: 120,
    beforeEventBuffer: 0,
    afterEventBuffer: 0,
    recurrence: null,
    metadata: {},
    price: 0,
    currency: "usd",
    lockTimeZoneToggleOnBookingPage: false,
    seatsPerTimeSlot: null,
    forwardParamsSuccessRedirect: true,
    successRedirectUrl: null,
    isInstantEvent: false,
    seatsShowAvailabilityCount: true,
    scheduleId: null,
    bookingLimitsCount: { disabled: true },
    onlyShowFirstAvailableSlot: false,
    bookingLimitsDuration: { disabled: true },
    bookingWindow: { disabled: true },
    bookerLayouts: { enabledLayouts: ["month", "week", "column"], defaultLayout: "month" },
    confirmationPolicy: { disabled: true },
    requiresBookerEmailVerification: false,
    hideCalendarNotes: false,
    color: { lightThemeHex: "#292929", darkThemeHex: "#fafafa" },
    seats: { disabled: true },
    offsetStart: 0,
    customName: "",
    useDestinationCalendarEmail: false,
    hideCalendarEventDetails: false,
    hideOrganizerEmail: false,
    hidden: false,
    bookingRequiresAuthentication: false,
    disableCancelling: { disabled: false },
    disableRescheduling: { disabled: false },
    allowReschedulingPastBookings: false,
    allowReschedulingCancelledBookings: false,
    showOptimizedSlots: false,
    ownerId: USER_ID,
    users: ["avery"],
    ...fields,
    bookingUrl: `${appUrl}/avery/${String(fields.slug)}`,
  });

  const eventTypes: JsonObject[] = [
    eventType({
      id: 5001,
      title: "15 Min Intro",
      slug: "15min",
      lengthInMinutes: 15,
      description: "A quick call to see if we're a good fit.",
    }),
    eventType({
      id: 5002,
      title: "30 Min Meeting",
      slug: "30min",
      lengthInMinutes: 30,
      lengthInMinutesOptions: [15, 30, 45],
      description: "General meeting. Pick the length that suits you.",
      locations: [calVideo, { type: "integration", integration: "google-meet" }],
    }),
    eventType({
      id: 5003,
      title: "Design Review",
      slug: "design-review",
      lengthInMinutes: 60,
      description: "Bring your files. We'll go through them together.",
      confirmationPolicy: { type: "always", blockUnconfirmedBookingsInBooker: true },
      color: { lightThemeHex: "#7c3aed", darkThemeHex: "#a78bfa" },
    }),
    eventType({
      id: 5004,
      title: "Paid Consultation",
      slug: "consultation",
      lengthInMinutes: 45,
      description: "In-depth advice on your product. Paid in advance.",
      price: 120,
      currency: "usd",
      metadata: { apps: { stripe: { enabled: true, price: 12000, currency: "usd" } } },
      color: { lightThemeHex: "#047857", darkThemeHex: "#34d399" },
    }),
    eventType({
      id: 5005,
      title: "Weekly Mentoring",
      slug: "mentoring",
      lengthInMinutes: 30,
      description: "A recurring weekly check-in.",
      recurrence: { interval: 1, occurrences: 6, frequency: "weekly" },
    }),
    eventType({
      id: 5006,
      title: "Office Hours",
      slug: "office-hours",
      lengthInMinutes: 60,
      description: "Drop in with questions. Up to 8 people per slot.",
      seatsPerTimeSlot: 8,
      seats: { seatsPerTimeSlot: 8, showAttendeeInfo: false, showAvailabilityCount: true },
      scheduleId: 2002,
    }),
    eventType({
      id: 5007,
      title: "Studio Visit",
      slug: "studio-visit",
      lengthInMinutes: 90,
      description: "Come see the studio in person.",
      locations: [{ type: "address", address: "350 5th Ave, New York, NY 10118", public: true }],
      bookingFields: bookingFields([
        {
          type: "phone",
          slug: "attendeePhoneNumber",
          label: "Phone number",
          required: true,
          hidden: false,
          isDefault: false,
          disableOnPrefill: false,
        },
      ]),
      minimumBookingNotice: 1440,
    }),
    eventType({
      id: 5008,
      title: "Phone Screen",
      slug: "phone-screen",
      lengthInMinutes: 20,
      description: "I'll call you.",
      locations: [{ type: "phone", phone: "+1 212 555 0147", public: false }],
    }),
    eventType({
      id: 5009,
      title: "Investor Update (private)",
      slug: "investor-update",
      lengthInMinutes: 30,
      description: "Shared by private link only.",
      hidden: true,
      locations: [{ type: "link", link: "https://meet.example.com/avery", public: false }],
    }),
  ];
  const eventTypeById = new Map(eventTypes.map((item) => [item.id as number, item]));

  // --------------------------------------------------------------------------------------------
  // Bookings
  // --------------------------------------------------------------------------------------------
  let nextBookingId = 9001;
  const created = addDays(now, -20);
  const bookings: JsonObject[] = [];

  type BookingSpec = {
    eventTypeId: number;
    start: Date;
    attendee: number | number[];
    status?: "accepted" | "pending" | "cancelled" | "rejected";
    title?: string;
    description?: string;
    guests?: string[];
    absent?: boolean;
    absentHost?: boolean;
    location?: string;
    cancellationReason?: string;
    recurringBookingUid?: string;
    uid?: string;
    extra?: JsonObject;
  };

  const addBooking = (spec: BookingSpec): JsonObject => {
    const type = eventTypeById.get(spec.eventTypeId);
    if (!type) throw new Error(`Unknown event type ${spec.eventTypeId}`);
    const duration = type.lengthInMinutes as number;
    const uid = spec.uid ?? nextUid();
    const attendeeIndexes = Array.isArray(spec.attendee) ? spec.attendee : [spec.attendee];
    const attendees = attendeeIndexes.map((index) => {
      const person = PEOPLE[index % PEOPLE.length];
      return {
        name: person.name,
        email: person.email,
        displayEmail: person.email,
        timeZone: person.timeZone,
        language: "en",
        absent: Boolean(spec.absent),
      };
    });
    const typeLocation = (type.locations as JsonObject[])[0];
    const location =
      spec.location ??
      (typeLocation.type === "address"
        ? (typeLocation.address as string)
        : typeLocation.type === "phone"
          ? (typeLocation.phone as string)
          : typeLocation.type === "link"
            ? (typeLocation.link as string)
            : `${appUrl}/video/${uid}`);
    const end = addMinutes(spec.start, duration);
    const booking: JsonObject = {
      id: nextBookingId++,
      uid,
      title: spec.title ?? `${type.title} between Avery Chen and ${attendees[0].name}`,
      description: spec.description ?? "",
      hosts: [host],
      status: spec.status ?? "accepted",
      start: iso(spec.start),
      end: iso(end),
      duration,
      eventTypeId: type.id as number,
      eventType: { id: type.id as number, slug: type.slug as string },
      meetingUrl: location.startsWith("http") ? location : null,
      location,
      absentHost: Boolean(spec.absentHost),
      createdAt: iso(created),
      updatedAt: iso(created),
      metadata: {},
      icsUid: `${uid}@Cal.com`,
      attendees,
      guests: spec.guests ?? [],
      bookingFieldsResponses: {
        name: attendees[0].name,
        email: attendees[0].email,
        notes: spec.description ?? "",
        guests: spec.guests ?? [],
        location: { value: "integrations:daily", optionValue: "" },
      },
      ...(spec.cancellationReason
        ? {
            cancellationReason: spec.cancellationReason,
            cancelledByEmail: spec.status === "rejected" ? host.email : attendees[0].email,
          }
        : {}),
      ...(spec.recurringBookingUid ? { recurringBookingUid: spec.recurringBookingUid } : {}),
      ...spec.extra,
    };
    if (!booking.meetingUrl) delete booking.meetingUrl;
    bookings.push(booking);
    return booking;
  };

  // Happening now and later today.
  addBooking({
    eventTypeId: 5002,
    start: addMinutes(now, -10),
    attendee: 0,
    description: "Kickoff for the onboarding redesign.",
    guests: ["sam.lee@example.com"],
  });
  addBooking({ eventTypeId: 5001, start: addMinutes(now, 90), attendee: 1 });
  addBooking({
    eventTypeId: 5008,
    start: addMinutes(now, 180),
    attendee: 2,
    extra: {
      bookingFieldsResponses: {
        name: PEOPLE[2].name,
        email: PEOPLE[2].email,
        attendeePhoneNumber: "+34 612 555 019",
      },
    },
  });

  // The next two weeks.
  const upcomingPlan: Array<[number, number, number, number]> = [
    // [dayOffset, hour, eventTypeId, attendee]
    [1, 9, 5002, 3],
    [1, 11, 5001, 4],
    [1, 15, 5004, 5],
    [2, 10, 5006, 6],
    [2, 14, 5002, 7],
    [3, 9, 5001, 8],
    [3, 13, 5007, 9],
    [4, 11, 5002, 10],
    [5, 16, 5008, 11],
    [7, 10, 5002, 12],
    [8, 14, 5001, 13],
    [10, 9, 5002, 14],
    [12, 15, 5004, 15],
  ];
  for (const [dayOffset, hour, eventTypeId, attendee] of upcomingPlan) {
    addBooking({ eventTypeId, start: at(dayOffset, hour), attendee });
  }
  // A seated Office Hours slot with several attendees.
  addBooking({
    eventTypeId: 5006,
    start: at(3, 18),
    attendee: [0, 4, 9, 13],
    title: "Office Hours",
  });
  // Waiting for the host to confirm (Design Review requires confirmation).
  addBooking({
    eventTypeId: 5003,
    start: at(2, 11),
    attendee: 6,
    status: "pending",
    description: "Portfolio site, about 20 screens.",
  });
  addBooking({ eventTypeId: 5003, start: at(4, 15), attendee: 11, status: "pending" });
  addBooking({ eventTypeId: 5003, start: at(9, 10), attendee: 2, status: "pending" });

  // A weekly recurring series: 6 occurrences, the first already past.
  const seriesUid = nextUid();
  for (let week = -1; week < 5; week++) {
    addBooking({
      eventTypeId: 5005,
      start: at(week * 7 + 2, 8, 30),
      attendee: 12,
      title: "Weekly Mentoring between Avery Chen and Lucas Silva",
      recurringBookingUid: seriesUid,
    });
  }

  // Past meetings: some with no-shows, some with Cal Video recordings.
  const pastPlan: Array<[number, number, number, number, Partial<BookingSpec>]> = [
    [-1, 10, 5002, 0, {}],
    [-1, 14, 5001, 3, { absent: true }],
    [-2, 9, 5004, 5, {}],
    [-3, 11, 5002, 7, {}],
    [-4, 15, 5006, 8, {}],
    [-6, 10, 5002, 10, { absentHost: true }],
    [-7, 13, 5007, 14, {}],
    [-9, 16, 5001, 15, {}],
    [-12, 11, 5002, 1, {}],
    [-15, 9, 5008, 4, {}],
  ];
  const pastBookings = pastPlan.map(([dayOffset, hour, eventTypeId, attendee, extra]) =>
    addBooking({ eventTypeId, start: at(dayOffset, hour), attendee, ...extra })
  );

  // Cancelled and declined.
  addBooking({
    eventTypeId: 5002,
    start: at(2, 16),
    attendee: 9,
    status: "cancelled",
    cancellationReason: "Something came up, sorry! I'll book another time.",
  });
  addBooking({
    eventTypeId: 5001,
    start: at(5, 10),
    attendee: 13,
    status: "cancelled",
    cancellationReason: "Found the answer in the docs.",
  });
  addBooking({
    eventTypeId: 5003,
    start: at(6, 14),
    attendee: 15,
    status: "rejected",
    cancellationReason: "That week is fully booked. Please pick a slot after the 15th.",
  });
  addBooking({
    eventTypeId: 5004,
    start: at(-5, 12),
    attendee: 6,
    status: "cancelled",
    cancellationReason: "Payment wasn't completed.",
  });

  // A rescheduled pair: the original is cancelled and points at the new time.
  const rescheduledTo = addBooking({ eventTypeId: 5002, start: at(6, 11), attendee: 8 });
  const original = addBooking({
    eventTypeId: 5002,
    start: at(1, 16),
    attendee: 8,
    status: "cancelled",
    cancellationReason: "Rescheduled",
    extra: {
      rescheduledToUid: rescheduledTo.uid as string,
      reschedulingReason: "Clashes with a flight.",
      rescheduledByEmail: PEOPLE[8].email,
    },
  });
  rescheduledTo.rescheduledFromUid = original.uid as string;
  rescheduledTo.reschedulingReason = "Clashes with a flight.";

  // Cal Video artefacts for two past meetings.
  const recordings: Record<string, JsonObject[]> = {};
  const transcripts: Record<string, string[]> = {};
  const conferencingSessions: Record<string, JsonObject[]> = {};
  for (const booking of [pastBookings[0], pastBookings[3]]) {
    const uid = booking.uid as string;
    const startTs = Math.floor(new Date(booking.start as string).getTime() / 1000);
    const roomName = uid.slice(0, 20);
    recordings[uid] = [
      {
        id: `rec-${uid.slice(0, 8)}`,
        roomName,
        startTs: startTs + 60,
        status: "finished",
        maxParticipants: 2,
        duration: 1620,
        shareToken: `share-${uid.slice(0, 10)}`,
        downloadLink: `${appUrl}/__mock/media/recording-${uid.slice(0, 8)}.mp4`,
      },
    ];
    transcripts[uid] = [`${appUrl}/__mock/media/transcript-${uid.slice(0, 8)}.vtt`];
    conferencingSessions[uid] = [
      {
        id: `ses-${uid.slice(0, 8)}`,
        room: roomName,
        startTime: startTs,
        duration: 1680,
        ongoing: false,
        maxParticipants: 2,
        participants: [
          { userId: String(USER_ID), userName: "Avery Chen", joinTime: startTs, duration: 1680 },
          {
            userId: "guest-1",
            userName: (booking.attendees as JsonObject[])[0].name as string,
            joinTime: startTs + 95,
            duration: 1560,
          },
        ],
      },
    ];
  }

  // --------------------------------------------------------------------------------------------
  // Private links and webhooks
  // --------------------------------------------------------------------------------------------
  const privateLinks: JsonObject[] = [
    {
      linkId: "pl-investor-q4",
      eventTypeId: 5009,
      isExpired: false,
      bookingUrl: `${appUrl}/d/pl-investor-q4/investor-update`,
      expiresAt: iso(addDays(now, 30)),
    },
    {
      linkId: "pl-investor-once",
      eventTypeId: 5009,
      isExpired: false,
      bookingUrl: `${appUrl}/d/pl-investor-once/investor-update`,
      maxUsageCount: 1,
      usageCount: 0,
    },
    {
      linkId: "pl-consult-expired",
      eventTypeId: 5004,
      isExpired: true,
      bookingUrl: `${appUrl}/d/pl-consult-expired/consultation`,
      expiresAt: iso(addDays(now, -3)),
    },
  ];
  const webhooks: JsonObject[] = [
    {
      id: 6001,
      userId: USER_ID,
      subscriberUrl: "https://hooks.example.com/cal/bookings",
      triggers: ["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"],
      active: true,
      payloadTemplate: "",
      secret: "whsec_mock_1",
    },
    {
      id: 6002,
      userId: USER_ID,
      subscriberUrl: "https://crm.example.org/webhooks/cal",
      triggers: ["MEETING_ENDED"],
      active: false,
      payloadTemplate: '{"title":"{{title}}","start":"{{startTime}}"}',
    },
  ];
  const eventTypeWebhooks: JsonObject[] = [
    {
      id: 6101,
      eventTypeId: 5004,
      subscriberUrl: "https://billing.example.com/cal/paid",
      triggers: ["BOOKING_PAID", "BOOKING_CREATED"],
      active: true,
      payloadTemplate: "",
    },
  ];

  // --------------------------------------------------------------------------------------------
  // Cal Events (hosted events with guests)
  // --------------------------------------------------------------------------------------------
  const calHost = {
    userId: USER_ID,
    name: "Avery Chen",
    username: "avery",
    avatarUrl: avatar("Avery Chen"),
  };
  const calEvent = (fields: JsonObject): JsonObject => ({
    description: null,
    timeZone,
    visibility: "PUBLIC",
    hidden: false,
    publishedAt: iso(addDays(now, -10)),
    cancelledAt: null,
    locations: [],
    coverImageUrl: null,
    requiresApproval: false,
    waitlistEnabled: false,
    confirmedCount: 0,
    hosts: [calHost],
    capacity: null,
    price: null,
    currency: null,
    paymentsEnabled: false,
    cancellationReason: null,
    userId: USER_ID,
    teamId: null,
    category: "meetup",
    theme: null,
    background: { effect: "aurora", colors: ["#1e3a8a", "#7c3aed", "#db2777"] },
    liveStreams: [],
    lineup: null,
    schedule: null,
    registrationFields: [],
    guestList: "names",
    showOrganizerEmail: false,
    showPresentedBy: true,
    paymentTimeoutMinutes: null,
    ...fields,
  });

  const meetupStart = at(8, 18, 30);
  const calEvents: JsonObject[] = [
    calEvent({
      uuid: "evt-design-meetup",
      slug: "nyc-design-meetup",
      title: "NYC Design Systems Meetup",
      description:
        "An evening of short talks on design systems, tokens and component APIs, followed by drinks.",
      startTime: iso(meetupStart),
      endTime: iso(addMinutes(meetupStart, 150)),
      checkInOpensAt: iso(addMinutes(meetupStart, -60)),
      checkInClosesAt: iso(addMinutes(meetupStart, 150)),
      locations: [
        {
          id: "loc-studio",
          type: "address",
          address: "350 5th Ave, New York, NY 10118",
          label: "Main hall",
          capacity: 80,
        },
        {
          id: "loc-stream",
          type: "link",
          link: "https://stream.example.com/nyc-design",
          label: "Livestream",
        },
      ],
      coverImageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200",
      requiresApproval: true,
      waitlistEnabled: true,
      capacity: 80,
      lineup: {
        title: "Speakers",
        people: [
          { name: "Priya Nair", role: "Design Systems Lead", avatarUrl: avatar("Priya Nair") },
          { name: "Kenji Watanabe", role: "Motion Designer", avatarUrl: avatar("Kenji Watanabe") },
        ],
      },
      schedule: [
        { timeLabel: "6:30 PM", content: "Doors open" },
        { timeLabel: "7:00 PM", content: "Tokens at scale", people: [{ name: "Priya Nair" }] },
        {
          timeLabel: "7:30 PM",
          content: "Motion as a system",
          people: [{ name: "Kenji Watanabe" }],
        },
        { timeLabel: "8:00 PM", content: "Drinks" },
      ],
      registrationFields: [
        { field: "company", type: "shortText", slug: "company", label: "Company", required: false },
        {
          field: "role",
          type: "select",
          slug: "role",
          label: "Your role",
          required: true,
          options: ["Designer", "Engineer", "Product", "Other"],
        },
      ],
    }),
    calEvent({
      uuid: "evt-paid-workshop",
      slug: "figma-variables-workshop",
      title: "Figma Variables Workshop",
      description: "A hands-on, 3-hour workshop. Laptops required.",
      startTime: iso(at(15, 10)),
      endTime: iso(at(15, 13)),
      locations: [
        {
          id: "loc-ws",
          type: "address",
          address: "45 Rockefeller Plaza, New York, NY 10111",
          price: 89,
          currency: "usd",
          capacity: 24,
        },
      ],
      category: "conference",
      capacity: 24,
      price: 89,
      currency: "usd",
      paymentsEnabled: true,
      paymentTimeoutMinutes: 30,
      background: { effect: "tide", colors: ["#065f46", "#10b981", "#a7f3d0"] },
    }),
    calEvent({
      uuid: "evt-draft-retreat",
      slug: "spring-team-retreat",
      title: "Spring Team Retreat",
      description: "Draft: still confirming the venue.",
      startTime: iso(at(45, 9)),
      endTime: iso(at(46, 17)),
      visibility: "UNLISTED",
      publishedAt: null,
      locations: [],
      background: null,
    }),
    calEvent({
      uuid: "evt-past-portfolio",
      slug: "portfolio-review-night",
      title: "Portfolio Review Night",
      description: "Bring your portfolio for quick-fire feedback.",
      startTime: iso(at(-6, 18)),
      endTime: iso(at(-6, 20)),
      locations: [{ id: "loc-past", type: "address", address: "350 5th Ave, New York, NY 10118" }],
      publishedAt: iso(addDays(now, -30)),
    }),
    calEvent({
      uuid: "evt-cancelled-picnic",
      slug: "summer-picnic",
      title: "Community Picnic",
      startTime: iso(at(20, 12)),
      endTime: iso(at(20, 16)),
      cancelledAt: iso(addDays(now, -2)),
      cancellationReason: "Forecast says thunderstorms all weekend.",
      locations: [{ id: "loc-park", type: "address", address: "Central Park, New York, NY" }],
    }),
  ];

  const registrationRandom = createRandom(7);
  const registration = (
    eventUuid: string,
    index: number,
    status: string,
    extra: JsonObject = {}
  ): JsonObject => {
    const person = PEOPLE[index % PEOPLE.length];
    return {
      type: "event",
      registrationId: `${eventUuid}-reg-${String(index).padStart(2, "0")}`,
      status,
      name: person.name,
      email: person.email,
      phoneNumber: null,
      rsvpResponse: status === "DECLINED" ? "NO" : "YES",
      responses: { company: "Example Co", role: "Designer" },
      locationId: null,
      createdAt: iso(addDays(now, -Math.floor(registrationRandom() * 9) - 1)),
      checkedInAt: null,
      checkedInByUserId: null,
      avatarUrl: avatar(person.name),
      payment: null,
      noShow: false,
      decidedAt: status === "CONFIRMED" || status === "DECLINED" ? iso(addDays(now, -1)) : null,
      ...extra,
    };
  };
  const calEventRegistrations: Record<string, JsonObject[]> = {
    "evt-design-meetup": [
      ...[0, 1, 2, 3, 4, 5, 6].map((i) =>
        registration("evt-design-meetup", i, "CONFIRMED", {
          locationId: i % 3 === 0 ? "loc-stream" : "loc-studio",
        })
      ),
      ...[7, 8, 9].map((i) => registration("evt-design-meetup", i, "PENDING_APPROVAL")),
      registration("evt-design-meetup", 10, "WAITLISTED"),
      registration("evt-design-meetup", 11, "DECLINED"),
    ],
    "evt-paid-workshop": [
      ...[2, 5, 8].map((i) =>
        registration("evt-paid-workshop", i, "CONFIRMED", {
          payment: { success: true, refunded: false, amount: 8900, currency: "usd" },
        })
      ),
      registration("evt-paid-workshop", 12, "PENDING_PAYMENT"),
    ],
    "evt-past-portfolio": [0, 3, 6, 9, 12].map((i) =>
      registration("evt-past-portfolio", i, "CONFIRMED", {
        checkedInAt: i === 12 ? null : iso(at(-6, 18, 5 + i)),
        checkedInByUserId: i === 12 ? null : USER_ID,
        noShow: i === 12,
      })
    ),
    "evt-cancelled-picnic": [1, 4].map((i) => registration("evt-cancelled-picnic", i, "CANCELLED")),
    "evt-draft-retreat": [],
  };
  for (const event of calEvents) {
    event.confirmedCount = (calEventRegistrations[event.uuid as string] ?? []).filter(
      (item) => item.status === "CONFIRMED"
    ).length;
  }

  const calEventMessages: Record<string, JsonObject[]> = {
    "evt-design-meetup": [
      {
        id: "msg-2",
        segment: "GOING",
        createdAt: iso(addDays(now, -1)),
        sender: { id: USER_ID, name: "Avery Chen" },
        status: "SENT",
        counts: { sentCount: 7, failedCount: 0, skippedPhoneCount: 0, skippedUnsubscribedCount: 0 },
      },
      {
        id: "msg-1",
        segment: "PENDING",
        createdAt: iso(addDays(now, -5)),
        sender: { id: USER_ID, name: "Avery Chen" },
        status: "PARTIALLY_SENT",
        counts: { sentCount: 2, failedCount: 1, skippedPhoneCount: 0, skippedUnsubscribedCount: 0 },
      },
    ],
  };
  const calEventCoHosts: Record<string, JsonObject[]> = {
    "evt-design-meetup": [
      {
        id: "cohost-1",
        email: PEOPLE[1].email,
        status: "ACCEPTED",
        name: PEOPLE[1].name,
        avatarUrl: avatar(PEOPLE[1].name),
      },
      {
        id: "cohost-2",
        email: "new.organizer@example.com",
        status: "PENDING",
        name: null,
        avatarUrl: null,
      },
    ],
  };

  return {
    meta: { now: now.toISOString(), timeZone, appUrl },
    oauthClients: [
      {
        clientId: MOCK_CLIENT_ID,
        name: "Cal.com Companion (mock)",
        redirectUris: MOCK_REDIRECT_URIS,
      },
    ],
    me,
    teams,
    hostCandidates,
    schedules,
    conferencing,
    eventTypes,
    bookings,
    privateLinks,
    webhooks,
    eventTypeWebhooks,
    recordings,
    transcripts,
    conferencingSessions,
    calEvents,
    calEventRegistrations,
    calEventMessages,
    calEventCoHosts,
  };
}
