import { type ModelMessage, stepCountIs, streamText, tool } from "ai";
import type { Logger } from "chat";
import { z } from "zod";
import { getModel } from "./ai-provider";
import {
  addBookingAttendee,
  cancelBooking,
  confirmBooking,
  createBooking,
  createEventType,
  createSchedule,
  declineBooking,
  deleteEventType,
  deleteSchedule,
  getAvailableSlots,
  getBooking,
  getBookings,
  getBusyTimes,
  getCalendarLinks,
  getDefaultSchedule,
  getEventTypes,
  getMe,
  getSchedule,
  getSchedules,
  markNoShow,
  rescheduleBooking,
  updateEventType,
  updateMe,
  updateSchedule,
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

// ─── User context injected from bot layer ────────────────────────────────────

export interface UserContext {
  calcomEmail: string;
  calcomUsername: string;
  calcomTimeZone: string;
}

// Booking: Slack uses interactive modal flow (handlers/slack.ts); Telegram uses natural language only.
// Agent tools (book_meeting, check_availability, etc.) work for both; system prompt adapts per platform.
function getSystemPrompt(platform: string, userContext?: UserContext) {
  const isSlack = platform === "slack";

  const formattingGuide = isSlack
    ? "Use Slack mrkdwn: *bold*, _italic_, `code`, bullet lists. Links: <url|link text> (e.g. <https://app.cal.com/video/abc|Join Meeting>). NEVER use [text](url) or markdown tables—Slack does not render them."
    : "Use Telegram Markdown: **bold** (double asterisks), _italic_, `code`, bullet lists. Links: [link text](url) (e.g. [Join Meeting](https://app.cal.com/video/abc)). NEVER use single * for bold—Telegram requires **. NEVER use markdown tables (| col |)—Telegram does not render them. Use bullet lists instead.";

  const platformName = isSlack ? "Slack" : "Telegram";
  const bold = isSlack ? "*" : "**";

  const userAccountSection = userContext
    ? `## Your Account (pre-verified)
- Email: ${userContext.calcomEmail}
- Username: ${userContext.calcomUsername}
- Timezone: ${userContext.calcomTimeZone}
- Account status: linked and verified (do NOT call get_my_profile for this info)`
    : "";

  const linkInstruction =
    "If any tool returns an 'Account not connected' error, tell the user their session has expired and they need to reconnect. Do NOT tell them to run /cal link — the reconnect button is shown automatically.";

  const now = new Date();
  const userTz = userContext?.calcomTimeZone ?? "UTC";
  const userLocalTime = new Intl.DateTimeFormat("en-US", {
    timeZone: userTz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(now);

  return `You are Cal.com's scheduling assistant on ${platformName}. You help users manage their calendar, book meetings, check availability, and handle bookings — all through natural conversation.

You are "Cal", the Cal.com bot. Be concise, friendly, and action-oriented. ${formattingGuide}

Current date/time (UTC): ${now.toISOString()}
Current date/time (your timezone, ${userTz}): ${userLocalTime}

IMPORTANT: When the user mentions a date, compare it against the date in THEIR timezone (above), NOT UTC. A date is "in the past" ONLY if it has already passed in the user's timezone.

${userAccountSection}

## Booking a Meeting
You are always the HOST. The attendee does NOT need a Cal.com account.

To book a meeting, you need these 4 pieces of information:
1. ${bold}Attendee name + email${bold} — check [CACHED TOOL DATA] and [Context: @mentions resolved] first, then conversation history
2. ${bold}Event type ID${bold} — check [CACHED TOOL DATA] and conversation history first. Only call list_event_types if NOT already available.
3. ${bold}Date + time in UTC${bold} — convert from user's timezone (${userTz})
4. ${bold}Slot is available${bold} — call check_availability ONCE

EVENT TYPE SELECTION:
- If there is only 1 non-hidden event type, auto-select it. Tell the user which one you're using.
- If there are 2-3, list them and ask. If the user's message hints at duration (e.g. "quick chat" = 15 min, "meeting" = 30 min), fuzzy-match and auto-select.
- If the user named an event type (e.g. "product discussion", "30 min", "15 min"): fuzzy-match by title or duration. If 1 clear match, use it. If ambiguous, show the list and ask.
- NEVER create a new event type during a booking flow. If no match, show the list and ask.

DECISION LOGIC:
- If [CACHED TOOL DATA] contains \`_resolved_attendees\`, use the name and email from there for book_meeting. Do NOT ask the user for attendee details that are already resolved. Do NOT call lookup_platform_user.
- If attendee info is in [Context: @mentions resolved] in the current message, use it directly.
- If event types are in [CACHED TOOL DATA] (as \`list_event_types\` result) or conversation history, use them. Do NOT re-call list_event_types.
- If you have all 4 pieces AND the user used explicit confirmation language ("go ahead", "confirm", "just do it", "book it"), call book_meeting immediately.
- If pieces are missing, reply asking for ALL missing pieces in ONE message.

URGENCY ("ASAP", "as soon as possible", "earliest", "next available"):
- If the user wants the soonest slot, OR if [CACHED TOOL DATA] contains \`_booking_intent\` with urgency "asap":
  1. Get event types from [CACHED TOOL DATA] or call list_event_types (ONCE).
  2. If only 1 non-hidden event type, auto-select it. If 2-3, ask which one.
  3. Once the event type is known, call check_availability with startDate = today, daysAhead = 3.
  4. Present the first 3-5 available slots and ask the user to pick.
  5. Do NOT ask "what date/time?" — the user already said they want the soonest.
- IMPORTANT: When the user picks an event type in a follow-up message (e.g. "15 min meeting"), check [CACHED TOOL DATA] for \`_booking_intent\`. If it says "asap", immediately check availability — do NOT ask for date/time.

DURATION VALIDATION:
- If the user specifies a time range (e.g. "10:00-10:15 AM"), calculate the implied duration.
- If it conflicts with the selected event type duration (e.g. 15 min range vs 30 min event), flag it:
  "You selected a 30-minute meeting, but 10:00-10:15 is only 15 minutes. Shall I book 10:00-10:30 instead, or switch to a 15-minute event type?"
- The event type duration is canonical. Use the START of the user's range as startTime.

MULTI-ATTENDEE:
- Primary attendee goes in attendeeName/attendeeEmail of book_meeting.
- Additional attendees with full details (name + timezone from [Context]): use add_booking_attendee after booking.
- Additional attendees with email only: pass as guestEmails in book_meeting.
- After booking: show title, time, all attendee names, and Join Meeting link.

## Timezone Conversion
- IST = Asia/Kolkata (UTC+5:30)
- PST = America/Los_Angeles (UTC-8), PDT = UTC-7
- EST = America/New_York (UTC-5), EDT = UTC-4
- GMT/UTC = UTC+0
- Always convert user-specified times to UTC ISO 8601 for \`startTime\`.

## Greetings and Casual Messages
If the user's latest message is a greeting, status check, or short casual message (e.g. "you there?", "hello", "hey", "are you working?", "hi"), respond with a short friendly text message ONLY. Do NOT call any tools. Do NOT attempt to resume or continue any previous task from the conversation history.

## Resuming Previous Tasks
Do NOT automatically resume an incomplete task from earlier in the conversation. Only continue a prior task if the user's latest message explicitly asks you to (e.g. "yes, go ahead", "ok book it", "continue"). A casual message is NOT a continuation request.

## CRITICAL RULES FOR TOOL USAGE
1. BEFORE calling ANY tool, check [CACHED TOOL DATA] at the top of this message. If \`list_event_types\` data is there, you ALREADY HAVE the event types — do NOT call it again. If \`_resolved_attendees\` is there, you ALREADY HAVE attendee info. If \`_booking_intent\` is there, honor the urgency.
2. NEVER call the same tool more than once in a single step.
3. NEVER call check_availability more than once per step. Pick ONE eventTypeId and ONE date range.
4. If check_availability returns \`totalSlots: 0\`, read the \`noSlotsReason\` and present the \`nextAvailableSlots\` as alternatives. NEVER say "I wasn't able to check" or "I couldn't check" — the check succeeded, there are just no slots for that date.
5. If check_availability returns slots, USE them in your response. Do not discard results.
6. Never call a tool with empty or placeholder arguments.
7. During a booking flow, sequential tool calls across steps are expected (list_event_types → check_availability → book_meeting). After completing the task, respond with text.
8. NEVER call create_event_type, update_event_type, or delete_event_type unless the user explicitly asked to create/update/delete an event type.

## Formatting Rules
${
  isSlack
    ? `- Links: use \`<url|link text>\` only (e.g. \`<https://app.cal.com/video/abc|Join Meeting>\`). Never use [text](url).
- Lists: bullet format \`• *Title* – Date/Time – <url|Join Meeting>\`
- No markdown tables; no [text](url) links.`
    : `- Bold: use \`**text**\` (double asterisks). Never use single \`*\`.
- Links: use \`[link text](url)\` only (e.g. \`[Join Meeting](https://app.cal.com/video/abc)\`).
- Lists: bullet format \`• **Title** – Date/Time – [Join Meeting](url)\`
- No markdown tables.`
}

## Displaying Bookings and Lists
When listing bookings, event types, availability slots, schedules, busy times, or calendar links: ALWAYS use bullet lists (never tables). Include video/meeting links inline. The link is in the \`location\` field of each booking object.
Never say "you can find the link in the booking details" — show it directly.

## Behavior
- ${linkInstruction}
- When showing availability, format times in the user's timezone if known.
- For confirm/decline: use on bookings with status "pending" or "unconfirmed".
- For schedules: when asked about working hours or availability windows, use schedule tools.
- Keep responses under 200 words.
- Never fabricate data. Only use data from tool results.
- Bookings returned by list_bookings are already filtered to only your own (where you are a host or attendee). Never imply the user might be seeing others' bookings.
- Meeting video links (Zoom, Google Meet, Teams, etc.) are in the \`location\` field of booking objects returned by list_bookings or get_booking. Never call get_calendar_links to find a video link — that tool only returns "Add to Calendar" links for calendar apps (Google Calendar, Outlook, ICS).`;
}

async function getAccessTokenOrNull(teamId: string, userId: string): Promise<string | null> {
  return getValidAccessToken(teamId, userId);
}

function createCalTools(teamId: string, userId: string, lookupPlatformUser?: LookupPlatformUserFn) {
  return {
    lookup_platform_user: tool({
      description:
        "Look up a user on the current platform by their user ID to get their name and email. On Slack, resolves mentions like <@USER_ID>. On Telegram, this is not available — ask the user to provide the attendee's name and email directly.",
      inputSchema: z.object({
        platformUserId: z
          .string()
          .describe(
            "The platform user ID to look up (e.g. 'U012AB3CD' on Slack — without <@ and >)"
          ),
      }),
      execute: async ({ platformUserId }) => {
        const profile = lookupPlatformUser ? await lookupPlatformUser(platformUserId) : null;

        if (!profile) {
          return {
            platformUserId,
            error:
              "Could not look up this user. Ask the requester to provide the attendee's name and email manually.",
          };
        }

        if (!profile.email) {
          return {
            platformUserId,
            name: profile.realName ?? profile.name,
            email: null,
            instruction:
              "Found the user's name but their email is not visible. Ask the requester to provide the attendee's email.",
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
      inputSchema: z.object({}).passthrough(),
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
      inputSchema: z.object({}).passthrough(),
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
      inputSchema: z.object({}).passthrough(),
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
        "Check YOUR available time slots for a specific event type. You are always the host. Call this to find available slots for a date range. You may call it again with a different range if the user's requested slot is unavailable.",
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
          .describe(
            "ISO 8601 date to start from (defaults to now). Use this when the user specifies a date."
          ),
      }),
      execute: async ({ eventTypeId, daysAhead, startDate }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        const linked = await getLinkedUser(teamId, userId);
        const tz = linked?.calcomTimeZone ?? "UTC";

        const formatSlot = (time: string) =>
          new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }).format(new Date(time));

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
              .map((s) => ({ date, time: s.time, formatted: formatSlot(s.time) }))
          );

          if (allSlots.length === 0) {
            const dayName = from.toLocaleDateString("en-US", { weekday: "long", timeZone: tz });
            const isWeekend = ["Saturday", "Sunday"].includes(dayName);
            const noSlotsReason = isWeekend
              ? `No availability on ${dayName}. Your schedule does not include weekends.`
              : `No available slots in the requested date range (${formatSlot(from.toISOString())} – ${formatSlot(end.toISOString())}).`;

            // Auto-search the next 14 days for alternatives
            const extEnd = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
            const extSlotsMap = await getAvailableSlots(token, {
              eventTypeId,
              start: from.toISOString(),
              end: extEnd.toISOString(),
              timeZone: tz,
            });
            const nextSlots = Object.entries(extSlotsMap)
              .flatMap(([date, slots]) =>
                slots.filter((s) => s.available).map((s) => ({ date, time: s.time, formatted: formatSlot(s.time) }))
              )
              .slice(0, 5);

            return {
              timeZone: tz,
              totalSlots: 0,
              slots: [],
              noSlotsReason,
              nextAvailableSlots: nextSlots,
              instruction: "Tell the user why the requested date has no availability and present the nextAvailableSlots as alternatives. Do NOT say you 'couldn't check' — the check succeeded, there are just no slots.",
            };
          }

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
        "Book a meeting on YOUR Cal.com calendar. You are always the host — use your own event type ID and availability. The primary attendee is the person you're meeting with; provide their name and email (get these from lookup_platform_user if they were @mentioned). Use guestEmails for additional email-only attendees.",
      inputSchema: z.object({
        eventTypeId: z.number().describe("Your event type ID to book"),
        startTime: z
          .string()
          .describe("Start time in ISO 8601 UTC format (e.g. '2026-02-26T11:30:00Z')"),
        attendeeName: z.string().describe("Full name of the person you're meeting with"),
        attendeeEmail: z.string().describe("Email address of the person you're meeting with"),
        attendeeTimeZone: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Attendee's timezone (e.g. 'Asia/Kolkata'). Defaults to your timezone if omitted."
          ),
        guestEmails: z
          .array(z.string())
          .nullable()
          .optional()
          .describe(
            "Email addresses of additional attendees (email-only). Use when you have emails but not full details for extra guests."
          ),
        notes: z.string().nullable().optional().describe("Optional notes for the booking"),
      }),
      execute: async ({
        eventTypeId,
        startTime,
        attendeeName,
        attendeeEmail,
        attendeeTimeZone,
        guestEmails,
        notes,
      }) => {
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
            guests: guestEmails?.filter(Boolean) ?? undefined,
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

    add_booking_attendee: tool({
      description:
        "Add a full attendee record (name + timezone) to an existing booking. Use after book_meeting for additional attendees resolved via lookup_platform_user on Slack where you have full profile details.",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID returned by book_meeting"),
        attendeeName: z.string().describe("Full name of the additional attendee"),
        attendeeEmail: z.string().describe("Email address of the additional attendee"),
        attendeeTimeZone: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Attendee's timezone (e.g. 'America/New_York'). Defaults to host timezone if omitted."
          ),
      }),
      execute: async ({ bookingUid, attendeeName, attendeeEmail, attendeeTimeZone }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        const linked = await getLinkedUser(teamId, userId);

        try {
          await addBookingAttendee(token, bookingUid, {
            name: attendeeName,
            email: attendeeEmail,
            timeZone: attendeeTimeZone ?? linked?.calcomTimeZone ?? "UTC",
          });
          return {
            success: true,
            bookingUid,
            addedAttendee: { name: attendeeName, email: attendeeEmail },
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to add attendee to booking" };
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
          const booking = await declineBooking(token, bookingUid, reason ?? undefined);
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
      description:
        "Get 'Add to Calendar' links (Google Calendar, Outlook, Yahoo, ICS file) for a booking. Use this ONLY when the user explicitly wants to add a booking to their calendar app. Do NOT use this to find a video/meeting link — the video meeting URL (Zoom, Google Meet, etc.) is in the `location` field already returned by list_bookings.",
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
      inputSchema: z.object({}).passthrough(),
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

/** True if the error is a Groq/API tool-call failure (e.g. failed_generation, invalid_request_error). */
export function isAIToolCallError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  const cause = err.cause as Error | undefined;
  const causeMsg = cause?.message?.toLowerCase() ?? "";
  return (
    msg.includes("failed to call a function") ||
    msg.includes("failed_generation") ||
    msg.includes("invalid_request_error") ||
    msg.includes("tool call validation failed") ||
    msg.includes("which was not in request.tools") ||
    causeMsg.includes("failed to call a function") ||
    causeMsg.includes("failed_generation") ||
    causeMsg.includes("tool call validation failed")
  );
}

/** True if the error is an AI/LLM rate limit (e.g. Groq tokens-per-day). */
export function isAIRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  const cause = err.cause as Error | undefined;
  const causeMsg = cause?.message?.toLowerCase() ?? "";
  const hasRateLimit =
    msg.includes("rate limit") ||
    msg.includes("tokens per day") ||
    causeMsg.includes("rate limit") ||
    causeMsg.includes("tokens per day");
  const status429 =
    (err as { statusCode?: number }).statusCode === 429 ||
    (cause as { statusCode?: number } | undefined)?.statusCode === 429;
  return hasRateLimit || (status429 && (msg.includes("retry") || causeMsg.includes("retry")));
}

// ─── Context-aware tool filtering ─────────────────────────────────────────────

const CORE_TOOL_NAMES = new Set([
  "list_event_types",
  "check_availability",
  "book_meeting",
  "add_booking_attendee",
  "list_bookings",
  "get_booking",
  "cancel_booking",
]);

const ADMIN_KEYWORDS = [
  "create event",
  "update event",
  "delete event",
  "schedule",
  "working hours",
  "profile",
  "unlink",
  "no-show",
  "no show",
  "confirm booking",
  "decline",
  "reschedule",
  "calendar link",
  "busy times",
];

export function detectToolSet(
  message: string,
  history: ModelMessage[]
): "core" | "all" {
  const lowerMsg = message.toLowerCase();
  if (ADMIN_KEYWORDS.some((kw) => lowerMsg.includes(kw))) return "all";
  // Also check last few history messages for admin context
  for (const msg of history.slice(-3)) {
    if (typeof msg.content === "string" && ADMIN_KEYWORDS.some((kw) => msg.content.toString().toLowerCase().includes(kw))) {
      return "all";
    }
  }
  return "core";
}

function filterTools<T extends Record<string, unknown>>(
  allTools: T,
  toolSet: "core" | "all"
): T {
  if (toolSet === "all") return allTools;
  const filtered = {} as Record<string, unknown>;
  for (const [name, t] of Object.entries(allTools)) {
    if (CORE_TOOL_NAMES.has(name)) {
      filtered[name] = t;
    }
  }
  return filtered as T;
}

// ─── Agent stream ─────────────────────────────────────────────────────────────

export interface AgentStreamOptions {
  teamId: string;
  userId: string;
  userMessage: string;
  conversationHistory?: ModelMessage[];
  lookupPlatformUser?: LookupPlatformUserFn;
  platform: string;
  logger?: Logger;
  /** When set, rate-limit errors from the stream are stored here for the caller to surface a friendly message. */
  onErrorRef?: { current: Error | null };
  /** Pre-verified user context from bot layer — injected into system prompt. */
  userContext?: UserContext;
  /** Which tool set to expose: 'core' (booking only) or 'all' (includes admin tools). */
  toolSet?: "core" | "all";
}

export function runAgentStream({
  teamId,
  userId,
  userMessage,
  conversationHistory,
  lookupPlatformUser,
  platform,
  logger,
  onErrorRef,
  userContext,
  toolSet = "core",
}: AgentStreamOptions) {
  const allTools = createCalTools(teamId, userId, lookupPlatformUser);
  const tools = filterTools(allTools, toolSet);

  // Keep only the last 10 messages from history to prevent stale context
  // (e.g. an old booking request) from hijacking unrelated follow-up messages.
  const recentHistory = (conversationHistory ?? []).slice(-10);

  const messages: ModelMessage[] = [
    ...recentHistory,
    { role: "user" as const, content: userMessage },
  ];

  // With pre-resolution, user context injection, and tool result persistence,
  // the agent should need at most 3-4 steps per request. Keep a hard cap as safety net.
  const MAX_STEPS = 6;

  // ─── Loop guard ───────────────────────────────────────────────────────────
  // Track tool calls across steps. If the same tool is called 2+ times with
  // identical arguments, force a text response to break the loop.
  const toolCallTracker = new Map<string, number>();

  const result = streamText({
    model: getModel(),
    system: getSystemPrompt(platform, userContext),
    messages,
    tools,
    toolChoice: "auto",
    stopWhen: stepCountIs(MAX_STEPS),
    prepareStep({ stepNumber, steps: previousSteps }) {
      // Track tool calls from all previous steps for loop detection
      toolCallTracker.clear();
      for (const prev of previousSteps) {
        if (!prev.toolCalls || prev.toolCalls.length === 0) continue;
        for (const tc of prev.toolCalls) {
          const input = "input" in tc ? tc.input : undefined;
          const key = `${tc.toolName}:${JSON.stringify(input)}`;
          toolCallTracker.set(key, (toolCallTracker.get(key) ?? 0) + 1);
        }
      }
      const hasLoop = [...toolCallTracker.values()].some(
        (count) => count >= 2
      );
      if (hasLoop) {
        logger?.warn("Loop detected, forcing text response", {
          tracker: Object.fromEntries(toolCallTracker),
        });
        return { toolChoice: "none" as const };
      }
      // On the final allowed step, force a text response so the model
      // cannot keep calling tools indefinitely.
      if (stepNumber === MAX_STEPS - 1) {
        return { toolChoice: "none" as const };
      }
      return {};
    },
    onError({ error }) {
      logger?.error("Stream error", error);
      if (onErrorRef && (isAIRateLimitError(error) || isAIToolCallError(error)))
        onErrorRef.current = error instanceof Error ? error : new Error(String(error));
    },
    onStepFinish({ finishReason, toolCalls, text }) {
      logger?.info("Step finished", {
        finishReason,
        toolCalls: toolCalls?.map((tc) => tc.toolName),
        textLength: text?.length ?? 0,
      });
    },
  });

  return result;
}
