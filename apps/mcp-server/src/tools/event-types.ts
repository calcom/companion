import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const getEventTypesSchema = {
  username: z
    .string()
    .optional()
    .describe("Username of the person whose event types you want to list. Omit to list the authenticated user's event types."),
  eventSlug: z
    .string()
    .optional()
    .describe("Slug of a specific event type to return. Must be used together with username."),
  usernames: z
    .string()
    .optional()
    .describe("Comma-separated usernames for fetching a dynamic group event type (e.g. 'alice,bob')."),
  orgSlug: z.string().optional().describe("Organization slug to filter by."),
  orgId: z.number().optional().describe("Organization ID to filter by (alternative to orgSlug)."),
  sortCreatedAt: z.enum(["asc", "desc"]).optional().describe("Sort event types by creation date."),
};

export async function getEventTypes(params: {
  username?: string;
  eventSlug?: string;
  usernames?: string;
  orgSlug?: string;
  orgId?: number;
  sortCreatedAt?: "asc" | "desc";
}) {
  try {
    const qp: Record<string, string | number | undefined> = {};
    if (params.username !== undefined) qp.username = params.username;
    if (params.eventSlug !== undefined) qp.eventSlug = params.eventSlug;
    if (params.usernames !== undefined) qp.usernames = params.usernames;
    if (params.orgSlug !== undefined) qp.orgSlug = params.orgSlug;
    if (params.orgId !== undefined) qp.orgId = params.orgId;
    if (params.sortCreatedAt !== undefined) qp.sortCreatedAt = params.sortCreatedAt;
    const data = await calApi("event-types", { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_event_types", err);
  }
}

export const getEventTypeSchema = {
  eventTypeId: z.number().int().describe("Event type ID. Use get_event_types to find this."),
};

export async function getEventType(params: { eventTypeId: number }) {
  try {
    const data = await calApi(`event-types/${params.eventTypeId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_event_type", err);
  }
}

export const createEventTypeSchema = {
  title: z.string().describe("Event type title"),
  slug: z.string().describe("URL-friendly slug (e.g. '30min')"),
  lengthInMinutes: z.number().int().positive().describe("Duration in minutes"),
  lengthInMinutesOptions: z.array(z.number().int().positive()).optional().describe("Multiple duration options the attendee can choose from (e.g. [15, 30, 60]). If provided, the booker picks their preferred duration."),
  description: z.string().optional().describe("Description shown on the booking page"),
  locations: z
    .array(z.record(z.unknown()))
    .optional()
    .describe("Locations where the event takes place. If not provided, Cal Video is used. Each element is a location object (e.g. {type: 'inPerson', address: '...'}). Note: setting a conferencing app as location requires the app to already be installed."),
  bookingFields: z
    .array(z.record(z.unknown()))
    .optional()
    .describe("Custom fields added to the booking form. Each object defines a field with properties like name, type, label, required, etc."),
  disableGuests: z.boolean().optional().describe("If true, bookers cannot add guest emails."),
  slotInterval: z.number().int().optional().describe("Length of each slot in minutes. Defaults to the event duration."),
  minimumBookingNotice: z.number().int().optional().describe("Minimum minutes before the event that a booking can be made."),
  beforeEventBuffer: z.number().int().optional().describe("Minutes blocked on calendar before the meeting starts."),
  afterEventBuffer: z.number().int().optional().describe("Minutes blocked on calendar after the meeting ends."),
  scheduleId: z.number().int().optional().describe("Use a specific schedule instead of the user's default. Use get_schedules to find schedule IDs."),
  recurrence: z
    .record(z.unknown())
    .optional()
    .describe("Recurrence settings to create a recurring event type (e.g. {frequency: 'weekly', interval: 1, occurrences: 12})."),
  confirmationPolicy: z
    .record(z.unknown())
    .optional()
    .describe("Manual confirmation policy. Controls whether bookings require host confirmation."),
  requiresBookerEmailVerification: z.boolean().optional().describe("Whether booker must verify their email before the booking is confirmed."),
  hideCalendarNotes: z.boolean().optional().describe("Hide calendar notes from the booking."),
  lockTimeZoneToggleOnBookingPage: z.boolean().optional().describe("Lock the timezone on the booking page."),
  seats: z
    .record(z.unknown())
    .optional()
    .describe("Enable seated events. Object with seatsPerTimeSlot and other seat settings."),
  customName: z.string().optional().describe("Custom event name template with variables: {Event type title}, {Organiser}, {Scheduler}, {Location}."),
  successRedirectUrl: z.string().optional().describe("URL to redirect the booker to after a successful booking."),
  hidden: z.boolean().optional().describe("Whether the event type is hidden from the public profile."),
  offsetStart: z.number().int().optional().describe("Offset timeslots shown to bookers by a specified number of minutes."),
  onlyShowFirstAvailableSlot: z.boolean().optional().describe("Limit availability to one slot per day (the earliest available)."),
  bookingLimitsCount: z.object({
    day: z.number().int().min(1).optional().describe("Max bookings per day"),
    week: z.number().int().min(1).optional().describe("Max bookings per week"),
    month: z.number().int().min(1).optional().describe("Max bookings per month"),
    year: z.number().int().min(1).optional().describe("Max bookings per year"),
  }).optional().describe("Limit how many times this event can be booked per period (e.g. {day: 2, week: 5})."),
  bookingWindow: z.object({
    type: z.enum(["businessDays", "calendarDays", "range"]).describe("Window type"),
    value: z.union([z.number(), z.array(z.string())]).describe("Number of days (for businessDays/calendarDays) or date range array ['2030-09-05', '2030-09-09'] (for range)"),
    rolling: z.boolean().optional().describe("If true the window rolls forward keeping 'value' days available. Only for businessDays/calendarDays."),
  }).optional().describe("Limit how far in the future this event can be booked."),
  destinationCalendar: z.object({
    integration: z.string().describe("Integration type (e.g. 'google_calendar'). Use get_connected_calendars to find this."),
    externalId: z.string().describe("External calendar ID (e.g. email for Google Calendar). Use get_connected_calendars to find this."),
  }).optional().describe("Which external calendar new bookings are added to."),
};

export async function createEventType(params: {
  title: string;
  slug: string;
  lengthInMinutes: number;
  lengthInMinutesOptions?: number[];
  description?: string;
  locations?: Record<string, unknown>[];
  bookingFields?: Record<string, unknown>[];
  disableGuests?: boolean;
  slotInterval?: number;
  minimumBookingNotice?: number;
  beforeEventBuffer?: number;
  afterEventBuffer?: number;
  scheduleId?: number;
  recurrence?: Record<string, unknown>;
  confirmationPolicy?: Record<string, unknown>;
  requiresBookerEmailVerification?: boolean;
  hideCalendarNotes?: boolean;
  lockTimeZoneToggleOnBookingPage?: boolean;
  seats?: Record<string, unknown>;
  customName?: string;
  successRedirectUrl?: string;
  hidden?: boolean;
  offsetStart?: number;
  onlyShowFirstAvailableSlot?: boolean;
  bookingLimitsCount?: { day?: number; week?: number; month?: number; year?: number };
  bookingWindow?: { type: string; value: number | string[]; rolling?: boolean };
  destinationCalendar?: { integration: string; externalId: string };
}) {
  try {
    const body: Record<string, unknown> = {
      title: params.title,
      slug: params.slug,
      lengthInMinutes: params.lengthInMinutes,
    };
    if (params.lengthInMinutesOptions !== undefined) body.lengthInMinutesOptions = params.lengthInMinutesOptions;
    if (params.description !== undefined) body.description = params.description;
    if (params.locations !== undefined) body.locations = params.locations;
    if (params.bookingFields !== undefined) body.bookingFields = params.bookingFields;
    if (params.disableGuests !== undefined) body.disableGuests = params.disableGuests;
    if (params.slotInterval !== undefined) body.slotInterval = params.slotInterval;
    if (params.minimumBookingNotice !== undefined) body.minimumBookingNotice = params.minimumBookingNotice;
    if (params.beforeEventBuffer !== undefined) body.beforeEventBuffer = params.beforeEventBuffer;
    if (params.afterEventBuffer !== undefined) body.afterEventBuffer = params.afterEventBuffer;
    if (params.scheduleId !== undefined) body.scheduleId = params.scheduleId;
    if (params.recurrence !== undefined) body.recurrence = params.recurrence;
    if (params.confirmationPolicy !== undefined) body.confirmationPolicy = params.confirmationPolicy;
    if (params.requiresBookerEmailVerification !== undefined) body.requiresBookerEmailVerification = params.requiresBookerEmailVerification;
    if (params.hideCalendarNotes !== undefined) body.hideCalendarNotes = params.hideCalendarNotes;
    if (params.lockTimeZoneToggleOnBookingPage !== undefined) body.lockTimeZoneToggleOnBookingPage = params.lockTimeZoneToggleOnBookingPage;
    if (params.seats !== undefined) body.seats = params.seats;
    if (params.customName !== undefined) body.customName = params.customName;
    if (params.successRedirectUrl !== undefined) body.successRedirectUrl = params.successRedirectUrl;
    if (params.hidden !== undefined) body.hidden = params.hidden;
    if (params.offsetStart !== undefined) body.offsetStart = params.offsetStart;
    if (params.onlyShowFirstAvailableSlot !== undefined) body.onlyShowFirstAvailableSlot = params.onlyShowFirstAvailableSlot;
    if (params.bookingLimitsCount !== undefined) body.bookingLimitsCount = params.bookingLimitsCount;
    if (params.bookingWindow !== undefined) body.bookingWindow = params.bookingWindow;
    if (params.destinationCalendar !== undefined) body.destinationCalendar = params.destinationCalendar;
    const data = await calApi("event-types", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_event_type", err);
  }
}

export const updateEventTypeSchema = {
  eventTypeId: z.number().int().describe("Event type ID to update. Use get_event_types to find this."),
  title: z.string().optional().describe("New title"),
  slug: z.string().optional().describe("New URL-friendly slug"),
  lengthInMinutes: z.number().int().positive().optional().describe("New duration in minutes"),
  lengthInMinutesOptions: z.array(z.number().int().positive()).optional().describe("Multiple duration options the attendee can choose from (e.g. [15, 30, 60]). If provided, the booker picks their preferred duration."),
  description: z.string().optional().describe("New description"),
  locations: z
    .array(z.record(z.unknown()))
    .optional()
    .describe("Updated locations array. Replaces all existing locations."),
  bookingFields: z
    .array(z.record(z.unknown()))
    .optional()
    .describe("Updated booking fields array. Replaces ALL existing booking fields. To modify fields, first fetch the current event type with get_event_type, then include all desired fields here."),
  disableGuests: z.boolean().optional().describe("If true, bookers cannot add guest emails."),
  slotInterval: z.number().int().optional().describe("Length of each slot in minutes."),
  minimumBookingNotice: z.number().int().optional().describe("Minimum minutes before event that a booking can be made."),
  beforeEventBuffer: z.number().int().optional().describe("Minutes blocked on calendar before the meeting."),
  afterEventBuffer: z.number().int().optional().describe("Minutes blocked on calendar after the meeting."),
  scheduleId: z.number().int().optional().describe("Schedule ID to use instead of default. Use get_schedules to find schedule IDs."),
  recurrence: z.record(z.unknown()).optional().describe("Recurrence settings (e.g. {frequency: 'weekly', interval: 1, occurrences: 12})."),
  confirmationPolicy: z.record(z.unknown()).optional().describe("Manual confirmation policy settings."),
  requiresBookerEmailVerification: z.boolean().optional().describe("Whether booker must verify their email."),
  hideCalendarNotes: z.boolean().optional().describe("Hide calendar notes."),
  lockTimeZoneToggleOnBookingPage: z.boolean().optional().describe("Lock timezone on booking page."),
  seats: z.record(z.unknown()).optional().describe("Seated event settings."),
  customName: z.string().optional().describe("Custom event name template."),
  successRedirectUrl: z.string().optional().describe("Redirect URL after successful booking."),
  hidden: z.boolean().optional().describe("Whether the event type is hidden."),
  offsetStart: z.number().int().optional().describe("Offset timeslots by specified minutes."),
  onlyShowFirstAvailableSlot: z.boolean().optional().describe("Show only the earliest available slot per day."),
  bookingLimitsCount: z.object({
    day: z.number().int().min(1).optional().describe("Max bookings per day"),
    week: z.number().int().min(1).optional().describe("Max bookings per week"),
    month: z.number().int().min(1).optional().describe("Max bookings per month"),
    year: z.number().int().min(1).optional().describe("Max bookings per year"),
  }).optional().describe("Limit how many times this event can be booked per period (e.g. {day: 2, week: 5})."),
  bookingWindow: z.object({
    type: z.enum(["businessDays", "calendarDays", "range"]).describe("Window type"),
    value: z.union([z.number(), z.array(z.string())]).describe("Number of days (for businessDays/calendarDays) or date range array ['2030-09-05', '2030-09-09'] (for range)"),
    rolling: z.boolean().optional().describe("If true the window rolls forward keeping 'value' days available. Only for businessDays/calendarDays."),
  }).optional().describe("Limit how far in the future this event can be booked."),
  destinationCalendar: z.object({
    integration: z.string().describe("Integration type (e.g. 'google_calendar'). Use get_connected_calendars to find this."),
    externalId: z.string().describe("External calendar ID (e.g. email for Google Calendar). Use get_connected_calendars to find this."),
  }).optional().describe("Which external calendar new bookings are added to."),
};

export async function updateEventType(params: {
  eventTypeId: number;
  title?: string;
  slug?: string;
  lengthInMinutes?: number;
  lengthInMinutesOptions?: number[];
  description?: string;
  locations?: Record<string, unknown>[];
  bookingFields?: Record<string, unknown>[];
  disableGuests?: boolean;
  slotInterval?: number;
  minimumBookingNotice?: number;
  beforeEventBuffer?: number;
  afterEventBuffer?: number;
  scheduleId?: number;
  recurrence?: Record<string, unknown>;
  confirmationPolicy?: Record<string, unknown>;
  requiresBookerEmailVerification?: boolean;
  hideCalendarNotes?: boolean;
  lockTimeZoneToggleOnBookingPage?: boolean;
  seats?: Record<string, unknown>;
  customName?: string;
  successRedirectUrl?: string;
  hidden?: boolean;
  offsetStart?: number;
  onlyShowFirstAvailableSlot?: boolean;
  bookingLimitsCount?: { day?: number; week?: number; month?: number; year?: number };
  bookingWindow?: { type: string; value: number | string[]; rolling?: boolean };
  destinationCalendar?: { integration: string; externalId: string };
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.title !== undefined) body.title = params.title;
    if (params.slug !== undefined) body.slug = params.slug;
    if (params.lengthInMinutes !== undefined) body.lengthInMinutes = params.lengthInMinutes;
    if (params.lengthInMinutesOptions !== undefined) body.lengthInMinutesOptions = params.lengthInMinutesOptions;
    if (params.description !== undefined) body.description = params.description;
    if (params.locations !== undefined) body.locations = params.locations;
    if (params.bookingFields !== undefined) body.bookingFields = params.bookingFields;
    if (params.disableGuests !== undefined) body.disableGuests = params.disableGuests;
    if (params.slotInterval !== undefined) body.slotInterval = params.slotInterval;
    if (params.minimumBookingNotice !== undefined) body.minimumBookingNotice = params.minimumBookingNotice;
    if (params.beforeEventBuffer !== undefined) body.beforeEventBuffer = params.beforeEventBuffer;
    if (params.afterEventBuffer !== undefined) body.afterEventBuffer = params.afterEventBuffer;
    if (params.scheduleId !== undefined) body.scheduleId = params.scheduleId;
    if (params.recurrence !== undefined) body.recurrence = params.recurrence;
    if (params.confirmationPolicy !== undefined) body.confirmationPolicy = params.confirmationPolicy;
    if (params.requiresBookerEmailVerification !== undefined) body.requiresBookerEmailVerification = params.requiresBookerEmailVerification;
    if (params.hideCalendarNotes !== undefined) body.hideCalendarNotes = params.hideCalendarNotes;
    if (params.lockTimeZoneToggleOnBookingPage !== undefined) body.lockTimeZoneToggleOnBookingPage = params.lockTimeZoneToggleOnBookingPage;
    if (params.seats !== undefined) body.seats = params.seats;
    if (params.customName !== undefined) body.customName = params.customName;
    if (params.successRedirectUrl !== undefined) body.successRedirectUrl = params.successRedirectUrl;
    if (params.hidden !== undefined) body.hidden = params.hidden;
    if (params.offsetStart !== undefined) body.offsetStart = params.offsetStart;
    if (params.onlyShowFirstAvailableSlot !== undefined) body.onlyShowFirstAvailableSlot = params.onlyShowFirstAvailableSlot;
    if (params.bookingLimitsCount !== undefined) body.bookingLimitsCount = params.bookingLimitsCount;
    if (params.bookingWindow !== undefined) body.bookingWindow = params.bookingWindow;
    if (params.destinationCalendar !== undefined) body.destinationCalendar = params.destinationCalendar;
    const data = await calApi(`event-types/${params.eventTypeId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_event_type", err);
  }
}

export const deleteEventTypeSchema = {
  eventTypeId: z.number().int().describe("Event type ID to delete. Use get_event_types to find this."),
};

export async function deleteEventType(params: { eventTypeId: number }) {
  try {
    const data = await calApi(`event-types/${params.eventTypeId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_event_type", err);
  }
}
