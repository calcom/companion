import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { CalApiError } from "../utils/errors.js";

function handleError(
  tag: string,
  err: unknown
): { content: { type: "text"; text: string }[]; isError: true } {
  if (err instanceof CalApiError) {
    console.error(`[${tag}] ${err.status}: ${err.message}`);
    return {
      content: [{ type: "text", text: `Error ${err.status}: ${err.message}` }],
      isError: true,
    };
  }
  throw err;
}

function ok(data: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export const createTeamSchema = {
  name: z.string().describe("Name of the team"),
  slug: z.string().describe("Team slug in kebab-case - if not provided will be generated automatically based on name.").optional(),
  logoUrl: z.string().describe("URL of the teams logo image").optional(),
  calVideoLogo: z.string().optional(),
  appLogo: z.string().optional(),
  appIconLogo: z.string().optional(),
  bio: z.string().optional(),
  hideBranding: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  hideBookATeamMember: z.boolean().optional(),
  metadata: z.record(z.unknown()).describe("You can store any additional data you want here. Metadata must have at most 50 keys, each key up to 40 characters. Values can be strings (up to 500 characters), numbers, or booleans.").optional(),
  theme: z.string().optional(),
  brandColor: z.string().optional(),
  darkBrandColor: z.string().optional(),
  bannerUrl: z.string().describe("URL of the teams banner image which is shown on booker").optional(),
  timeFormat: z.number().optional(),
  timeZone: z.string().describe("Timezone is used to create teams's default schedule from Monday to Friday from 9AM to 5PM. It will default to Europe/London if not passed.").optional(),
  weekStart: z.string().optional(),
  autoAcceptCreator: z.boolean().describe("If you are a platform customer, don't pass 'false', because then team creator won't be able to create team event types.").optional(),
};

export async function createTeam(params: {
  name: string;
  slug?: string;
  logoUrl?: string;
  calVideoLogo?: string;
  appLogo?: string;
  appIconLogo?: string;
  bio?: string;
  hideBranding?: boolean;
  isPrivate?: boolean;
  hideBookATeamMember?: boolean;
  metadata?: Record<string, unknown>;
  theme?: string;
  brandColor?: string;
  darkBrandColor?: string;
  bannerUrl?: string;
  timeFormat?: number;
  timeZone?: string;
  weekStart?: string;
  autoAcceptCreator?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.name = params.name;
    if (params.slug !== undefined) body.slug = params.slug;
    if (params.logoUrl !== undefined) body.logoUrl = params.logoUrl;
    if (params.calVideoLogo !== undefined) body.calVideoLogo = params.calVideoLogo;
    if (params.appLogo !== undefined) body.appLogo = params.appLogo;
    if (params.appIconLogo !== undefined) body.appIconLogo = params.appIconLogo;
    if (params.bio !== undefined) body.bio = params.bio;
    if (params.hideBranding !== undefined) body.hideBranding = params.hideBranding;
    if (params.isPrivate !== undefined) body.isPrivate = params.isPrivate;
    if (params.hideBookATeamMember !== undefined) body.hideBookATeamMember = params.hideBookATeamMember;
    if (params.metadata !== undefined) body.metadata = params.metadata;
    if (params.theme !== undefined) body.theme = params.theme;
    if (params.brandColor !== undefined) body.brandColor = params.brandColor;
    if (params.darkBrandColor !== undefined) body.darkBrandColor = params.darkBrandColor;
    if (params.bannerUrl !== undefined) body.bannerUrl = params.bannerUrl;
    if (params.timeFormat !== undefined) body.timeFormat = params.timeFormat;
    if (params.timeZone !== undefined) body.timeZone = params.timeZone;
    if (params.weekStart !== undefined) body.weekStart = params.weekStart;
    if (params.autoAcceptCreator !== undefined) body.autoAcceptCreator = params.autoAcceptCreator;
    const data = await calApi("teams", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_team", err);
  }
}

export const getTeamsSchema = {};

export async function getTeams() {
  try {
    const data = await calApi("teams");
    return ok(data);
  } catch (err) {
    return handleError("get_teams", err);
  }
}

export const getTeamSchema = {
  teamId: z.number().int().describe("teamId"),
};

export async function getTeam(params: {
  teamId: number;
}) {
  try {
    const data = await calApi(`teams/${params.teamId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_team", err);
  }
}

export const updateTeamSchema = {
  teamId: z.number().int().describe("teamId"),
  name: z.string().describe("Name of the team").optional(),
  slug: z.string().describe("Team slug").optional(),
  logoUrl: z.string().describe("URL of the teams logo image").optional(),
  calVideoLogo: z.string().optional(),
  appLogo: z.string().optional(),
  appIconLogo: z.string().optional(),
  bio: z.string().optional(),
  hideBranding: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  hideBookATeamMember: z.boolean().optional(),
  metadata: z.record(z.unknown()).describe("You can store any additional data you want here. Metadata must have at most 50 keys, each key up to 40 characters. Values can be strings (up to 500 characters), numbers, or booleans.").optional(),
  theme: z.string().optional(),
  brandColor: z.string().optional(),
  darkBrandColor: z.string().optional(),
  bannerUrl: z.string().describe("URL of the teams banner image which is shown on booker").optional(),
  timeFormat: z.number().optional(),
  timeZone: z.string().describe("Timezone is used to create teams's default schedule from Monday to Friday from 9AM to 5PM. It will default to Europe/London if not passed.").optional(),
  weekStart: z.string().optional(),
  bookingLimits: z.string().optional(),
  includeManagedEventsInLimits: z.boolean().optional(),
};

export async function updateTeam(params: {
  teamId: number;
  name?: string;
  slug?: string;
  logoUrl?: string;
  calVideoLogo?: string;
  appLogo?: string;
  appIconLogo?: string;
  bio?: string;
  hideBranding?: boolean;
  isPrivate?: boolean;
  hideBookATeamMember?: boolean;
  metadata?: Record<string, unknown>;
  theme?: string;
  brandColor?: string;
  darkBrandColor?: string;
  bannerUrl?: string;
  timeFormat?: number;
  timeZone?: string;
  weekStart?: string;
  bookingLimits?: string;
  includeManagedEventsInLimits?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.slug !== undefined) body.slug = params.slug;
    if (params.logoUrl !== undefined) body.logoUrl = params.logoUrl;
    if (params.calVideoLogo !== undefined) body.calVideoLogo = params.calVideoLogo;
    if (params.appLogo !== undefined) body.appLogo = params.appLogo;
    if (params.appIconLogo !== undefined) body.appIconLogo = params.appIconLogo;
    if (params.bio !== undefined) body.bio = params.bio;
    if (params.hideBranding !== undefined) body.hideBranding = params.hideBranding;
    if (params.isPrivate !== undefined) body.isPrivate = params.isPrivate;
    if (params.hideBookATeamMember !== undefined) body.hideBookATeamMember = params.hideBookATeamMember;
    if (params.metadata !== undefined) body.metadata = params.metadata;
    if (params.theme !== undefined) body.theme = params.theme;
    if (params.brandColor !== undefined) body.brandColor = params.brandColor;
    if (params.darkBrandColor !== undefined) body.darkBrandColor = params.darkBrandColor;
    if (params.bannerUrl !== undefined) body.bannerUrl = params.bannerUrl;
    if (params.timeFormat !== undefined) body.timeFormat = params.timeFormat;
    if (params.timeZone !== undefined) body.timeZone = params.timeZone;
    if (params.weekStart !== undefined) body.weekStart = params.weekStart;
    if (params.bookingLimits !== undefined) body.bookingLimits = params.bookingLimits;
    if (params.includeManagedEventsInLimits !== undefined) body.includeManagedEventsInLimits = params.includeManagedEventsInLimits;
    const data = await calApi(`teams/${params.teamId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_team", err);
  }
}

export const deleteTeamSchema = {
  teamId: z.number().int().describe("teamId"),
};

export async function deleteTeam(params: {
  teamId: number;
}) {
  try {
    const data = await calApi(`teams/${params.teamId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_team", err);
  }
}

export const getTeamBookingsSchema = {
  teamId: z.number().int().describe("teamId"),
  status: z.array(z.enum(["upcoming", "recurring", "past", "cancelled", "unconfirmed"])).describe("Filter bookings by status. If you want to filter by multiple statuses, separate them with a comma.").optional(),
  attendeeEmail: z.string().describe("Filter bookings by the attendee's email address.").optional(),
  attendeeName: z.string().describe("Filter bookings by the attendee's name.").optional(),
  bookingUid: z.string().describe("Filter bookings by the booking Uid.").optional(),
  eventTypeIds: z.string().describe("Filter bookings by event type ids belonging to the team. Event type ids must be separated by a comma.").optional(),
  eventTypeId: z.string().describe("Filter bookings by event type id belonging to the team.").optional(),
  afterStart: z.string().describe("Filter bookings with start after this date string.").optional(),
  beforeEnd: z.string().describe("Filter bookings with end before this date string.").optional(),
  sortStart: z.enum(["asc", "desc"]).describe("Sort results by their start time in ascending or descending order.").optional(),
  sortEnd: z.enum(["asc", "desc"]).describe("Sort results by their end time in ascending or descending order.").optional(),
  sortCreated: z.enum(["asc", "desc"]).describe("Sort results by their creation time (when booking was made) in ascending or descending order.").optional(),
  take: z.number().describe("The number of items to return").optional(),
  skip: z.number().describe("The number of items to skip").optional(),
};

export async function getTeamBookings(params: {
  teamId: number;
  status?: ("upcoming" | "recurring" | "past" | "cancelled" | "unconfirmed")[];
  attendeeEmail?: string;
  attendeeName?: string;
  bookingUid?: string;
  eventTypeIds?: string;
  eventTypeId?: string;
  afterStart?: string;
  beforeEnd?: string;
  sortStart?: "asc" | "desc";
  sortEnd?: "asc" | "desc";
  sortCreated?: "asc" | "desc";
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.status !== undefined) qp.status = params.status.join(",");
    if (params.attendeeEmail !== undefined) qp.attendeeEmail = params.attendeeEmail;
    if (params.attendeeName !== undefined) qp.attendeeName = params.attendeeName;
    if (params.bookingUid !== undefined) qp.bookingUid = params.bookingUid;
    if (params.eventTypeIds !== undefined) qp.eventTypeIds = params.eventTypeIds;
    if (params.eventTypeId !== undefined) qp.eventTypeId = params.eventTypeId;
    if (params.afterStart !== undefined) qp.afterStart = params.afterStart;
    if (params.beforeEnd !== undefined) qp.beforeEnd = params.beforeEnd;
    if (params.sortStart !== undefined) qp.sortStart = params.sortStart;
    if (params.sortEnd !== undefined) qp.sortEnd = params.sortEnd;
    if (params.sortCreated !== undefined) qp.sortCreated = params.sortCreated;
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`teams/${params.teamId}/bookings`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_team_bookings", err);
  }
}

export const createTeamEventTypeSchema = {
  teamId: z.number().int().describe("teamId"),
  lengthInMinutes: z.number(),
  lengthInMinutesOptions: z.array(z.string()).describe("If you want that user can choose between different lengths of the event you can specify them here. Must include the provided `lengthInMinutes`.").optional(),
  title: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  bookingFields: z.array(z.object({
    type: z.string().describe("only allowed value for type is `name`. Used for having 1 booking field for both first name and last name."),
    label: z.string(),
    placeholder: z.string(),
    disableOnPrefill: z.boolean().optional().describe("Disable this booking field if the URL contains query parameter with key equal to the slug and prefill it with the provided value.      For example, if URL contains query parameter `&name=bob`,      th"),
  })),
  disableGuests: z.boolean().describe("If true, person booking this event can't add guests via their emails.").optional(),
  slotInterval: z.number().describe("Number representing length of each slot when event is booked. By default it equal length of the event type.       If event length is 60 minutes then we would have slots 9AM, 10AM, 11AM etc. but if it ").optional(),
  minimumBookingNotice: z.number().describe("Minimum number of minutes before the event that a booking can be made.").optional(),
  beforeEventBuffer: z.number().describe("Extra time automatically blocked on your calendar before a meeting starts. This gives you time to prepare, review notes, or transition from your previous activity.").optional(),
  afterEventBuffer: z.number().describe("Extra time automatically blocked on your calendar after a meeting ends. This gives you time to wrap up, add notes, or decompress before your next commitment.").optional(),
  scheduleId: z.number().describe("If you want that this event has different schedule than user's default one you can specify it here.").optional(),
  bookingLimitsCount: z.object({
    day: z.number().optional().describe("The number of bookings per day"),
    week: z.number().optional().describe("The number of bookings per week"),
    month: z.number().optional().describe("The number of bookings per month"),
    year: z.number().optional().describe("The number of bookings per year"),
    disabled: z.boolean().optional(),
  }),
  bookerActiveBookingsLimit: z.object({
    maximumActiveBookings: z.number().optional().describe("The maximum number of active bookings a booker can have for this event type."),
    offerReschedule: z.boolean().optional().describe("Whether to offer rescheduling the last active booking to the chosen time slot when limit is reached."),
  }),
  onlyShowFirstAvailableSlot: z.boolean().describe("This will limit your availability for this event type to one slot per day, scheduled at the earliest available time.").optional(),
  bookingLimitsDuration: z.object({
    day: z.number().optional().describe("The duration of bookings per day (must be a multiple of 15)"),
    week: z.number().optional().describe("The duration of bookings per week (must be a multiple of 15)"),
    month: z.number().optional().describe("The duration of bookings per month (must be a multiple of 15)"),
    year: z.number().optional().describe("The duration of bookings per year (must be a multiple of 15)"),
  }),
  bookingWindow: z.object({
    type: z.enum(["businessDays", "calendarDays", "range"]).describe("Whether the window should be business days, calendar days or a range of dates"),
    value: z.number().describe("How many business day into the future can this event be booked"),
    rolling: z.boolean().optional().describe("Determines the behavior of the booking window:       - If **true**, the window is rolling. This means the number of available days will always be equal the specified 'value'          and adjust dynami"),
  }),
  offsetStart: z.number().describe("Offset timeslots shown to bookers by a specified number of minutes").optional(),
  bookerLayouts: z.object({
    defaultLayout: z.enum(["month", "week", "column"]),
    enabledLayouts: z.array(z.enum(["month", "week", "column"])).describe("Array of valid layouts - month, week or column"),
  }).optional(),
  confirmationPolicy: z.object({
    type: z.enum(["always", "time"]).describe("The policy that determines when confirmation is required"),
    noticeThreshold: z.object({
    unit: z.string().describe("The unit of time for the notice threshold (e.g., minutes, hours)"),
    count: z.number().describe("The time value for the notice threshold"),
  }).optional(),
    blockUnconfirmedBookingsInBooker: z.boolean().describe("Unconfirmed bookings still block calendar slots."),
  }),
  recurrence: z.object({
    interval: z.number().describe("Repeats every {count} week | month | year"),
    occurrences: z.number().describe("Repeats for a maximum of {count} events"),
    frequency: z.enum(["yearly", "monthly", "weekly"]),
  }).optional(),
  requiresBookerEmailVerification: z.boolean().optional(),
  hideCalendarNotes: z.boolean().optional(),
  lockTimeZoneToggleOnBookingPage: z.boolean().optional(),
  color: z.object({
    lightThemeHex: z.string().describe("Color used for event types in light theme"),
    darkThemeHex: z.string().describe("Color used for event types in dark theme"),
  }).optional(),
  seats: z.object({
    seatsPerTimeSlot: z.number().describe("Number of seats available per time slot"),
    showAttendeeInfo: z.boolean().describe("Show attendee information to other guests"),
    showAvailabilityCount: z.boolean().describe("Display the count of available seats"),
  }).optional(),
  customName: z.string().describe("Customizable event name with valid variables:       {Event type title}, {Organiser}, {Scheduler}, {Location}, {Organiser first name},       {Scheduler first name}, {Scheduler last name}, {Event durati").optional(),
  destinationCalendar: z.object({
    integration: z.string().describe("The integration type of the destination calendar. Refer to the /api/v2/calendars endpoint to retrieve the integration type of your connected calendars."),
    externalId: z.string().describe("The external ID of the destination calendar. Refer to the /api/v2/calendars endpoint to retrieve the external IDs of your connected calendars."),
  }).optional(),
  useDestinationCalendarEmail: z.boolean().optional(),
  hideCalendarEventDetails: z.boolean().optional(),
  successRedirectUrl: z.string().describe("A valid URL where the booker will redirect to, once the booking is completed successfully").optional(),
  hideOrganizerEmail: z.boolean().describe("Boolean to Hide organizer's email address from the booking screen, email notifications, and calendar events").optional(),
  calVideoSettings: z.object({
    disableRecordingForOrganizer: z.boolean().optional().describe("If true, the organizer will not be able to record the meeting"),
    disableRecordingForGuests: z.boolean().optional().describe("If true, the guests will not be able to record the meeting"),
    redirectUrlOnExit: z.record(z.unknown()).optional().describe("URL to which participants are redirected when they exit the call"),
    enableAutomaticRecordingForOrganizer: z.boolean().optional().describe("If true, enables the automatic recording for the event when organizer joins the call"),
    enableAutomaticTranscription: z.boolean().optional().describe("If true, enables the automatic transcription for the event whenever someone joins the call"),
    disableTranscriptionForGuests: z.boolean().optional().describe("If true, the guests will not be able to receive transcription of the meeting"),
    disableTranscriptionForOrganizer: z.boolean().optional().describe("If true, the organizer will not be able to receive transcription of the meeting"),
    sendTranscriptionEmails: z.boolean().optional().describe("Send emails with the transcription of the Cal Video after the meeting ends."),
  }),
  hidden: z.boolean().optional(),
  bookingRequiresAuthentication: z.boolean().describe("Boolean to require authentication for booking this event type via api. If true, only authenticated users who are the event-type owner or org/team admin/owner can book this event type.").optional(),
  disableCancelling: z.object({
    disabled: z.boolean().optional().describe("If true, cancelling is always disabled for this event type."),
  }),
  disableRescheduling: z.object({
    disabled: z.boolean().optional().describe("If true, rescheduling is always disabled for this event type."),
    minutesBefore: z.number().optional().describe("Disable rescheduling when less than the specified number of minutes before the meeting. If set, `disabled` should be false or undefined."),
  }),
  interfaceLanguage: z.enum(["", "en", "ar", "az", "bg", "bn", "ca", "cs", "da", "de", "el", "es", "es-419", "eu", "et", "fi", "fr", "he", "hu", "it", "ja", "km", "ko", "nl", "no", "pl", "pt-BR", "pt", "ro", "ru", "sk-SK", "sr", "sv", "tr", "uk", "vi", "zh-CN", "zh-TW"]).describe("Set preferred language for the booking interface. Use empty string for visitor's browser language (default).").optional(),
  allowReschedulingPastBookings: z.boolean().describe("Enabling this option allows for past events to be rescheduled.").optional(),
  allowReschedulingCancelledBookings: z.boolean().describe("When enabled, users will be able to create a new booking when trying to reschedule a cancelled booking.").optional(),
  showOptimizedSlots: z.boolean().describe("Arrange time slots to optimize availability.").optional(),
  schedulingType: z.enum(["collective", "roundRobin", "managed"]).describe("The scheduling type for the team event - collective, roundRobin or managed."),
  hosts: z.array(z.object({
    userId: z.number().describe("Which user is the host of this event"),
    mandatory: z.boolean().optional().describe("Only relevant for round robin event types. If true then the user must attend round robin event always."),
    priority: z.enum(["lowest", "low", "medium", "high", "highest"]).optional(),
  })),
  assignAllTeamMembers: z.boolean().describe("If true, all current and future team members will be assigned to this event type. Provide either assignAllTeamMembers or hosts but not both").optional(),
  locations: z.array(z.object({
    type: z.string().describe("only allowed value for type is `address`"),
    address: z.string(),
    public: z.boolean(),
  })).optional(),
  emailSettings: z.object({
    disableEmailsToAttendees: z.boolean().optional().describe("Disables all email communication to attendees for this event type, including booking confirmations, reminders, and cancellations. This DOES NOT include emails sent by custom email workflows."),
    disableEmailsToHosts: z.boolean().optional().describe("Disables all email communication to hosts for this event type, including booking confirmations, reminders, and cancellations. This DOES NOT include emails sent by custom email workflows."),
  }),
  rescheduleWithSameRoundRobinHost: z.boolean().describe("Rescheduled events will be assigned to the same host as initially scheduled.").optional(),
};

export async function createTeamEventType(params: {
  teamId: number;
  lengthInMinutes: number;
  lengthInMinutesOptions?: string[];
  title: string;
  slug: string;
  description?: string;
  bookingFields?: { type: string; label: string; placeholder: string; disableOnPrefill?: boolean }[];
  disableGuests?: boolean;
  slotInterval?: number;
  minimumBookingNotice?: number;
  beforeEventBuffer?: number;
  afterEventBuffer?: number;
  scheduleId?: number;
  bookingLimitsCount?: { day?: number; week?: number; month?: number; year?: number; disabled?: boolean };
  bookerActiveBookingsLimit?: { maximumActiveBookings?: number; offerReschedule?: boolean };
  onlyShowFirstAvailableSlot?: boolean;
  bookingLimitsDuration?: { day?: number; week?: number; month?: number; year?: number };
  bookingWindow?: { type: "businessDays" | "calendarDays" | "range"; value: number; rolling?: boolean };
  offsetStart?: number;
  bookerLayouts?: { defaultLayout: "month" | "week" | "column"; enabledLayouts: "month" | "week" | "column"[] };
  confirmationPolicy?: { type: "always" | "time"; noticeThreshold?: { unit: string; count: number }; blockUnconfirmedBookingsInBooker: boolean };
  recurrence?: { interval: number; occurrences: number; frequency: "yearly" | "monthly" | "weekly" };
  requiresBookerEmailVerification?: boolean;
  hideCalendarNotes?: boolean;
  lockTimeZoneToggleOnBookingPage?: boolean;
  color?: { lightThemeHex: string; darkThemeHex: string };
  seats?: { seatsPerTimeSlot: number; showAttendeeInfo: boolean; showAvailabilityCount: boolean };
  customName?: string;
  destinationCalendar?: { integration: string; externalId: string };
  useDestinationCalendarEmail?: boolean;
  hideCalendarEventDetails?: boolean;
  successRedirectUrl?: string;
  hideOrganizerEmail?: boolean;
  calVideoSettings?: { disableRecordingForOrganizer?: boolean; disableRecordingForGuests?: boolean; redirectUrlOnExit?: Record<string, unknown>; enableAutomaticRecordingForOrganizer?: boolean; enableAutomaticTranscription?: boolean; disableTranscriptionForGuests?: boolean; disableTranscriptionForOrganizer?: boolean; sendTranscriptionEmails?: boolean };
  hidden?: boolean;
  bookingRequiresAuthentication?: boolean;
  disableCancelling?: { disabled?: boolean };
  disableRescheduling?: { disabled?: boolean; minutesBefore?: number };
  interfaceLanguage?: "" | "en" | "ar" | "az" | "bg" | "bn" | "ca" | "cs" | "da" | "de" | "el" | "es" | "es-419" | "eu" | "et" | "fi" | "fr" | "he" | "hu" | "it" | "ja" | "km" | "ko" | "nl" | "no" | "pl" | "pt-BR" | "pt" | "ro" | "ru" | "sk-SK" | "sr" | "sv" | "tr" | "uk" | "vi" | "zh-CN" | "zh-TW";
  allowReschedulingPastBookings?: boolean;
  allowReschedulingCancelledBookings?: boolean;
  showOptimizedSlots?: boolean;
  schedulingType: "collective" | "roundRobin" | "managed";
  hosts?: { userId: number; mandatory?: boolean; priority?: "lowest" | "low" | "medium" | "high" | "highest" }[];
  assignAllTeamMembers?: boolean;
  locations?: { type: string; address: string; public: boolean }[];
  emailSettings?: { disableEmailsToAttendees?: boolean; disableEmailsToHosts?: boolean };
  rescheduleWithSameRoundRobinHost?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.lengthInMinutes = params.lengthInMinutes;
    if (params.lengthInMinutesOptions !== undefined) body.lengthInMinutesOptions = params.lengthInMinutesOptions;
    body.title = params.title;
    body.slug = params.slug;
    if (params.description !== undefined) body.description = params.description;
    if (params.bookingFields !== undefined) body.bookingFields = params.bookingFields;
    if (params.disableGuests !== undefined) body.disableGuests = params.disableGuests;
    if (params.slotInterval !== undefined) body.slotInterval = params.slotInterval;
    if (params.minimumBookingNotice !== undefined) body.minimumBookingNotice = params.minimumBookingNotice;
    if (params.beforeEventBuffer !== undefined) body.beforeEventBuffer = params.beforeEventBuffer;
    if (params.afterEventBuffer !== undefined) body.afterEventBuffer = params.afterEventBuffer;
    if (params.scheduleId !== undefined) body.scheduleId = params.scheduleId;
    if (params.bookingLimitsCount !== undefined) body.bookingLimitsCount = params.bookingLimitsCount;
    if (params.bookerActiveBookingsLimit !== undefined) body.bookerActiveBookingsLimit = params.bookerActiveBookingsLimit;
    if (params.onlyShowFirstAvailableSlot !== undefined) body.onlyShowFirstAvailableSlot = params.onlyShowFirstAvailableSlot;
    if (params.bookingLimitsDuration !== undefined) body.bookingLimitsDuration = params.bookingLimitsDuration;
    if (params.bookingWindow !== undefined) body.bookingWindow = params.bookingWindow;
    if (params.offsetStart !== undefined) body.offsetStart = params.offsetStart;
    if (params.bookerLayouts !== undefined) body.bookerLayouts = params.bookerLayouts;
    if (params.confirmationPolicy !== undefined) body.confirmationPolicy = params.confirmationPolicy;
    if (params.recurrence !== undefined) body.recurrence = params.recurrence;
    if (params.requiresBookerEmailVerification !== undefined) body.requiresBookerEmailVerification = params.requiresBookerEmailVerification;
    if (params.hideCalendarNotes !== undefined) body.hideCalendarNotes = params.hideCalendarNotes;
    if (params.lockTimeZoneToggleOnBookingPage !== undefined) body.lockTimeZoneToggleOnBookingPage = params.lockTimeZoneToggleOnBookingPage;
    if (params.color !== undefined) body.color = params.color;
    if (params.seats !== undefined) body.seats = params.seats;
    if (params.customName !== undefined) body.customName = params.customName;
    if (params.destinationCalendar !== undefined) body.destinationCalendar = params.destinationCalendar;
    if (params.useDestinationCalendarEmail !== undefined) body.useDestinationCalendarEmail = params.useDestinationCalendarEmail;
    if (params.hideCalendarEventDetails !== undefined) body.hideCalendarEventDetails = params.hideCalendarEventDetails;
    if (params.successRedirectUrl !== undefined) body.successRedirectUrl = params.successRedirectUrl;
    if (params.hideOrganizerEmail !== undefined) body.hideOrganizerEmail = params.hideOrganizerEmail;
    if (params.calVideoSettings !== undefined) body.calVideoSettings = params.calVideoSettings;
    if (params.hidden !== undefined) body.hidden = params.hidden;
    if (params.bookingRequiresAuthentication !== undefined) body.bookingRequiresAuthentication = params.bookingRequiresAuthentication;
    if (params.disableCancelling !== undefined) body.disableCancelling = params.disableCancelling;
    if (params.disableRescheduling !== undefined) body.disableRescheduling = params.disableRescheduling;
    if (params.interfaceLanguage !== undefined) body.interfaceLanguage = params.interfaceLanguage;
    if (params.allowReschedulingPastBookings !== undefined) body.allowReschedulingPastBookings = params.allowReschedulingPastBookings;
    if (params.allowReschedulingCancelledBookings !== undefined) body.allowReschedulingCancelledBookings = params.allowReschedulingCancelledBookings;
    if (params.showOptimizedSlots !== undefined) body.showOptimizedSlots = params.showOptimizedSlots;
    body.schedulingType = params.schedulingType;
    if (params.hosts !== undefined) body.hosts = params.hosts;
    if (params.assignAllTeamMembers !== undefined) body.assignAllTeamMembers = params.assignAllTeamMembers;
    if (params.locations !== undefined) body.locations = params.locations;
    if (params.emailSettings !== undefined) body.emailSettings = params.emailSettings;
    if (params.rescheduleWithSameRoundRobinHost !== undefined) body.rescheduleWithSameRoundRobinHost = params.rescheduleWithSameRoundRobinHost;
    const data = await calApi(`teams/${params.teamId}/event-types`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_team_event_type", err);
  }
}

export const getTeamEventTypesSchema = {
  teamId: z.number().int().describe("teamId"),
  eventSlug: z.string().describe("Slug of team event type to return.").optional(),
  hostsLimit: z.number().describe("Specifies the maximum number of hosts to include in the response. This limit helps optimize performance. If not provided, all Hosts will be fetched.").optional(),
  sortCreatedAt: z.enum(["asc", "desc"]).describe("Sort event types by creation date. When not provided, no explicit ordering is applied.").optional(),
};

export async function getTeamEventTypes(params: {
  teamId: number;
  eventSlug?: string;
  hostsLimit?: number;
  sortCreatedAt?: "asc" | "desc";
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.eventSlug !== undefined) qp.eventSlug = params.eventSlug;
    if (params.hostsLimit !== undefined) qp.hostsLimit = params.hostsLimit;
    if (params.sortCreatedAt !== undefined) qp.sortCreatedAt = params.sortCreatedAt;
    const data = await calApi(`teams/${params.teamId}/event-types`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_team_event_types", err);
  }
}

export const getTeamEventTypeSchema = {
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
};

export async function getTeamEventType(params: {
  teamId: number;
  eventTypeId: number;
}) {
  try {
    const data = await calApi(`teams/${params.teamId}/event-types/${params.eventTypeId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_team_event_type", err);
  }
}

export const updateTeamEventTypeSchema = {
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
  lengthInMinutes: z.number().optional(),
  lengthInMinutesOptions: z.array(z.string()).describe("If you want that user can choose between different lengths of the event you can specify them here. Must include the provided `lengthInMinutes`.").optional(),
  title: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  bookingFields: z.array(z.object({
    type: z.string().describe("only allowed value for type is `name`. Used for having 1 booking field for both first name and last name."),
    label: z.string(),
    placeholder: z.string(),
    disableOnPrefill: z.boolean().optional().describe("Disable this booking field if the URL contains query parameter with key equal to the slug and prefill it with the provided value.      For example, if URL contains query parameter `&name=bob`,      th"),
  })),
  disableGuests: z.boolean().describe("If true, person booking this event can't add guests via their emails.").optional(),
  slotInterval: z.number().describe("Number representing length of each slot when event is booked. By default it equal length of the event type.       If event length is 60 minutes then we would have slots 9AM, 10AM, 11AM etc. but if it ").optional(),
  minimumBookingNotice: z.number().describe("Minimum number of minutes before the event that a booking can be made.").optional(),
  beforeEventBuffer: z.number().describe("Extra time automatically blocked on your calendar before a meeting starts. This gives you time to prepare, review notes, or transition from your previous activity.").optional(),
  afterEventBuffer: z.number().describe("Extra time automatically blocked on your calendar after a meeting ends. This gives you time to wrap up, add notes, or decompress before your next commitment.").optional(),
  scheduleId: z.number().describe("If you want that this event has different schedule than user's default one you can specify it here.").optional(),
  bookingLimitsCount: z.object({
    day: z.number().optional().describe("The number of bookings per day"),
    week: z.number().optional().describe("The number of bookings per week"),
    month: z.number().optional().describe("The number of bookings per month"),
    year: z.number().optional().describe("The number of bookings per year"),
    disabled: z.boolean().optional(),
  }),
  bookerActiveBookingsLimit: z.object({
    maximumActiveBookings: z.number().optional().describe("The maximum number of active bookings a booker can have for this event type."),
    offerReschedule: z.boolean().optional().describe("Whether to offer rescheduling the last active booking to the chosen time slot when limit is reached."),
  }),
  onlyShowFirstAvailableSlot: z.boolean().describe("This will limit your availability for this event type to one slot per day, scheduled at the earliest available time.").optional(),
  bookingLimitsDuration: z.object({
    day: z.number().optional().describe("The duration of bookings per day (must be a multiple of 15)"),
    week: z.number().optional().describe("The duration of bookings per week (must be a multiple of 15)"),
    month: z.number().optional().describe("The duration of bookings per month (must be a multiple of 15)"),
    year: z.number().optional().describe("The duration of bookings per year (must be a multiple of 15)"),
  }),
  bookingWindow: z.object({
    type: z.enum(["businessDays", "calendarDays", "range"]).describe("Whether the window should be business days, calendar days or a range of dates"),
    value: z.number().describe("How many business day into the future can this event be booked"),
    rolling: z.boolean().optional().describe("Determines the behavior of the booking window:       - If **true**, the window is rolling. This means the number of available days will always be equal the specified 'value'          and adjust dynami"),
  }),
  offsetStart: z.number().describe("Offset timeslots shown to bookers by a specified number of minutes").optional(),
  bookerLayouts: z.object({
    defaultLayout: z.enum(["month", "week", "column"]),
    enabledLayouts: z.array(z.enum(["month", "week", "column"])).describe("Array of valid layouts - month, week or column"),
  }).optional(),
  confirmationPolicy: z.object({
    type: z.enum(["always", "time"]).describe("The policy that determines when confirmation is required"),
    noticeThreshold: z.object({
    unit: z.string().describe("The unit of time for the notice threshold (e.g., minutes, hours)"),
    count: z.number().describe("The time value for the notice threshold"),
  }).optional(),
    blockUnconfirmedBookingsInBooker: z.boolean().describe("Unconfirmed bookings still block calendar slots."),
  }),
  recurrence: z.object({
    interval: z.number().describe("Repeats every {count} week | month | year"),
    occurrences: z.number().describe("Repeats for a maximum of {count} events"),
    frequency: z.enum(["yearly", "monthly", "weekly"]),
  }).optional(),
  requiresBookerEmailVerification: z.boolean().optional(),
  hideCalendarNotes: z.boolean().optional(),
  lockTimeZoneToggleOnBookingPage: z.boolean().optional(),
  color: z.object({
    lightThemeHex: z.string().describe("Color used for event types in light theme"),
    darkThemeHex: z.string().describe("Color used for event types in dark theme"),
  }).optional(),
  seats: z.object({
    seatsPerTimeSlot: z.number().describe("Number of seats available per time slot"),
    showAttendeeInfo: z.boolean().describe("Show attendee information to other guests"),
    showAvailabilityCount: z.boolean().describe("Display the count of available seats"),
  }).optional(),
  customName: z.string().describe("Customizable event name with valid variables:       {Event type title}, {Organiser}, {Scheduler}, {Location}, {Organiser first name},       {Scheduler first name}, {Scheduler last name}, {Event durati").optional(),
  destinationCalendar: z.object({
    integration: z.string().describe("The integration type of the destination calendar. Refer to the /api/v2/calendars endpoint to retrieve the integration type of your connected calendars."),
    externalId: z.string().describe("The external ID of the destination calendar. Refer to the /api/v2/calendars endpoint to retrieve the external IDs of your connected calendars."),
  }).optional(),
  useDestinationCalendarEmail: z.boolean().optional(),
  hideCalendarEventDetails: z.boolean().optional(),
  successRedirectUrl: z.string().describe("A valid URL where the booker will redirect to, once the booking is completed successfully").optional(),
  hideOrganizerEmail: z.boolean().describe("Boolean to Hide organizer's email address from the booking screen, email notifications, and calendar events").optional(),
  calVideoSettings: z.object({
    disableRecordingForOrganizer: z.boolean().optional().describe("If true, the organizer will not be able to record the meeting"),
    disableRecordingForGuests: z.boolean().optional().describe("If true, the guests will not be able to record the meeting"),
    redirectUrlOnExit: z.record(z.unknown()).optional().describe("URL to which participants are redirected when they exit the call"),
    enableAutomaticRecordingForOrganizer: z.boolean().optional().describe("If true, enables the automatic recording for the event when organizer joins the call"),
    enableAutomaticTranscription: z.boolean().optional().describe("If true, enables the automatic transcription for the event whenever someone joins the call"),
    disableTranscriptionForGuests: z.boolean().optional().describe("If true, the guests will not be able to receive transcription of the meeting"),
    disableTranscriptionForOrganizer: z.boolean().optional().describe("If true, the organizer will not be able to receive transcription of the meeting"),
    sendTranscriptionEmails: z.boolean().optional().describe("Send emails with the transcription of the Cal Video after the meeting ends."),
  }),
  hidden: z.boolean().optional(),
  bookingRequiresAuthentication: z.boolean().describe("Boolean to require authentication for booking this event type via api. If true, only authenticated users who are the event-type owner or org/team admin/owner can book this event type.").optional(),
  disableCancelling: z.object({
    disabled: z.boolean().optional().describe("If true, cancelling is always disabled for this event type."),
  }),
  disableRescheduling: z.object({
    disabled: z.boolean().optional().describe("If true, rescheduling is always disabled for this event type."),
    minutesBefore: z.number().optional().describe("Disable rescheduling when less than the specified number of minutes before the meeting. If set, `disabled` should be false or undefined."),
  }),
  interfaceLanguage: z.enum(["", "en", "ar", "az", "bg", "bn", "ca", "cs", "da", "de", "el", "es", "es-419", "eu", "et", "fi", "fr", "he", "hu", "it", "ja", "km", "ko", "nl", "no", "pl", "pt-BR", "pt", "ro", "ru", "sk-SK", "sr", "sv", "tr", "uk", "vi", "zh-CN", "zh-TW"]).describe("Set preferred language for the booking interface. Use empty string for visitor's browser language (default).").optional(),
  allowReschedulingPastBookings: z.boolean().describe("Enabling this option allows for past events to be rescheduled.").optional(),
  allowReschedulingCancelledBookings: z.boolean().describe("When enabled, users will be able to create a new booking when trying to reschedule a cancelled booking.").optional(),
  showOptimizedSlots: z.boolean().describe("Arrange time slots to optimize availability.").optional(),
  schedulingType: z.enum(["collective", "roundRobin"]).describe("The scheduling type for the team event - collective or roundRobin. ❗If you change scheduling type you must also provide `hosts` or `assignAllTeamMembers` in the request body, otherwise the event type ").optional(),
  hosts: z.array(z.object({
    userId: z.number().describe("Which user is the host of this event"),
    mandatory: z.boolean().optional().describe("Only relevant for round robin event types. If true then the user must attend round robin event always."),
    priority: z.enum(["lowest", "low", "medium", "high", "highest"]).optional(),
  })),
  assignAllTeamMembers: z.boolean().describe("If true, all current and future team members will be assigned to this event type. Provide either assignAllTeamMembers or hosts but not both").optional(),
  locations: z.array(z.object({
    type: z.string().describe("only allowed value for type is `address`"),
    address: z.string(),
    public: z.boolean(),
  })).optional(),
  emailSettings: z.object({
    disableEmailsToAttendees: z.boolean().optional().describe("Disables all email communication to attendees for this event type, including booking confirmations, reminders, and cancellations. This DOES NOT include emails sent by custom email workflows."),
    disableEmailsToHosts: z.boolean().optional().describe("Disables all email communication to hosts for this event type, including booking confirmations, reminders, and cancellations. This DOES NOT include emails sent by custom email workflows."),
  }),
  rescheduleWithSameRoundRobinHost: z.boolean().describe("Rescheduled events will be assigned to the same host as initially scheduled.").optional(),
};

export async function updateTeamEventType(params: {
  teamId: number;
  eventTypeId: number;
  lengthInMinutes?: number;
  lengthInMinutesOptions?: string[];
  title?: string;
  slug?: string;
  description?: string;
  bookingFields?: { type: string; label: string; placeholder: string; disableOnPrefill?: boolean }[];
  disableGuests?: boolean;
  slotInterval?: number;
  minimumBookingNotice?: number;
  beforeEventBuffer?: number;
  afterEventBuffer?: number;
  scheduleId?: number;
  bookingLimitsCount?: { day?: number; week?: number; month?: number; year?: number; disabled?: boolean };
  bookerActiveBookingsLimit?: { maximumActiveBookings?: number; offerReschedule?: boolean };
  onlyShowFirstAvailableSlot?: boolean;
  bookingLimitsDuration?: { day?: number; week?: number; month?: number; year?: number };
  bookingWindow?: { type: "businessDays" | "calendarDays" | "range"; value: number; rolling?: boolean };
  offsetStart?: number;
  bookerLayouts?: { defaultLayout: "month" | "week" | "column"; enabledLayouts: "month" | "week" | "column"[] };
  confirmationPolicy?: { type: "always" | "time"; noticeThreshold?: { unit: string; count: number }; blockUnconfirmedBookingsInBooker: boolean };
  recurrence?: { interval: number; occurrences: number; frequency: "yearly" | "monthly" | "weekly" };
  requiresBookerEmailVerification?: boolean;
  hideCalendarNotes?: boolean;
  lockTimeZoneToggleOnBookingPage?: boolean;
  color?: { lightThemeHex: string; darkThemeHex: string };
  seats?: { seatsPerTimeSlot: number; showAttendeeInfo: boolean; showAvailabilityCount: boolean };
  customName?: string;
  destinationCalendar?: { integration: string; externalId: string };
  useDestinationCalendarEmail?: boolean;
  hideCalendarEventDetails?: boolean;
  successRedirectUrl?: string;
  hideOrganizerEmail?: boolean;
  calVideoSettings?: { disableRecordingForOrganizer?: boolean; disableRecordingForGuests?: boolean; redirectUrlOnExit?: Record<string, unknown>; enableAutomaticRecordingForOrganizer?: boolean; enableAutomaticTranscription?: boolean; disableTranscriptionForGuests?: boolean; disableTranscriptionForOrganizer?: boolean; sendTranscriptionEmails?: boolean };
  hidden?: boolean;
  bookingRequiresAuthentication?: boolean;
  disableCancelling?: { disabled?: boolean };
  disableRescheduling?: { disabled?: boolean; minutesBefore?: number };
  interfaceLanguage?: "" | "en" | "ar" | "az" | "bg" | "bn" | "ca" | "cs" | "da" | "de" | "el" | "es" | "es-419" | "eu" | "et" | "fi" | "fr" | "he" | "hu" | "it" | "ja" | "km" | "ko" | "nl" | "no" | "pl" | "pt-BR" | "pt" | "ro" | "ru" | "sk-SK" | "sr" | "sv" | "tr" | "uk" | "vi" | "zh-CN" | "zh-TW";
  allowReschedulingPastBookings?: boolean;
  allowReschedulingCancelledBookings?: boolean;
  showOptimizedSlots?: boolean;
  schedulingType?: "collective" | "roundRobin";
  hosts?: { userId: number; mandatory?: boolean; priority?: "lowest" | "low" | "medium" | "high" | "highest" }[];
  assignAllTeamMembers?: boolean;
  locations?: { type: string; address: string; public: boolean }[];
  emailSettings?: { disableEmailsToAttendees?: boolean; disableEmailsToHosts?: boolean };
  rescheduleWithSameRoundRobinHost?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.lengthInMinutes !== undefined) body.lengthInMinutes = params.lengthInMinutes;
    if (params.lengthInMinutesOptions !== undefined) body.lengthInMinutesOptions = params.lengthInMinutesOptions;
    if (params.title !== undefined) body.title = params.title;
    if (params.slug !== undefined) body.slug = params.slug;
    if (params.description !== undefined) body.description = params.description;
    if (params.bookingFields !== undefined) body.bookingFields = params.bookingFields;
    if (params.disableGuests !== undefined) body.disableGuests = params.disableGuests;
    if (params.slotInterval !== undefined) body.slotInterval = params.slotInterval;
    if (params.minimumBookingNotice !== undefined) body.minimumBookingNotice = params.minimumBookingNotice;
    if (params.beforeEventBuffer !== undefined) body.beforeEventBuffer = params.beforeEventBuffer;
    if (params.afterEventBuffer !== undefined) body.afterEventBuffer = params.afterEventBuffer;
    if (params.scheduleId !== undefined) body.scheduleId = params.scheduleId;
    if (params.bookingLimitsCount !== undefined) body.bookingLimitsCount = params.bookingLimitsCount;
    if (params.bookerActiveBookingsLimit !== undefined) body.bookerActiveBookingsLimit = params.bookerActiveBookingsLimit;
    if (params.onlyShowFirstAvailableSlot !== undefined) body.onlyShowFirstAvailableSlot = params.onlyShowFirstAvailableSlot;
    if (params.bookingLimitsDuration !== undefined) body.bookingLimitsDuration = params.bookingLimitsDuration;
    if (params.bookingWindow !== undefined) body.bookingWindow = params.bookingWindow;
    if (params.offsetStart !== undefined) body.offsetStart = params.offsetStart;
    if (params.bookerLayouts !== undefined) body.bookerLayouts = params.bookerLayouts;
    if (params.confirmationPolicy !== undefined) body.confirmationPolicy = params.confirmationPolicy;
    if (params.recurrence !== undefined) body.recurrence = params.recurrence;
    if (params.requiresBookerEmailVerification !== undefined) body.requiresBookerEmailVerification = params.requiresBookerEmailVerification;
    if (params.hideCalendarNotes !== undefined) body.hideCalendarNotes = params.hideCalendarNotes;
    if (params.lockTimeZoneToggleOnBookingPage !== undefined) body.lockTimeZoneToggleOnBookingPage = params.lockTimeZoneToggleOnBookingPage;
    if (params.color !== undefined) body.color = params.color;
    if (params.seats !== undefined) body.seats = params.seats;
    if (params.customName !== undefined) body.customName = params.customName;
    if (params.destinationCalendar !== undefined) body.destinationCalendar = params.destinationCalendar;
    if (params.useDestinationCalendarEmail !== undefined) body.useDestinationCalendarEmail = params.useDestinationCalendarEmail;
    if (params.hideCalendarEventDetails !== undefined) body.hideCalendarEventDetails = params.hideCalendarEventDetails;
    if (params.successRedirectUrl !== undefined) body.successRedirectUrl = params.successRedirectUrl;
    if (params.hideOrganizerEmail !== undefined) body.hideOrganizerEmail = params.hideOrganizerEmail;
    if (params.calVideoSettings !== undefined) body.calVideoSettings = params.calVideoSettings;
    if (params.hidden !== undefined) body.hidden = params.hidden;
    if (params.bookingRequiresAuthentication !== undefined) body.bookingRequiresAuthentication = params.bookingRequiresAuthentication;
    if (params.disableCancelling !== undefined) body.disableCancelling = params.disableCancelling;
    if (params.disableRescheduling !== undefined) body.disableRescheduling = params.disableRescheduling;
    if (params.interfaceLanguage !== undefined) body.interfaceLanguage = params.interfaceLanguage;
    if (params.allowReschedulingPastBookings !== undefined) body.allowReschedulingPastBookings = params.allowReschedulingPastBookings;
    if (params.allowReschedulingCancelledBookings !== undefined) body.allowReschedulingCancelledBookings = params.allowReschedulingCancelledBookings;
    if (params.showOptimizedSlots !== undefined) body.showOptimizedSlots = params.showOptimizedSlots;
    if (params.schedulingType !== undefined) body.schedulingType = params.schedulingType;
    if (params.hosts !== undefined) body.hosts = params.hosts;
    if (params.assignAllTeamMembers !== undefined) body.assignAllTeamMembers = params.assignAllTeamMembers;
    if (params.locations !== undefined) body.locations = params.locations;
    if (params.emailSettings !== undefined) body.emailSettings = params.emailSettings;
    if (params.rescheduleWithSameRoundRobinHost !== undefined) body.rescheduleWithSameRoundRobinHost = params.rescheduleWithSameRoundRobinHost;
    const data = await calApi(`teams/${params.teamId}/event-types/${params.eventTypeId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_team_event_type", err);
  }
}

export const deleteTeamEventTypeSchema = {
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
};

export async function deleteTeamEventType(params: {
  teamId: number;
  eventTypeId: number;
}) {
  try {
    const data = await calApi(`teams/${params.teamId}/event-types/${params.eventTypeId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_team_event_type", err);
  }
}

export const createTeamPhoneCallSchema = {
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
  yourPhoneNumber: z.string().describe("Your phone number"),
  numberToCall: z.string().describe("Number to call"),
  calApiKey: z.string().describe("CAL API Key"),
  enabled: z.record(z.unknown()).describe("Enabled status"),
  templateType: z.enum(["CHECK_IN_APPOINTMENT", "CUSTOM_TEMPLATE"]).describe("Template type"),
  schedulerName: z.string().describe("Scheduler name").optional(),
  guestName: z.string().describe("Guest name").optional(),
  guestEmail: z.string().describe("Guest email").optional(),
  guestCompany: z.string().describe("Guest company").optional(),
  beginMessage: z.string().describe("Begin message").optional(),
  generalPrompt: z.string().describe("General prompt").optional(),
};

export async function createTeamPhoneCall(params: {
  teamId: number;
  eventTypeId: number;
  yourPhoneNumber: string;
  numberToCall: string;
  calApiKey: string;
  enabled: Record<string, unknown>;
  templateType: "CHECK_IN_APPOINTMENT" | "CUSTOM_TEMPLATE";
  schedulerName?: string;
  guestName?: string;
  guestEmail?: string;
  guestCompany?: string;
  beginMessage?: string;
  generalPrompt?: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.yourPhoneNumber = params.yourPhoneNumber;
    body.numberToCall = params.numberToCall;
    body.calApiKey = params.calApiKey;
    body.enabled = params.enabled;
    body.templateType = params.templateType;
    if (params.schedulerName !== undefined) body.schedulerName = params.schedulerName;
    if (params.guestName !== undefined) body.guestName = params.guestName;
    if (params.guestEmail !== undefined) body.guestEmail = params.guestEmail;
    if (params.guestCompany !== undefined) body.guestCompany = params.guestCompany;
    if (params.beginMessage !== undefined) body.beginMessage = params.beginMessage;
    if (params.generalPrompt !== undefined) body.generalPrompt = params.generalPrompt;
    const data = await calApi(`teams/${params.teamId}/event-types/${params.eventTypeId}/create-phone-call`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_team_phone_call", err);
  }
}

export const createTeamEventTypeWebhookSchema = {
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
  payloadTemplate: z.string().describe("The template of the payload that will be sent to the subscriberUrl, check cal.com/docs/core-features/webhooks for more information").optional(),
  active: z.boolean(),
  subscriberUrl: z.string(),
  triggers: z.array(z.enum(["BOOKING_CREATED", "BOOKING_PAYMENT_INITIATED", "BOOKING_PAID", "BOOKING_RESCHEDULED", "BOOKING_REQUESTED", "BOOKING_CANCELLED", "BOOKING_REJECTED", "BOOKING_NO_SHOW_UPDATED", "FORM_SUBMITTED", "MEETING_ENDED", "MEETING_STARTED", "RECORDING_READY", "INSTANT_MEETING", "RECORDING_TRANSCRIPTION_GENERATED", "OOO_CREATED", "AFTER_HOSTS_CAL_VIDEO_NO_SHOW", "AFTER_GUESTS_CAL_VIDEO_NO_SHOW", "FORM_SUBMITTED_NO_EVENT", "ROUTING_FORM_FALLBACK_HIT", "DELEGATION_CREDENTIAL_ERROR", "WRONG_ASSIGNMENT_REPORT"])),
  secret: z.string().optional(),
  version: z.enum(["2021-10-20"]).describe("The version of the webhook").optional(),
};

export async function createTeamEventTypeWebhook(params: {
  teamId: number;
  eventTypeId: number;
  payloadTemplate?: string;
  active: boolean;
  subscriberUrl: string;
  triggers: ("BOOKING_CREATED" | "BOOKING_PAYMENT_INITIATED" | "BOOKING_PAID" | "BOOKING_RESCHEDULED" | "BOOKING_REQUESTED" | "BOOKING_CANCELLED" | "BOOKING_REJECTED" | "BOOKING_NO_SHOW_UPDATED" | "FORM_SUBMITTED" | "MEETING_ENDED" | "MEETING_STARTED" | "RECORDING_READY" | "INSTANT_MEETING" | "RECORDING_TRANSCRIPTION_GENERATED" | "OOO_CREATED" | "AFTER_HOSTS_CAL_VIDEO_NO_SHOW" | "AFTER_GUESTS_CAL_VIDEO_NO_SHOW" | "FORM_SUBMITTED_NO_EVENT" | "ROUTING_FORM_FALLBACK_HIT" | "DELEGATION_CREDENTIAL_ERROR" | "WRONG_ASSIGNMENT_REPORT")[];
  secret?: string;
  version?: "2021-10-20";
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.payloadTemplate !== undefined) body.payloadTemplate = params.payloadTemplate;
    body.active = params.active;
    body.subscriberUrl = params.subscriberUrl;
    body.triggers = params.triggers;
    if (params.secret !== undefined) body.secret = params.secret;
    if (params.version !== undefined) body.version = params.version;
    const data = await calApi(`teams/${params.teamId}/event-types/${params.eventTypeId}/webhooks`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_team_event_type_webhook", err);
  }
}

export const getTeamEventTypeWebhooksSchema = {
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getTeamEventTypeWebhooks(params: {
  teamId: number;
  eventTypeId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`teams/${params.teamId}/event-types/${params.eventTypeId}/webhooks`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_team_event_type_webhooks", err);
  }
}

export const deleteAllTeamEventTypeWebhooksSchema = {
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
};

export async function deleteAllTeamEventTypeWebhooks(params: {
  teamId: number;
  eventTypeId: number;
}) {
  try {
    const data = await calApi(`teams/${params.teamId}/event-types/${params.eventTypeId}/webhooks`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_all_team_event_type_webhooks", err);
  }
}

export const updateTeamEventTypeWebhookSchema = {
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
  webhookId: z.string().describe("webhookId"),
  payloadTemplate: z.string().describe("The template of the payload that will be sent to the subscriberUrl, check cal.com/docs/core-features/webhooks for more information").optional(),
  active: z.boolean().optional(),
  subscriberUrl: z.string().optional(),
  triggers: z.array(z.enum(["BOOKING_CREATED", "BOOKING_PAYMENT_INITIATED", "BOOKING_PAID", "BOOKING_RESCHEDULED", "BOOKING_REQUESTED", "BOOKING_CANCELLED", "BOOKING_REJECTED", "BOOKING_NO_SHOW_UPDATED", "FORM_SUBMITTED", "MEETING_ENDED", "MEETING_STARTED", "RECORDING_READY", "INSTANT_MEETING", "RECORDING_TRANSCRIPTION_GENERATED", "OOO_CREATED", "AFTER_HOSTS_CAL_VIDEO_NO_SHOW", "AFTER_GUESTS_CAL_VIDEO_NO_SHOW", "FORM_SUBMITTED_NO_EVENT", "ROUTING_FORM_FALLBACK_HIT", "DELEGATION_CREDENTIAL_ERROR", "WRONG_ASSIGNMENT_REPORT"])).optional(),
  secret: z.string().optional(),
  version: z.enum(["2021-10-20"]).describe("The version of the webhook").optional(),
};

export async function updateTeamEventTypeWebhook(params: {
  teamId: number;
  eventTypeId: number;
  webhookId: string;
  payloadTemplate?: string;
  active?: boolean;
  subscriberUrl?: string;
  triggers?: ("BOOKING_CREATED" | "BOOKING_PAYMENT_INITIATED" | "BOOKING_PAID" | "BOOKING_RESCHEDULED" | "BOOKING_REQUESTED" | "BOOKING_CANCELLED" | "BOOKING_REJECTED" | "BOOKING_NO_SHOW_UPDATED" | "FORM_SUBMITTED" | "MEETING_ENDED" | "MEETING_STARTED" | "RECORDING_READY" | "INSTANT_MEETING" | "RECORDING_TRANSCRIPTION_GENERATED" | "OOO_CREATED" | "AFTER_HOSTS_CAL_VIDEO_NO_SHOW" | "AFTER_GUESTS_CAL_VIDEO_NO_SHOW" | "FORM_SUBMITTED_NO_EVENT" | "ROUTING_FORM_FALLBACK_HIT" | "DELEGATION_CREDENTIAL_ERROR" | "WRONG_ASSIGNMENT_REPORT")[];
  secret?: string;
  version?: "2021-10-20";
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.payloadTemplate !== undefined) body.payloadTemplate = params.payloadTemplate;
    if (params.active !== undefined) body.active = params.active;
    if (params.subscriberUrl !== undefined) body.subscriberUrl = params.subscriberUrl;
    if (params.triggers !== undefined) body.triggers = params.triggers;
    if (params.secret !== undefined) body.secret = params.secret;
    if (params.version !== undefined) body.version = params.version;
    const data = await calApi(`teams/${params.teamId}/event-types/${params.eventTypeId}/webhooks/${params.webhookId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_team_event_type_webhook", err);
  }
}

export const getTeamEventTypeWebhookSchema = {
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
  webhookId: z.string().describe("webhookId"),
};

export async function getTeamEventTypeWebhook(params: {
  teamId: number;
  eventTypeId: number;
  webhookId: string;
}) {
  try {
    const data = await calApi(`teams/${params.teamId}/event-types/${params.eventTypeId}/webhooks/${params.webhookId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_team_event_type_webhook", err);
  }
}

export const deleteTeamEventTypeWebhookSchema = {
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
  webhookId: z.string().describe("webhookId"),
};

export async function deleteTeamEventTypeWebhook(params: {
  teamId: number;
  eventTypeId: number;
  webhookId: string;
}) {
  try {
    const data = await calApi(`teams/${params.teamId}/event-types/${params.eventTypeId}/webhooks/${params.webhookId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_team_event_type_webhook", err);
  }
}

export const createTeamInviteSchema = {
  teamId: z.number().int().describe("teamId"),
};

export async function createTeamInvite(params: {
  teamId: number;
}) {
  try {
    const data = await calApi(`teams/${params.teamId}/invite`, { method: "POST", body: {} });
    return ok(data);
  } catch (err) {
    return handleError("create_team_invite", err);
  }
}

export const createTeamMembershipSchema = {
  teamId: z.number().int().describe("teamId"),
  userId: z.number(),
  accepted: z.boolean().optional(),
  role: z.enum(["MEMBER", "OWNER", "ADMIN"]).optional(),
  disableImpersonation: z.boolean().optional(),
};

export async function createTeamMembership(params: {
  teamId: number;
  userId: number;
  accepted?: boolean;
  role?: "MEMBER" | "OWNER" | "ADMIN";
  disableImpersonation?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.userId = params.userId;
    if (params.accepted !== undefined) body.accepted = params.accepted;
    if (params.role !== undefined) body.role = params.role;
    if (params.disableImpersonation !== undefined) body.disableImpersonation = params.disableImpersonation;
    const data = await calApi(`teams/${params.teamId}/memberships`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_team_membership", err);
  }
}

export const getTeamMembershipsSchema = {
  teamId: z.number().int().describe("teamId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
  emails: z.array(z.string()).describe("Filter team memberships by email addresses. If you want to filter by multiple emails, separate them with a comma (max 20 emails for performance).").optional(),
};

export async function getTeamMemberships(params: {
  teamId: number;
  take?: number;
  skip?: number;
  emails?: string[];
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.emails !== undefined) qp.emails = params.emails.join(",");
    const data = await calApi(`teams/${params.teamId}/memberships`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_team_memberships", err);
  }
}

export const getTeamMembershipSchema = {
  teamId: z.number().int().describe("teamId"),
  membershipId: z.number().int().describe("membershipId"),
};

export async function getTeamMembership(params: {
  teamId: number;
  membershipId: number;
}) {
  try {
    const data = await calApi(`teams/${params.teamId}/memberships/${params.membershipId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_team_membership", err);
  }
}

export const updateTeamMembershipSchema = {
  teamId: z.number().int().describe("teamId"),
  membershipId: z.number().int().describe("membershipId"),
  accepted: z.boolean().optional(),
  role: z.enum(["MEMBER", "OWNER", "ADMIN"]).optional(),
  disableImpersonation: z.boolean().optional(),
};

export async function updateTeamMembership(params: {
  teamId: number;
  membershipId: number;
  accepted?: boolean;
  role?: "MEMBER" | "OWNER" | "ADMIN";
  disableImpersonation?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.accepted !== undefined) body.accepted = params.accepted;
    if (params.role !== undefined) body.role = params.role;
    if (params.disableImpersonation !== undefined) body.disableImpersonation = params.disableImpersonation;
    const data = await calApi(`teams/${params.teamId}/memberships/${params.membershipId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_team_membership", err);
  }
}

export const deleteTeamMembershipSchema = {
  teamId: z.number().int().describe("teamId"),
  membershipId: z.number().int().describe("membershipId"),
};

export async function deleteTeamMembership(params: {
  teamId: number;
  membershipId: number;
}) {
  try {
    const data = await calApi(`teams/${params.teamId}/memberships/${params.membershipId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_team_membership", err);
  }
}

export const getTeamSchedulesSchema = {
  teamId: z.number().int().describe("teamId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getTeamSchedules(params: {
  teamId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`teams/${params.teamId}/schedules`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_team_schedules", err);
  }
}

export const requestTeamEmailVerificationSchema = {
  teamId: z.number().int().describe("teamId"),
  email: z.string().describe("Email to verify."),
};

export async function requestTeamEmailVerification(params: {
  teamId: number;
  email: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.email = params.email;
    const data = await calApi(`teams/${params.teamId}/verified-resources/emails/verification-code/request`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("request_team_email_verification", err);
  }
}

export const requestTeamPhoneVerificationSchema = {
  teamId: z.number().int().describe("teamId"),
  phone: z.string().describe("Phone number to verify."),
};

export async function requestTeamPhoneVerification(params: {
  teamId: number;
  phone: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.phone = params.phone;
    const data = await calApi(`teams/${params.teamId}/verified-resources/phones/verification-code/request`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("request_team_phone_verification", err);
  }
}

export const verifyTeamEmailSchema = {
  teamId: z.number().int().describe("teamId"),
  email: z.string().describe("Email to verify."),
  code: z.string().describe("verification code sent to the email to verify"),
};

export async function verifyTeamEmail(params: {
  teamId: number;
  email: string;
  code: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.email = params.email;
    body.code = params.code;
    const data = await calApi(`teams/${params.teamId}/verified-resources/emails/verification-code/verify`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("verify_team_email", err);
  }
}

export const verifyTeamPhoneSchema = {
  teamId: z.number().int().describe("teamId"),
  phone: z.string().describe("phone number to verify."),
  code: z.string().describe("verification code sent to the phone number to verify"),
};

export async function verifyTeamPhone(params: {
  teamId: number;
  phone: string;
  code: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.phone = params.phone;
    body.code = params.code;
    const data = await calApi(`teams/${params.teamId}/verified-resources/phones/verification-code/verify`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("verify_team_phone", err);
  }
}

export const getTeamVerifiedEmailsSchema = {
  teamId: z.number().int().describe("teamId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getTeamVerifiedEmails(params: {
  teamId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`teams/${params.teamId}/verified-resources/emails`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_team_verified_emails", err);
  }
}

export const getTeamVerifiedPhonesSchema = {
  teamId: z.number().int().describe("teamId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getTeamVerifiedPhones(params: {
  teamId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`teams/${params.teamId}/verified-resources/phones`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_team_verified_phones", err);
  }
}

export const getTeamVerifiedEmailSchema = {
  teamId: z.number().int().describe("teamId"),
  id: z.number().int().describe("id"),
};

export async function getTeamVerifiedEmail(params: {
  teamId: number;
  id: number;
}) {
  try {
    const data = await calApi(`teams/${params.teamId}/verified-resources/emails/${params.id}`);
    return ok(data);
  } catch (err) {
    return handleError("get_team_verified_email", err);
  }
}

export const getTeamVerifiedPhoneSchema = {
  teamId: z.number().int().describe("teamId"),
  id: z.number().int().describe("id"),
};

export async function getTeamVerifiedPhone(params: {
  teamId: number;
  id: number;
}) {
  try {
    const data = await calApi(`teams/${params.teamId}/verified-resources/phones/${params.id}`);
    return ok(data);
  } catch (err) {
    return handleError("get_team_verified_phone", err);
  }
}
