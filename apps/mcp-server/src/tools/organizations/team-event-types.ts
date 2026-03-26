import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { CalApiError } from "../../utils/errors.js";

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

export const createOrgTeamEventTypeSchema = {
  orgId: z.number().int().describe("orgId"),
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

export async function createOrgTeamEventType(params: {
  orgId: number;
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
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/event-types`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_team_event_type", err);
  }
}

export const getOrgTeamEventTypesSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  eventSlug: z.string().describe("Slug of team event type to return.").optional(),
  hostsLimit: z.number().describe("Specifies the maximum number of hosts to include in the response. This limit helps optimize performance. If not provided, all Hosts will be fetched.").optional(),
  sortCreatedAt: z.enum(["asc", "desc"]).describe("Sort event types by creation date. When not provided, no explicit ordering is applied.").optional(),
};

export async function getOrgTeamEventTypes(params: {
  orgId: number;
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
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/event-types`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_event_types", err);
  }
}

export const getOrgTeamEventTypeSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
};

export async function getOrgTeamEventType(params: {
  orgId: number;
  teamId: number;
  eventTypeId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/event-types/${params.eventTypeId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_event_type", err);
  }
}

export const updateOrgTeamEventTypeSchema = {
  orgId: z.number().int().describe("orgId"),
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

export async function updateOrgTeamEventType(params: {
  orgId: number;
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
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/event-types/${params.eventTypeId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_team_event_type", err);
  }
}

export const deleteOrgTeamEventTypeSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
};

export async function deleteOrgTeamEventType(params: {
  orgId: number;
  teamId: number;
  eventTypeId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/event-types/${params.eventTypeId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_team_event_type", err);
  }
}

export const createOrgTeamPhoneCallSchema = {
  orgId: z.number().int().describe("orgId"),
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

export async function createOrgTeamPhoneCall(params: {
  orgId: number;
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
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/event-types/${params.eventTypeId}/create-phone-call`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_team_phone_call", err);
  }
}

export const createOrgTeamEtPrivateLinkSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
  expiresAt: z.string().describe("Expiration date for time-based links").optional(),
  maxUsageCount: z.number().describe("Maximum number of times the link can be used. If omitted and expiresAt is not provided, defaults to 1 (one time use).").optional(),
};

export async function createOrgTeamEtPrivateLink(params: {
  orgId: number;
  teamId: number;
  eventTypeId: number;
  expiresAt?: string;
  maxUsageCount?: number;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.expiresAt !== undefined) body.expiresAt = params.expiresAt;
    if (params.maxUsageCount !== undefined) body.maxUsageCount = params.maxUsageCount;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/event-types/${params.eventTypeId}/private-links`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_team_et_private_link", err);
  }
}

export const getOrgTeamEtPrivateLinksSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
};

export async function getOrgTeamEtPrivateLinks(params: {
  orgId: number;
  teamId: number;
  eventTypeId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/event-types/${params.eventTypeId}/private-links`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_et_private_links", err);
  }
}

export const updateOrgTeamEtPrivateLinkSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
  linkId: z.string().describe("linkId"),
};

export async function updateOrgTeamEtPrivateLink(params: {
  orgId: number;
  teamId: number;
  eventTypeId: number;
  linkId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/event-types/${params.eventTypeId}/private-links/${params.linkId}`, { method: "PATCH", body: {} });
    return ok(data);
  } catch (err) {
    return handleError("update_org_team_et_private_link", err);
  }
}

export const deleteOrgTeamEtPrivateLinkSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  eventTypeId: z.number().int().describe("eventTypeId"),
  linkId: z.string().describe("linkId"),
};

export async function deleteOrgTeamEtPrivateLink(params: {
  orgId: number;
  teamId: number;
  eventTypeId: number;
  linkId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/event-types/${params.eventTypeId}/private-links/${params.linkId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_team_et_private_link", err);
  }
}
