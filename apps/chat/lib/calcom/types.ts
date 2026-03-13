export interface CalcomEventType {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  length: number; // duration in minutes
  lengthInMinutes?: number; // v2 2024-06-14 field name
  hidden: boolean;
  ownerId?: number;
  userId?: number;
  teamId?: number | null;
  bookingFields?: BookingField[];
  bookingUrl?: string;
}

export interface BookingField {
  name: string;
  type: string;
  label?: string;
  required?: boolean;
}

export interface CalcomSlot {
  time: string; // ISO 8601
  duration?: number;
  bookingUid?: string;
  attendees?: number;
  available: boolean;
}

export interface SlotsResponse {
  slots: Record<string, CalcomSlot[]>;
}

export interface CalcomAttendee {
  name: string;
  email: string;
  timeZone: string;
  language?: { locale: string };
}

export interface CalcomBookingHost {
  id: number;
  name: string;
  email: string;
  timeZone: string;
}

export interface CalcomBooking {
  id: number;
  uid: string;
  title: string;
  description: string | null;
  status: "accepted" | "pending" | "cancelled" | "rejected";
  start: string; // ISO 8601
  end: string; // ISO 8601
  duration: number;
  eventType: {
    id: number;
    title: string;
    slug: string;
  } | null;
  hosts: CalcomBookingHost[];
  attendees: CalcomAttendee[];
  // organizer is present in some API versions; hosts is the canonical 2024-08-13 field
  organizer?: {
    id: number;
    name: string;
    email: string;
    timeZone: string;
  };
  meetingUrl: string | null;
  location: string | null;
  absentHost: boolean;
}

export interface CreateBookingInput {
  eventTypeId: number;
  start: string; // ISO 8601 UTC
  attendee: {
    name: string;
    email: string;
    timeZone: string;
  };
  guests?: string[];
  metadata?: Record<string, string>;
  bookingFieldsResponses?: Record<string, string>;
}

export interface CreatePublicBookingInput {
  eventTypeSlug: string;
  username: string;
  start: string; // ISO 8601 UTC
  attendee: {
    name: string;
    email: string;
    timeZone: string;
  };
  guests?: string[];
  lengthInMinutes?: number;
  bookingFieldsResponses?: Record<string, string>;
  metadata?: Record<string, string>;
}

/** Metadata passed from Cal.com booking form for routing notifications. */
export interface CalcomWebhookMetadata {
  /** Slack workspace/team ID for routing to Slack */
  slack_team_id?: string;
  /** Slack user ID for DM delivery */
  slack_user_id?: string;
  /** Telegram chat ID for routing to Telegram */
  telegram_chat_id?: string;
}

export interface CalcomWebhookPayload {
  triggerEvent: CalcomWebhookEvent;
  createdAt: string;
  payload: {
    uid: string;
    title: string;
    type: string;
    startTime: string;
    endTime: string;
    status: string;
    organizer: {
      id: number;
      name: string;
      email: string;
      username: string;
      timeZone: string;
    };
    attendees: CalcomAttendee[];
    location?: string;
    videoCallData?: {
      type: string;
      url: string;
      id?: string;
      password?: string;
    };
    rescheduleReason?: string;
    cancellationReason?: string;
    description?: string;
    customInputs?: Record<string, string>;
    metadata?: CalcomWebhookMetadata | Record<string, string>;
  };
}

export type CalcomWebhookEvent =
  | "BOOKING_CREATED"
  | "BOOKING_RESCHEDULED"
  | "BOOKING_CANCELLED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_REJECTED"
  | "BOOKING_REQUESTED"
  | "BOOKING_REMINDER"
  | "MEETING_ENDED";

export interface CalcomApiResponse<T> {
  status: "success" | "error";
  data: T;
  error?: { code: string; message: string };
}

// ─── Schedules ───────────────────────────────────────────────────────────────

export interface ScheduleAvailability {
  days: string[];
  startTime: string;
  endTime: string;
}

export interface ScheduleOverride {
  date: string;
  startTime: string;
  endTime: string;
}

export interface CalcomSchedule {
  id: number;
  ownerId: number;
  name: string;
  timeZone: string;
  availability: ScheduleAvailability[];
  isDefault: boolean;
  overrides: ScheduleOverride[];
}

export interface CreateScheduleInput {
  name: string;
  timeZone: string;
  isDefault: boolean;
  availability?: ScheduleAvailability[];
  overrides?: ScheduleOverride[];
}

export interface UpdateScheduleInput {
  name?: string;
  timeZone?: string;
  isDefault?: boolean;
  availability?: ScheduleAvailability[];
  overrides?: ScheduleOverride[];
}

// ─── Me (profile update) ─────────────────────────────────────────────────────

export interface UpdateMeInput {
  email?: string;
  name?: string;
  timeFormat?: 12 | 24;
  defaultScheduleId?: number;
  weekStart?: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  timeZone?: string;
  locale?: string;
  avatarUrl?: string;
  bio?: string;
}

// ─── Event Type CRUD ─────────────────────────────────────────────────────────

export interface CreateEventTypeInput {
  title: string;
  slug: string;
  lengthInMinutes: number;
  description?: string;
  hidden?: boolean;
}

export interface UpdateEventTypeInput {
  title?: string;
  slug?: string;
  lengthInMinutes?: number;
  description?: string;
  hidden?: boolean;
}

// ─── Calendar Links ───────────────────────────────────────────────────────────

export interface CalendarLink {
  google?: string;
  outlook?: string;
  yahoo?: string;
  ics?: string;
}

// ─── Add Attendee ─────────────────────────────────────────────────────────────

export interface AddAttendeeInput {
  name: string;
  email: string;
  timeZone: string;
}

// ─── Busy Times ───────────────────────────────────────────────────────────────

export interface BusyTime {
  start: string;
  end: string;
  source?: string;
  title?: string;
}
