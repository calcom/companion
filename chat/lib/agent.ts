import { streamText, tool, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import { getModel } from "./ai-provider";
import {
  getEventTypes,
  getAvailableSlots,
  createBooking,
  getBookings,
  cancelBooking,
  rescheduleBooking,
  getMe,
  updateMe,
  getBooking,
  confirmBooking,
  declineBooking,
  getSchedules,
  getDefaultSchedule,
  getSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getBusyTimes,
  createEventType,
  updateEventType,
  deleteEventType,
  getCalendarLinks,
  markNoShow,
} from "./calcom/client";
import { getLinkedUser, getValidAccessToken, unlinkUser } from "./user-linking";

export interface PlatformUserProfile {
  id: string;
  name: string;
  realName: string;
  email?: string;
}

export type LookupPlatformUserFn = (userId: string) => Promise<PlatformUserProfile | null>;

const CALCOM_APP_URL = process.env.CALCOM_APP_URL ?? "https://app.cal.com";

function getSystemPrompt(platform: string) {
  const isSlack = platform === "slack";

  const formattingGuide = isSlack
    ? "Use Slack mrkdwn formatting: *bold*, _italic_, `code`, and bullet lists."
    : "Use Markdown formatting: **bold**, *italic*, `code`, and bullet lists.";

  const platformName = isSlack ? "Slack" : "Telegram";

  const mentionSection = isSlack
    ? `## Slack Mention Parsing
- User mentions in Slack appear as \`<@USER_ID>\` (e.g. \`<@U012AB3CD>\`).
- When you see a mention like \`<@U012AB3CD>\`, extract just the USER_ID part (strip \`<@\` and \`>\`).
- Always call \`lookup_platform_user\` first to resolve who that person is before booking with them.`
    : `## Telegram Users
- On Telegram, users cannot be @mentioned by ID. Ask the user to provide the attendee's name and email directly.
- The \`lookup_platform_user\` tool is not available on Telegram.`;

  const bookingFlow = isSlack
    ? `## Booking a Meeting with Someone Flow
YOU are always the HOST. The other person is the ATTENDEE — they do NOT need a Cal.com account.
1. User says something like "book meeting with <@U012AB3CD> at 5pm IST"
2. Call \`lookup_platform_user\` with platformUserId="U012AB3CD" → get their name and email from Slack.
3. Call \`list_event_types\` (no arguments) → list YOUR event types. Pick the best match by duration/title.
4. Call \`check_availability\` with the chosen eventTypeId. Use \`startDate\` if a date was specified.
5. Find the slot matching the requested time (convert timezone: e.g. IST = Asia/Kolkata = UTC+5:30).
6. Call \`book_meeting\` with your eventTypeId, the ISO 8601 UTC slot time, and the attendee's name + email.`
    : `## Booking a Meeting with Someone Flow
YOU are always the HOST. The other person is the ATTENDEE — they do NOT need a Cal.com account.
1. Ask the user for the attendee's name and email.
2. Call \`list_event_types\` (no arguments) → list YOUR event types. Pick the best match by duration/title.
3. Call \`check_availability\` with the chosen eventTypeId. Use \`startDate\` if a date was specified.
4. Find the slot matching the requested time (convert timezone: e.g. IST = Asia/Kolkata = UTC+5:30).
5. Call \`book_meeting\` with your eventTypeId, the ISO 8601 UTC slot time, and the attendee's name + email.`;

  const linkInstruction = isSlack
    ? 'If the user is not linked, tell them to use the "Continue with Cal.com" button or run `/cal link` to connect their account.'
    : 'If the user is not linked, tell them to use the "Continue with Cal.com" button or send /link to connect their account.';

  return `You are Cal.com's scheduling assistant on ${platformName}. You help users manage their calendar, book meetings, check availability, and handle bookings — all through natural conversation.

You are "Cal", the Cal.com bot. Be concise, friendly, and action-oriented. ${formattingGuide}

Current date/time: ${new Date().toISOString()}

## Available Capabilities
- *Account*: check_account_linked, unlink_account, get_my_profile, update_profile
- *Event Types*: list_event_types, create_event_type, update_event_type, delete_event_type
- *Availability*: check_availability, check_busy_times
- *Bookings*: book_meeting, list_bookings, get_booking, cancel_booking, reschedule_booking, confirm_booking, decline_booking, get_calendar_links, mark_no_show
- *Schedules*: list_schedules, get_schedule (pass 'default' for default), create_schedule, update_schedule, delete_schedule
- *People*: lookup_platform_user — resolve a user mention to their name and email (Slack only)

${mentionSection}

${bookingFlow}

## Timezone Conversion
- IST = Asia/Kolkata (UTC+5:30)
- PST = America/Los_Angeles (UTC-8), PDT = UTC-7
- EST = America/New_York (UTC-5), EDT = UTC-4
- GMT/UTC = UTC+0
- Always convert user-specified times to UTC ISO 8601 for \`startTime\`.

## CRITICAL RULES FOR TOOL USAGE
1. Call check_account_linked ONCE at the start. If it returns linked:true, proceed. Do NOT call it again.
2. Each tool should only be called ONCE per request unless you get an error.
3. After getting tool results, respond to the user with a text message. Do NOT call more tools unless necessary.
4. Never call a tool with empty or placeholder arguments.

## Behavior
- ${linkInstruction}
- When showing availability, format times in the user's timezone if known.
- For confirm/decline: use on bookings with status "pending" or "unconfirmed".
- For schedules: when asked about working hours or availability windows, use schedule tools.
- Keep responses under 200 words.
- Never fabricate data. Only use data from tool results.
- Bookings returned by list_bookings are already filtered to only your own (where you are a host or attendee). Never imply the user might be seeing others' bookings.`;
}

async function getAccessTokenOrNull(teamId: string, userId: string): Promise<string | null> {
  return getValidAccessToken(teamId, userId);
}

function createCalTools(
  teamId: string,
  userId: string,
  lookupPlatformUser?: LookupPlatformUserFn
) {
  return {
    check_account_linked: tool({
      description:
        "Check if the current user has linked their Cal.com account. Call this ONCE at the start, then proceed with other tools. Do NOT call this again after getting a result.",
      inputSchema: z.object({}),
      execute: async () => {
        const linked = await getLinkedUser(teamId, userId);
        if (linked) {
          return {
            status: "LINKED",
            username: linked.calcomUsername,
            email: linked.calcomEmail,
            timeZone: linked.calcomTimeZone,
            instruction:
              "Account is linked. Proceed with the user's request using other tools. Do NOT call check_account_linked again.",
          };
        }
        return {
          status: "NOT_LINKED",
          instruction:
            "Tell the user to connect their Cal.com account by clicking the 'Continue with Cal.com' button or running /cal link. Do NOT call any other tools.",
        };
      },
    }),

    lookup_platform_user: tool({
      description:
        "Look up a user on the current platform by their user ID to get their name and email. On Slack, resolves mentions like <@USER_ID>. On Telegram, this is not available — ask the user to provide the attendee's name and email directly.",
      inputSchema: z.object({
        platformUserId: z
          .string()
          .describe("The platform user ID to look up (e.g. 'U012AB3CD' on Slack — without <@ and >)"),
      }),
      execute: async ({ platformUserId }) => {
        const profile = lookupPlatformUser ? await lookupPlatformUser(platformUserId) : null;

        if (!profile) {
          return {
            platformUserId,
            error: "Could not look up this user. Ask the requester to provide the attendee's name and email manually.",
          };
        }

        if (!profile.email) {
          return {
            platformUserId,
            name: profile.realName ?? profile.name,
            email: null,
            instruction: "Found the user's name but their email is not visible. Ask the requester to provide the attendee's email.",
          };
        }

        return {
          platformUserId,
          name: profile.realName ?? profile.name,
          email: profile.email,
          instruction: "Use this name and email as attendeeName and attendeeEmail in book_meeting.",
        };
      },
    }),

    unlink_account: tool({
      description: "Unlink the user's Cal.com account.",
      inputSchema: z.object({}),
      execute: async () => {
        const linked = await getLinkedUser(teamId, userId);
        if (!linked) {
          return { success: false, error: "Account is not connected." };
        }
        await unlinkUser(teamId, userId);
        return { success: true };
      },
    }),

    get_my_profile: tool({
      description: "Get the linked user's Cal.com profile information.",
      inputSchema: z.object({}),
      execute: async () => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const me = await getMe(token);
          return { name: me.name, email: me.email, username: me.username, timeZone: me.timeZone };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to fetch profile" };
        }
      },
    }),

    list_event_types: tool({
      description:
        "List YOUR Cal.com event types (the meeting types you offer as a host). Use this to pick which event type to book when someone wants to meet with you.",
      inputSchema: z.object({}),
      execute: async () => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const types = await getEventTypes(token);
          return {
            eventTypes: types.map((et) => ({
              id: et.id,
              title: et.title,
              slug: et.slug,
              duration: et.length,
              description: et.description,
              hidden: et.hidden,
            })),
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to fetch event types" };
        }
      },
    }),

    check_availability: tool({
      description:
        "Check YOUR available time slots for a specific event type. You are always the host. Returns slots for the next 7 days by default.",
      inputSchema: z.object({
        eventTypeId: z.number().describe("The event type ID to check availability for"),
        daysAhead: z
          .number()
          .nullable()
          .optional()
          .default(7)
          .describe("Number of days ahead to check. Default 7."),
        startDate: z
          .string()
          .nullable()
          .optional()
          .describe("ISO 8601 date to start from (defaults to now). Use this when the user specifies a date."),
      }),
      execute: async ({ eventTypeId, daysAhead, startDate }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        const linked = await getLinkedUser(teamId, userId);
        const tz = linked?.calcomTimeZone ?? "UTC";
        try {
          const from = startDate ? new Date(startDate) : new Date();
          const end = new Date(from.getTime() + (daysAhead ?? 7) * 24 * 60 * 60 * 1000);
          const slotsMap = await getAvailableSlots(token, {
            eventTypeId,
            start: from.toISOString(),
            end: end.toISOString(),
            timeZone: tz,
          });

          const allSlots = Object.entries(slotsMap).flatMap(([date, slots]) =>
            slots
              .filter((s) => s.available)
              .map((s) => ({
                date,
                time: s.time,
                formatted: new Intl.DateTimeFormat("en-US", {
                  timeZone: tz,
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                }).format(new Date(s.time)),
              }))
          );

          return {
            timeZone: tz,
            totalSlots: allSlots.length,
            slots: allSlots.slice(0, 15),
            hasMore: allSlots.length > 15,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to fetch availability" };
        }
      },
    }),

    book_meeting: tool({
      description:
        "Book a meeting on YOUR Cal.com calendar. You are always the host — use your own event type ID and availability. The attendee is the person you're meeting with; provide their name and email (get these from lookup_slack_user if they were @mentioned).",
      inputSchema: z.object({
        eventTypeId: z.number().describe("Your event type ID to book"),
        startTime: z.string().describe("Start time in ISO 8601 UTC format (e.g. '2026-02-26T11:30:00Z')"),
        attendeeName: z.string().describe("Full name of the person you're meeting with"),
        attendeeEmail: z.string().describe("Email address of the person you're meeting with"),
        attendeeTimeZone: z
          .string()
          .nullable()
          .optional()
          .describe("Attendee's timezone (e.g. 'Asia/Kolkata'). Defaults to your timezone if omitted."),
        notes: z.string().nullable().optional().describe("Optional notes for the booking"),
      }),
      execute: async ({ eventTypeId, startTime, attendeeName, attendeeEmail, attendeeTimeZone, notes }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        const linked = await getLinkedUser(teamId, userId);

        try {
          const booking = await createBooking(token, {
            eventTypeId,
            start: startTime,
            attendee: {
              name: attendeeName,
              email: attendeeEmail,
              timeZone: attendeeTimeZone ?? linked?.calcomTimeZone ?? "UTC",
            },
            notes: notes ?? undefined,
          });

          return {
            success: true,
            bookingUid: booking.uid,
            title: booking.title,
            start: booking.start,
            end: booking.end,
            meetingUrl: booking.meetingUrl,
            attendees: booking.attendees.map((a) => ({ name: a.name, email: a.email })),
            manageUrl: `${CALCOM_APP_URL}/bookings`,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to create booking" };
        }
      },
    }),

    list_bookings: tool({
      description:
        "List the user's bookings. Can filter by status: upcoming, past, cancelled, recurring, unconfirmed.",
      inputSchema: z.object({
        status: z
          .enum(["upcoming", "past", "cancelled", "recurring", "unconfirmed"])
          .nullable()
          .optional()
          .default("upcoming")
          .describe("Booking status filter. Default: upcoming."),
        take: z
          .number()
          .nullable()
          .optional()
          .default(5)
          .describe("Max bookings to return. Default: 5."),
      }),
      execute: async ({ status, take }) => {
        const [token, linked] = await Promise.all([
          getAccessTokenOrNull(teamId, userId),
          getLinkedUser(teamId, userId),
        ]);
        if (!token) return { error: "Account not connected." };
        try {
          const currentUser = linked
            ? { id: linked.calcomUserId, email: linked.calcomEmail }
            : undefined;
          const bookings = await getBookings(
            token,
            { status: status ?? "upcoming", take: take ?? 5 },
            currentUser
          );
          return {
            bookings: bookings.map((b) => ({
              uid: b.uid,
              title: b.title,
              status: b.status,
              start: b.start,
              end: b.end,
              attendees: b.attendees.map((a) => ({ name: a.name, email: a.email })),
              meetingUrl: b.meetingUrl,
              location: b.location,
            })),
            manageUrl: `${CALCOM_APP_URL}/bookings`,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to fetch bookings" };
        }
      },
    }),

    get_booking: tool({
      description: "Get details of a specific booking by its UID.",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID"),
      }),
      execute: async ({ bookingUid }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const b = await getBooking(token, bookingUid);
          return {
            uid: b.uid,
            title: b.title,
            status: b.status,
            start: b.start,
            end: b.end,
            attendees: b.attendees.map((a) => ({ name: a.name, email: a.email })),
            meetingUrl: b.meetingUrl,
            location: b.location,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to fetch booking" };
        }
      },
    }),

    cancel_booking: tool({
      description: "Cancel a booking by its UID. Optionally provide a reason.",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID to cancel"),
        reason: z.string().nullable().optional().describe("Cancellation reason"),
      }),
      execute: async ({ bookingUid, reason }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          await cancelBooking(token, bookingUid, reason ?? undefined);
          return { success: true, bookingUid };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to cancel booking" };
        }
      },
    }),

    reschedule_booking: tool({
      description: "Reschedule a booking to a new time.",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID to reschedule"),
        newStartTime: z.string().describe("New start time in ISO 8601 format"),
        reason: z.string().nullable().optional().describe("Reason for rescheduling"),
      }),
      execute: async ({ bookingUid, newStartTime, reason }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const booking = await rescheduleBooking(
            token,
            bookingUid,
            newStartTime,
            reason ?? undefined
          );
          return {
            success: true,
            bookingUid: booking.uid,
            title: booking.title,
            newStart: booking.start,
            newEnd: booking.end,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to reschedule booking" };
        }
      },
    }),

    confirm_booking: tool({
      description: "Confirm a pending booking that requires confirmation.",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID to confirm"),
      }),
      execute: async ({ bookingUid }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const booking = await confirmBooking(token, bookingUid);
          return {
            success: true,
            bookingUid: booking.uid,
            title: booking.title,
            status: booking.status,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to confirm booking" };
        }
      },
    }),

    decline_booking: tool({
      description: "Decline a pending booking that requires confirmation.",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID to decline"),
        reason: z.string().nullable().optional().describe("Reason for declining"),
      }),
      execute: async ({ bookingUid, reason }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const booking = await declineBooking(
            token,
            bookingUid,
            reason ?? undefined
          );
          return {
            success: true,
            bookingUid: booking.uid,
            title: booking.title,
            status: booking.status,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to decline booking" };
        }
      },
    }),

    get_calendar_links: tool({
      description: "Get 'Add to Calendar' links (Google, Outlook, Yahoo, ICS) for a booking.",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID"),
      }),
      execute: async ({ bookingUid }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const links = await getCalendarLinks(token, bookingUid);
          return { links };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to get calendar links" };
        }
      },
    }),

    mark_no_show: tool({
      description: "Mark a booking as a no-show (host absent).",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID to mark as no-show"),
      }),
      execute: async ({ bookingUid }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          await markNoShow(token, bookingUid);
          return { success: true, bookingUid };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to mark no-show" };
        }
      },
    }),

    update_profile: tool({
      description:
        "Update the user's Cal.com profile (name, email, timezone, time format, week start, etc.).",
      inputSchema: z.object({
        name: z.string().nullable().optional().describe("Display name"),
        email: z.string().nullable().optional().describe("Email address"),
        timeZone: z.string().nullable().optional().describe("Timezone (e.g. 'America/New_York')"),
        timeFormat: z
          .union([z.literal(12), z.literal(24)])
          .nullable()
          .optional()
          .describe("Time format: 12 or 24"),
        weekStart: z
          .enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
          .nullable()
          .optional()
          .describe("First day of the week"),
        locale: z.string().nullable().optional().describe("Language/locale code (e.g. 'en', 'es')"),
        bio: z.string().nullable().optional().describe("User bio"),
      }),
      execute: async (input) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v != null));
        if (Object.keys(patch).length === 0) return { error: "No fields provided to update." };
        try {
          const me = await updateMe(token, patch);
          return { success: true, name: me.name, email: me.email, timeZone: me.timeZone };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to update profile" };
        }
      },
    }),

    check_busy_times: tool({
      description: "Check the user's busy times from all connected calendars for a given period.",
      inputSchema: z.object({
        start: z.string().describe("Start of the range in ISO 8601 format"),
        end: z.string().describe("End of the range in ISO 8601 format"),
      }),
      execute: async ({ start, end }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const busyTimes = await getBusyTimes(token, { start, end });
          return { busyTimes };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to get busy times" };
        }
      },
    }),

    list_schedules: tool({
      description: "List all availability schedules for the user.",
      inputSchema: z.object({}),
      execute: async () => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const schedules = await getSchedules(token);
          return {
            schedules: schedules.map((s) => ({
              id: s.id,
              name: s.name,
              timeZone: s.timeZone,
              isDefault: s.isDefault,
            })),
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to list schedules" };
        }
      },
    }),

    get_schedule: tool({
      description:
        "Get details of a specific availability schedule. Use scheduleId 'default' to get the default schedule.",
      inputSchema: z.object({
        scheduleId: z
          .union([z.number(), z.literal("default")])
          .describe("Schedule ID or 'default' for the default schedule"),
      }),
      execute: async ({ scheduleId }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const schedule =
            scheduleId === "default"
              ? await getDefaultSchedule(token)
              : await getSchedule(token, scheduleId);
          return {
            id: schedule.id,
            name: schedule.name,
            timeZone: schedule.timeZone,
            isDefault: schedule.isDefault,
            availability: schedule.availability,
            overrides: schedule.overrides,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to get schedule" };
        }
      },
    }),

    create_schedule: tool({
      description: "Create a new availability schedule.",
      inputSchema: z.object({
        name: z.string().describe("Schedule name (e.g. 'Work Hours')"),
        timeZone: z.string().describe("Timezone (e.g. 'America/New_York')"),
        isDefault: z.boolean().describe("Whether this should be the default schedule"),
      }),
      execute: async ({ name, timeZone, isDefault }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const schedule = await createSchedule(token, { name, timeZone, isDefault });
          return {
            success: true,
            id: schedule.id,
            name: schedule.name,
            timeZone: schedule.timeZone,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to create schedule" };
        }
      },
    }),

    update_schedule: tool({
      description: "Update an existing availability schedule.",
      inputSchema: z.object({
        scheduleId: z.number().describe("The schedule ID to update"),
        name: z.string().nullable().optional().describe("New schedule name"),
        timeZone: z.string().nullable().optional().describe("New timezone"),
        isDefault: z.boolean().nullable().optional().describe("Set as default schedule"),
      }),
      execute: async ({ scheduleId, name, timeZone, isDefault }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        const patch = Object.fromEntries(
          Object.entries({ name, timeZone, isDefault }).filter(([, v]) => v != null)
        );
        if (Object.keys(patch).length === 0) return { error: "No fields provided to update." };
        try {
          const schedule = await updateSchedule(token, scheduleId, patch);
          return {
            success: true,
            id: schedule.id,
            name: schedule.name,
            timeZone: schedule.timeZone,
            isDefault: schedule.isDefault,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to update schedule" };
        }
      },
    }),

    delete_schedule: tool({
      description: "Delete an availability schedule by ID.",
      inputSchema: z.object({
        scheduleId: z.number().describe("The schedule ID to delete"),
      }),
      execute: async ({ scheduleId }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          await deleteSchedule(token, scheduleId);
          return { success: true, scheduleId };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to delete schedule" };
        }
      },
    }),

    create_event_type: tool({
      description: "Create a new event type (meeting type) on Cal.com.",
      inputSchema: z.object({
        title: z.string().describe("Event type title (e.g. '30 Minute Meeting')"),
        slug: z.string().describe("URL slug (e.g. '30min')"),
        lengthInMinutes: z.number().describe("Duration in minutes"),
        description: z.string().nullable().optional().describe("Optional description"),
        hidden: z.boolean().nullable().optional().describe("Whether to hide from booking page"),
      }),
      execute: async ({ title, slug, lengthInMinutes, description, hidden }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const et = await createEventType(token, {
            title,
            slug,
            lengthInMinutes,
            description: description ?? undefined,
            hidden: hidden ?? undefined,
          });
          return { success: true, id: et.id, title: et.title, slug: et.slug, length: et.length };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to create event type" };
        }
      },
    }),

    update_event_type: tool({
      description: "Update an existing event type.",
      inputSchema: z.object({
        eventTypeId: z.number().describe("The event type ID to update"),
        title: z.string().nullable().optional().describe("New title"),
        slug: z.string().nullable().optional().describe("New URL slug"),
        lengthInMinutes: z.number().nullable().optional().describe("New duration in minutes"),
        description: z.string().nullable().optional().describe("New description"),
        hidden: z.boolean().nullable().optional().describe("Whether to hide from booking page"),
      }),
      execute: async ({ eventTypeId, title, slug, lengthInMinutes, description, hidden }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        const patch = Object.fromEntries(
          Object.entries({ title, slug, lengthInMinutes, description, hidden }).filter(
            ([, v]) => v != null
          )
        );
        if (Object.keys(patch).length === 0) return { error: "No fields provided to update." };
        try {
          const et = await updateEventType(token, eventTypeId, patch);
          return { success: true, id: et.id, title: et.title, slug: et.slug };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to update event type" };
        }
      },
    }),

    delete_event_type: tool({
      description: "Delete an event type by ID.",
      inputSchema: z.object({
        eventTypeId: z.number().describe("The event type ID to delete"),
      }),
      execute: async ({ eventTypeId }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          await deleteEventType(token, eventTypeId);
          return { success: true, eventTypeId };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to delete event type" };
        }
      },
    }),
  };
}

export interface AgentStreamOptions {
  teamId: string;
  userId: string;
  userMessage: string;
  conversationHistory?: ModelMessage[];
  lookupPlatformUser?: LookupPlatformUserFn;
  platform: string;
}

export function runAgentStream({
  teamId,
  userId,
  userMessage,
  conversationHistory,
  lookupPlatformUser,
  platform,
}: AgentStreamOptions) {
  const tools = createCalTools(teamId, userId, lookupPlatformUser);

  const messages: ModelMessage[] = [
    ...(conversationHistory ?? []),
    { role: "user" as const, content: userMessage },
  ];

  const MAX_STEPS = 5;

  const result = streamText({
    model: getModel(),
    system: getSystemPrompt(platform),
    messages,
    tools,
    toolChoice: "auto",
    stopWhen: stepCountIs(MAX_STEPS),
    prepareStep({ stepNumber }) {
      if (stepNumber === MAX_STEPS - 1) {
        return { toolChoice: "none" };
      }
      return {};
    },
    onError({ error }) {
      console.error("[Cal Agent] Stream error:", error);
    },
    onStepFinish({ finishReason, toolCalls, text }) {
      console.log("[Cal Agent] Step finished:", {
        finishReason,
        toolCalls: toolCalls?.map((tc) => tc.toolName),
        textLength: text?.length ?? 0,
      });
    },
  });

  return result;
}
