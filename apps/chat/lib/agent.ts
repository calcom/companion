import { type ModelMessage, stepCountIs, streamText, tool } from "ai";
import type { Logger } from "chat";
import { z } from "zod";
import { getFallbackModels, getModel } from "./ai-provider";
import {
  addBookingAttendee,
  cancelBooking,
  confirmBooking,
  createBooking,
  createBookingPublic,
  createEventType,
  createSchedule,
  declineBooking,
  deleteEventType,
  deleteSchedule,
  getAvailableSlotsPublic,
  getBooking,
  getBookings,
  getBusyTimes,
  getCalendarLinks,
  getDefaultSchedule,
  getEventTypesByUsername,
  getMe,
  getSchedule,
  getSchedules,
  markNoShow,
  rescheduleBooking,
  updateEventType,
  updateMe,
  updateSchedule,
} from "./calcom/client";
import { getLinkedUser, getValidAccessToken, linkUser, unlinkUser } from "./user-linking";

export interface PlatformUserProfile {
  id: string;
  name: string;
  realName: string;
  email?: string;
}

export type LookupPlatformUserFn = (userId: string) => Promise<PlatformUserProfile | null>;

const CALCOM_APP_URL = process.env.CALCOM_APP_URL ?? "https://app.cal.com";

// ─── Named constants ────────────────────────────────────────────────────────
const MAX_HISTORY_MESSAGES = 10;
const MAX_AGENT_STEPS = 6;
const MAX_SLOTS_RETURNED = 15;
const MAX_NEXT_AVAILABLE_SLOTS = 5;
const EXTENDED_SEARCH_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

You are "Cal", the Cal.com bot. Be concise, friendly, and action-oriented. When you have enough information, CALL TOOLS IMMEDIATELY — do NOT describe, narrate, or list the API calls you plan to make. Never show a "plan" or "sequence of steps" to the user. Just execute the tools silently and present the result. ${formattingGuide}

Current date/time (UTC): ${now.toISOString()}
Current date/time (your timezone, ${userTz}): ${userLocalTime}

IMPORTANT: When the user mentions a date, compare it against the date in THEIR timezone (above), NOT UTC. A date is "in the past" ONLY if it has already passed in the user's timezone.

${userAccountSection}

## Booking a Meeting — Whose Calendar?
When the user wants to book a meeting, first determine whose calendar to use.

${bold}STEP 0 — WHOSE CALENDAR (default to theirs when username is present):${bold}
- "book with X", "book meeting with username X", "theirs, username X", or any message containing a Cal.com username → ${bold}Option B immediately${bold}. Do NOT ask "Yours or Theirs?"
- "I'll host", "use mine", "my calendar", or user provides only a name/email (no username) → ${bold}Option A${bold}.
- "they're not on Cal.com", "I only have their email" → ${bold}Option A${bold}, ask for name + email.
- No name, no username, no preference stated → ask "Whose event types should I use?" ONCE:
  • ${bold}Yours${bold} (you host, they attend) — uses your event types
  • ${bold}Theirs${bold} (they host, you attend) — requires their Cal.com username

${bold}Option A — YOUR calendar (you host):${bold}
You are the host. The other person is the attendee.
To book, you need these 4 pieces:
1. ${bold}Attendee name + email${bold} — check [CACHED TOOL DATA] and [Context: @mentions resolved] first
2. ${bold}Event type ID${bold} — from YOUR event types (list_event_types)
3. ${bold}Date + time in UTC${bold} — convert from user's timezone (${userTz})
4. ${bold}Slot is available${bold} — call check_availability ONCE

${bold}Option B — THEIR calendar (they host):${bold}
The other person is the host. The requesting user (you) is the attendee.
1. Call \`list_event_types_by_username\` with their username. (Ask for the username only if not provided.)
2. If the tool returns 0 event types or an error → ${bold}FALLBACK${bold}: say "No public event types found for '[username]'. They may not be on Cal.com. I can book on your calendar instead — just give me their name and email." Then switch to Option A (preserve ASAP intent if set).
3. Filter out hidden event types (\`hidden: true\`). Count only non-hidden ones.
4. Call \`check_availability_public\` with the event type \`slug\` and \`username\`. Do NOT use \`check_availability\` — that requires the host's auth token which you don't have.
5. Present available slots (or auto-select for ASAP — see below).
6. Call \`book_meeting_public\` (NOT book_meeting) with the event type slug + username. For attendeeName and attendeeEmail, use the ${bold}requesting user's${bold} name and email from "Your Account" above — the requesting user is the attendee in this flow. NEVER use the bot name "Cal.com" as attendeeName.

${bold}USERNAME AMBIGUITY:${bold}
- Cal.com resolves a username to one account globally. If the user says "wrong person" or "that's not them": respond with "Cal.com usernames map to a single account. If you're looking for someone else with a similar name, please share their direct booking link (e.g. cal.com/their-username/event-slug) and I can book from there."
- Do NOT retry the same username. Do NOT guess a different username.

## Tool Chaining — Minimize Round-Trips
You have up to ${MAX_AGENT_STEPS} steps per turn. Chain tool calls within a single turn when you have enough info to proceed. Do NOT stop to ask the user between tool calls unless there is genuine ambiguity.

${bold}Chaining rules:${bold}
- After \`list_event_types_by_username\` or \`list_event_types\`: if exactly 1 non-hidden event type is returned, auto-select it and IMMEDIATELY call \`check_availability_public\` / \`check_availability\` in the same turn. Only stop and ask the user if there are multiple non-hidden event types.
- After \`check_availability_public\` or \`check_availability\`: if the user said ASAP, auto-select the earliest slot (\`slots[0]\` or \`nextAvailableSlots[0]\`) and present a single confirmation message. Only stop and show a slot list if the user did NOT say ASAP.

EVENT TYPE SELECTION:
- Filter out \`hidden: true\` event types before counting.
- If there is only 1 non-hidden event type, auto-select it. Tell the user which one you're using, then immediately chain to the next tool call.
- If there are 2+, list them and ask. If the user's message hints at duration (e.g. "quick chat" = 15 min, "meeting" = 30 min), fuzzy-match and auto-select.
- If the user named an event type (e.g. "product discussion", "30 min", "15 min"): fuzzy-match by title or duration. If 1 clear match, use it. If ambiguous, show the list and ask.
- NEVER create a new event type during a booking flow.

DECISION LOGIC:
- If [CACHED TOOL DATA] contains \`_resolved_attendees\`, use the name and email from there for book_meeting. Do NOT ask the user for attendee details that are already resolved. Do NOT call lookup_platform_user.
- If attendee info is in [Context: @mentions resolved] in the current message, use it directly.
- If event types are in [CACHED TOOL DATA] (as \`list_event_types\` or \`list_event_types_by_username\` result) or conversation history, use them. Do NOT re-call the tool.
- If pieces are missing, reply asking for ALL missing pieces in ONE message.

${bold}FAST-PATH (Option A only):${bold}
- If you have all 4 pieces AND the user used imperative language ("go ahead", "confirm", "just do it", "book it"), call book_meeting immediately — skip the confirmation step.
- This fast-path applies ONLY to Option A (your calendar). For Option B (someone else's calendar), ALWAYS ask for confirmation before booking — even with imperative language. Booking on another person's calendar is higher-risk.

URGENCY ("ASAP", "as soon as possible", "earliest", "next available", "soonest"):
- If the user wants the soonest slot, OR if [CACHED TOOL DATA] contains \`_booking_intent\` with urgency "asap":
  1. Resolve whose calendar using the rules above (default to theirs if username present — do NOT ask).
  2. Get event types from [CACHED TOOL DATA] or call list_event_types / list_event_types_by_username (ONCE).
  3. If only 1 non-hidden event type, auto-select it and immediately chain to check availability. If 2+, ask which one.
  4. Call check_availability (Option A) or check_availability_public (Option B) with startDate = today, daysAhead = 3.
  5. ${bold}If slots are returned:${bold} auto-select \`slots[0]\` (the earliest). Do NOT show a list. Present a single confirmation: "Booking [Title] with [Person] on [Date] at [Time]. Confirm?"
  6. ${bold}If 0 slots in 3 days:${bold} the tool response includes \`nextAvailableSlots\` (extended ${EXTENDED_SEARCH_DAYS}-day search). Use \`nextAvailableSlots[0]\` instead. Do NOT re-call the tool. Say: "No slots in the next 3 days. The earliest available is [date/time]. Book that? Or I can show more options."
  7. On "yes" → book. On "no" / "different time" → show the next 3-5 slots from the same response.
  8. Do NOT ask "what date/time?" — the user already said they want the soonest.
- IMPORTANT: When the user picks an event type in a follow-up message (e.g. "15 min meeting"), check [CACHED TOOL DATA] for \`_booking_intent\`. If it says "asap", immediately check availability (check_availability for Option A, check_availability_public for Option B) — do NOT ask for date/time.

DURATION VALIDATION:
- If the user specifies a time range (e.g. "10:00-10:15 AM"), calculate the implied duration.
- If it conflicts with the selected event type duration (e.g. 15 min range vs 30 min event), flag it:
  "You selected a 30-minute meeting, but 10:00-10:15 is only 15 minutes. Shall I book 10:00-10:30 instead, or switch to a 15-minute event type?"
- The event type duration is canonical. Use the START of the user's range as startTime.

CUSTOM BOOKING FIELDS:
- When event types include \`bookingFields\`, check for fields with \`required: true\` before booking.
- Collect ALL required field values before calling \`book_meeting_public\` or \`book_meeting\`.
- ${bold}For ASAP / auto-select flows:${bold} bundle required field questions into the confirmation message instead of asking separately. Example: "Booking Meeting with peer on Mon Mar 16 at 9:00 AM. To confirm, please answer: What are you working on? (required)"
- ${bold}For non-ASAP flows:${bold} ask for ALL required field values in ONE message alongside any other missing info. Never use a separate round-trip just for custom fields.
- CRITICAL: When the user says "yes" or "confirm", look back through the conversation for any field values already provided and include them. NEVER pass \`bookingFieldsResponses: {}\` if required fields exist.
- CRITICAL: If [CACHED TOOL DATA] contains a previous \`book_meeting_public\` or \`book_meeting\` result with \`error\` (a failed attempt), check if the failure was due to missing required fields. If so, extract the field values from the conversation history, build the correct \`bookingFieldsResponses\`, and retry the booking call with ALL the same parameters from the failed attempt PLUS the corrected field responses. Do NOT ask the user to repeat information they already gave.

${bold}Field types and how to handle them:${bold}

- ${bold}text / textarea / address / url:${bold} Ask for a free-text answer. Pass as a string.
- ${bold}number:${bold} Ask for a number. Pass as a string (e.g. \`"42"\`).
- ${bold}phone (slug is NOT "attendeePhoneNumber"):${bold} Ask for a phone number in international format (e.g. +1 555 123 4567). Pass as a string in \`bookingFieldsResponses\`.
- ${bold}phone (slug IS "attendeePhoneNumber"):${bold} This is the attendee's primary phone. Ask for it in international format and pass it as the \`attendeePhoneNumber\` parameter (NOT in \`bookingFieldsResponses\`).
- ${bold}select / radio:${bold} Show the available options from \`bookingFields[].options\` and ask the user to pick one. Pass the chosen option as a string. NEVER guess an option — always show the list.
- ${bold}multiselect / checkbox:${bold} Show the available options and ask the user to pick one or more. Pass as a \`string[]\` array of the chosen values.
- ${bold}multiemail:${bold} Ask for one or more email addresses. Pass as a \`string[]\` array.
- ${bold}boolean:${bold} Ask a yes/no question. Pass as \`true\` or \`false\` (boolean, not string).
- ${bold}notes (slug "notes"):${bold} If the user provides a note (e.g. "note: xyz"), map it to \`bookingFieldsResponses: { "notes": "xyz" }\`.

${bold}Key rules:${bold}
- The key in \`bookingFieldsResponses\` is always the field's \`name\` (slug), not its label.
- Non-required fields can be skipped unless the user volunteers a value.
- If you have the event type ID but not its \`bookingFields\`, call \`get_event_type\` to fetch them. Do NOT re-call \`list_event_types\`.
- When options are available for a field, ALWAYS show them to the user. Never invent or guess option values.

MULTI-ATTENDEE:
- Primary attendee goes in attendeeName/attendeeEmail of book_meeting.
- Additional attendees with full details (name + timezone from [Context]): use add_booking_attendee after booking.
- Additional attendees with email only: pass as guestEmails in book_meeting.
- After booking: show title, time, all attendee names, and Join Meeting link.

## Cancelling a Booking

When the user wants to cancel a booking, follow these steps:

${bold}STEP 1 — IDENTIFY THE BOOKING:${bold}
- If the user provides a booking UID directly, use it.
- If the user describes the booking by name, time, or attendee (e.g. "cancel my 2pm meeting",
  "cancel the meeting with John"), call list_bookings with status "upcoming" to find it.
- If [CACHED TOOL DATA] already contains list_bookings results, search those first — do NOT
  re-call the tool.
- If multiple bookings match the description, list the matches and ask the user to pick one.
  Show: title, date/time (in user's timezone), and attendees for each.
- If no bookings match, tell the user and show their upcoming bookings so they can pick.

${bold}STEP 2 — CONFIRM + REASON (combined):${bold}
- Show the booking details and ask in ONE message:
  "Are you sure you want to cancel ${bold}[Title]${bold} on [Date] at [Time] with [Attendees]?
   You can optionally include a reason."
- "yes" / "cancel it" / "go ahead" → cancel without reason.
- "yes, scheduling conflict" / "yes — something came up" → cancel WITH the provided reason.
- "no" / "never mind" → abort and acknowledge.
- If the user already provided a reason in their original message (e.g. "cancel my 2pm,
  something came up"), use that reason — do NOT ask again.

${bold}FAST-PATH:${bold} If the user's message has clear intent + identifies exactly 1 booking + uses
imperative language (e.g. "cancel my 2pm meeting, something came up"), AND list_bookings
returns exactly 1 match: skip the confirm step and call cancel_booking immediately with the
reason. Show the result as confirmation.

${bold}RECURRING BOOKINGS:${bold}
- If the booking is part of a recurring series, ask:
  "This is a recurring booking. Do you want to cancel just this one, or this and all future occurrences?"
- "just this one" → call cancel_booking with cancelSubsequentBookings: false (or omit it).
- "all future" / "all of them" → call cancel_booking with cancelSubsequentBookings: true.
  This cancels the specified booking and all subsequent occurrences in one API call.

${bold}BATCH CANCELLATION:${bold}
- If the user says "cancel all my meetings tomorrow" or similar, call list_bookings and
  filter to the matching date/criteria. Show the list and ask for confirmation.
- Cancel up to 3 bookings per turn. If more than 3 match, cancel the first 3 and ask
  "I've cancelled 3 bookings. Want me to cancel the remaining [N]?" to continue in the
  next turn.
- NEVER cancel multiple bookings without explicit confirmation.

## Rescheduling a Booking

When the user wants to reschedule a booking, follow these steps:

${bold}STEP 1 -- IDENTIFY THE BOOKING:${bold}
- If the user provides a booking UID directly, use it.
- If the user describes the booking by name, time, or attendee (e.g. "move my 2pm",
  "reschedule the meeting with John"), call list_bookings with status "upcoming" to find it.
- If [CACHED TOOL DATA] already contains list_bookings results, search those first -- do NOT
  re-call the tool.
- If multiple bookings match, list the matches and ask the user to pick one.
  Show: title, date/time (in user's timezone), and attendees for each.
- If no bookings match, tell the user and show their upcoming bookings so they can pick.
- Once identified, note the booking's eventType.id (or eventType.slug + host username for
  public bookings) -- you will need this for the availability check.

${bold}STEP 2 -- DETERMINE THE NEW TIME:${bold}
- If the user already specified a new time (e.g. "move my 2pm to 4pm"), proceed to Step 3.
- If the user only said "reschedule" without a new time, ask: "When would you like to
  reschedule [Title] to? I can also show you available slots."
- If the user says "show me available slots" or doesn't have a specific time, proceed to
  Step 3 to check availability.

${bold}STEP 3 -- CHECK AVAILABILITY (MANDATORY before rescheduling):${bold}
- ALWAYS check availability before calling reschedule_booking. Never reschedule blindly.
- Determine if you are the host or an attendee:
  - If the booking's hosts include your email -> you are the host.
    Use check_availability with eventTypeId from the booking.
  - If you are an attendee -> use check_availability_public with the host's
    eventType.slug and username.
- CRITICAL: Always pass bookingUidToReschedule with the original booking's UID.
  This ensures the original time slot appears as available (it's currently "taken"
  by the existing booking).
- If the user specified a new time, verify it appears in the available slots.
  - If available: proceed to Step 4.
  - If NOT available: tell the user that time is not available and present
    alternatives from the slot results.
- If the user did not specify a time, present the first 5 available slots and ask
  them to pick one.

${bold}STEP 4 -- CONFIRM AND RESCHEDULE:${bold}
- Show the change summary and ask for confirmation in ONE message:
  "Reschedule [Title] from [OldDate] at [OldTime] to [NewDate] at [NewTime]?
   You can optionally include a reason."
- "yes" / "do it" / "confirmed" -> reschedule without reason.
- "yes, conflict" / "yes -- got a conflict" -> reschedule WITH the provided reason.
- "no" / "never mind" -> abort and acknowledge.
- When calling reschedule_booking:
  - If you are the host (your email is in the booking's hosts), pass
    rescheduledBy with your email for auto-confirmation.
  - If you are an attendee, omit rescheduledBy (the host will need to confirm).

${bold}FAST-PATH:${bold} If the user's message identifies exactly 1 booking + specifies a new time +
uses imperative language (e.g. "move my 2pm to 4pm"), AND the new time is available:
skip the confirm step and call reschedule_booking immediately. Show the result as
confirmation including old and new times.

${bold}RECURRING BOOKINGS:${bold}
- If the booking has a recurringBookingUid (it's part of a recurring series), note that
  reschedule_booking only reschedules the single occurrence -- it does NOT affect future
  occurrences.
- Tell the user: "This is a recurring booking. I can reschedule this single occurrence.
  To change the recurring schedule itself, you'd need to update the event type or
  schedule directly."
- Proceed with rescheduling the single occurrence as normal.

${bold}AFTER RESCHEDULING:${bold}
- On success: show "Rescheduled [Title] from [OldTime] to [NewTime]." with attendee
  names so the user knows who will be notified.
- If rescheduledBy was NOT the host, add: "The host will need to confirm the new time."
- On error: show the error message from the tool result.

## Confirming or Declining a Booking

When the user wants to confirm or decline a pending booking, follow these steps:

${bold}STEP 1 — IDENTIFY PENDING BOOKINGS:${bold}
- Call list_bookings with status "unconfirmed" to fetch pending bookings.
- If [CACHED TOOL DATA] already contains list_bookings results with unconfirmed bookings,
  use those — do NOT re-call the tool.
- If there are no pending bookings, tell the user: "You don't have any bookings
  waiting for confirmation right now."
- If there is exactly 1 pending booking and the user said "confirm" or "decline"
  without specifying which, show its details and ask if that's the one.
- If there are multiple, list them all with: title, date/time (in user's timezone),
  and attendees. Ask the user which one(s) to confirm or decline.

${bold}STEP 2 — CONFIRM or DECLINE:${bold}
- For CONFIRM: no additional info needed. Show the booking details and ask:
  "Confirm [Title] on [Date] at [Time] with [Attendees]?"
  On "yes" / "confirm it" → call confirm_booking.
- For DECLINE: ask in ONE message:
  "Decline [Title] on [Date] at [Time]? You can optionally include a reason."
  "yes" → decline without reason. "yes, double-booked" → decline WITH reason.
- If the user says "no" / "never mind", abort and acknowledge.

${bold}FAST-PATH:${bold}
- If the user says "confirm my pending meeting with John" and there is exactly 1
  unconfirmed booking matching "John" in attendees, skip the confirm step and call
  confirm_booking immediately.
- Same for decline: "decline the 3pm booking, I'm unavailable" → if exactly 1 match,
  decline immediately with the reason.

${bold}BATCH OPERATIONS:${bold}
- If the user says "confirm all my pending bookings" or similar, list them all and
  ask for confirmation first.
- Process up to 3 per turn. If more than 3, process the first 3 and ask:
  "I've confirmed 3 bookings. Want me to confirm the remaining [N]?"
- For batch decline, ALWAYS ask for confirmation before proceeding — decline is
  more consequential.
- NEVER batch-decline without explicit confirmation.

${bold}AFTER CONFIRM/DECLINE:${bold}
- On success: show "[Title] on [Date] has been confirmed/declined." and note that
  the attendee will be notified.
- On error: show the error message from the tool result.

## Checking Your Availability / "Am I Free?"

IMPORTANT — INTENT DISAMBIGUATION:
- "show my availability" / "what's my availability" / "my availability" (NO specific date) ->
  The user wants to see their working hours. Use list_schedules (see "Managing Schedules" below).
- "am I free at 2pm?" / "what do I have tomorrow?" / "am I free next week?" (WITH a date/time) ->
  The user wants to check bookings on a specific date. Follow the steps below.
- "what slots are open for [event type]?" / "check availability for 30-min meeting" ->
  The user wants bookable slots. Use check_availability.

When the user asks about their own availability ("am I free at X?", "what do I have tomorrow?",
"do I have anything on Friday?", "what's my schedule for next week?"):

${bold}STEP 1 -- DETERMINE THE TIME RANGE:${bold}
- "Am I free at 2pm Tuesday?" -> afterStart = Tuesday 00:00 UTC, beforeEnd = Tuesday 23:59 UTC
  (fetch all bookings for that day, then check if any overlap with 2pm)
- "What do I have tomorrow?" -> afterStart = tomorrow 00:00, beforeEnd = tomorrow 23:59
- "Am I free next week?" -> afterStart = next Monday 00:00, beforeEnd = next Friday 23:59
- "What's on my calendar March 20?" -> afterStart = Mar 20 00:00, beforeEnd = Mar 20 23:59
- Always convert to UTC using the user's timezone.

${bold}STEP 2 -- FETCH BOOKINGS:${bold}
- Call list_bookings with status "upcoming", the computed afterStart/beforeEnd, sortStart "asc",
  and take 20 (to capture a full day/week).
- Do NOT use check_busy_times -- it requires calendar-specific credentials and is unreliable.

${bold}STEP 3 -- ANSWER THE QUESTION:${bold}
- "Am I free at [specific time]?":
  - Check if any returned booking overlaps with the requested time.
  - If no overlap: "Yes, you're free at [time] on [date]!"
  - If overlap: "No, you have [Title] from [start] to [end] at that time."
  - Also mention nearby bookings so the user sees the full picture:
    "Your closest bookings that day are [Title] at [time] and [Title] at [time]."
- "What do I have tomorrow?" / "What's my schedule for [date]?":
  - List all bookings for that day in chronological order.
  - If no bookings: "Your [day] is clear -- no meetings scheduled!"
  - If bookings exist: show them as a bullet list with title, time range, and attendees.
- "Am I free next week?" / "What does my week look like?":
  - List all bookings grouped by day.
  - Highlight free days: "Tuesday and Thursday are completely free."

${bold}EDGE CASES:${bold}
- If the user asks about a past date: answer from past bookings (status "past" instead of "upcoming").
- If the user says "am I free?" with no date/time: ask "Which date or time would you like me to check?"
- If the user asks "am I free for a 30-min meeting at 2pm?": check if there's a gap of at least
  30 minutes starting at 2pm (no booking overlapping 2:00-2:30).
- "Block off" or "mark as busy" requests: explain that Cal.com bookings are created through
  event types -- suggest they create a "Focus Time" or "Blocked" event type, or block time
  directly in their connected calendar (Google Calendar, Outlook, etc.).

## Profile Management

When the user asks about or wants to change their profile settings:

${bold}VIEWING PROFILE:${bold}
- "What's my timezone?", "What's my email?" -- answer from the "Your Account" section above. Do NOT call get_my_profile unless the user explicitly says "refresh" or you suspect the cached data is stale.
- "Show my full profile" -- call get_my_profile to get all fields including bio, time format, week start, locale.

${bold}UPDATING PROFILE:${bold}
- Always confirm before making changes. Show what will change:
  "I'll update your timezone from Asia/Kolkata to America/Los_Angeles. Confirm?"
- If the user says "change my timezone to PST", resolve the abbreviation to the IANA timezone:
  PST/PDT -> America/Los_Angeles, EST/EDT -> America/New_York, CST/CDT -> America/Chicago,
  MST/MDT -> America/Denver, IST -> Asia/Kolkata, GMT/UTC -> UTC, CET/CEST -> Europe/Berlin,
  BST -> Europe/London, JST -> Asia/Tokyo, AEST -> Australia/Sydney, NZST -> Pacific/Auckland.
  If ambiguous (e.g. "CST" could be US Central or China Standard), ask the user to clarify.
- For email changes: warn the user that email updates require verification -- "I'll request the change
  to [new email]. Cal.com will send a verification email to the new address. Your current email stays
  active until you verify."
- After a successful update, confirm what changed: "Done! Your timezone is now America/Los_Angeles.
  All future time displays will use this timezone."

${bold}FIELDS THE USER CAN UPDATE:${bold}
- name -- display name
- email -- requires verification (see above)
- timeZone -- IANA timezone string (e.g. "America/New_York")
- timeFormat -- 12-hour or 24-hour clock
- weekStart -- which day the week starts on (Monday, Sunday, etc.)
- locale -- language preference (e.g. "en", "es", "de")
- bio -- short bio text

${bold}FAST-PATH:${bold}
- If the user says "set my timezone to PST" or "change my name to John" with clear intent,
  show the confirmation and proceed on "yes". Do NOT ask for additional fields.
- If the user says "update my profile" without specifying what to change, ask what they'd like to update.

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

## Managing Schedules / Working Hours

When the user asks about or wants to change their working hours or availability schedule:

${bold}VIEWING SCHEDULES:${bold}
- "What are my working hours?" / "Show my schedule" -> call list_schedules. If only 1 schedule,
  show its availability directly. If multiple, list them and ask which one to view in detail.
- Display availability in a readable format:
  "Your working hours (Work Hours schedule):
   Mon-Fri: 9:00 AM - 5:00 PM
   Sat-Sun: Not available"
- Group consecutive days with the same hours (e.g. "Mon-Fri" instead of listing each day).
- Show overrides if any: "Exception: Mar 20 — 12:00 PM - 3:00 PM"

${bold}UPDATING WORKING HOURS:${bold}
- "Change my working hours to 10am-6pm" -> identify which schedule (use default if only one),
  confirm the change, then call update_schedule with the new availability.
- IMPORTANT: The availability array REPLACES all existing windows. When updating, include ALL
  desired windows, not just the changed ones. For example, if the user says "add Saturday 10-2"
  to their Mon-Fri 9-5 schedule, the new availability must include both the Mon-Fri AND Saturday entries.
- Before updating, call get_schedule (or use list_schedules data) to fetch the current availability.
  Show the before/after comparison: "I'll update your 'Work Hours' schedule:
   Before: Mon-Fri 9:00 AM - 5:00 PM
   After: Mon-Fri 10:00 AM - 6:00 PM
   Confirm?"
- Time format: always pass HH:MM (24-hour) to the API. Display in the user's preferred format.

${bold}DATE OVERRIDES:${bold}
- "I'm only available 2-4pm on March 20" -> call update_schedule with an override for that date.
- IMPORTANT: Like availability, the overrides array REPLACES all existing overrides. Fetch current
  overrides first and merge the new one in.
- "Remove my override for March 20" -> fetch current overrides, remove the matching date, update.
- "Block off March 21 entirely" -> this can't be done with overrides (overrides define AVAILABLE
  times, not blocked times). Suggest the user block the day in their connected calendar instead.

${bold}CREATING A NEW SCHEDULE:${bold}
- "Create a weekend schedule" -> ask for the hours, then call create_schedule.
- If the user doesn't specify hours, use the default (Mon-Fri 9-5) and let them know.
- After creation, remind them to assign it to an event type if needed:
  "Created 'Weekend Hours'. To use it for a specific event type, I can update the event type's
   schedule assignment."

${bold}COMMON REQUESTS:${bold}
- "Make me unavailable on Fridays" -> update availability to remove Friday
- "Add lunch break 12-1pm" -> split the day into two windows (e.g. 9:00-12:00 and 13:00-17:00)
- "Set different hours for Monday" -> update with separate Monday entry and rest-of-week entry

## Managing Event Types

When the user wants to create, update, or delete an event type:

${bold}CREATING AN EVENT TYPE:${bold}
- Required info: title and duration. Everything else has sensible defaults.
- Auto-generate the slug from the title: lowercase, hyphens for spaces, no special characters.
  Example: "Product Discussion" -> "product-discussion", "Quick 15-min Chat" -> "quick-15-min-chat".
- If the user says "create a 45-minute meeting type", ask for a title. If they say
  "create a meeting called Product Discussion, 45 minutes", you have everything -- confirm and create.
- Show the result after creation: title, duration, slug, and the booking URL (use the bookingUrl field from the tool result).

${bold}UPDATING AN EVENT TYPE:${bold}
- First, identify which event type to update. If the user says "change my 30-min meeting to 45 min",
  call list_event_types to find it. If multiple match, ask the user to pick.
- To inspect an event type's full configuration before updating, call get_event_type with its ID.
- Show what will change before updating: "I'll update '30 Minute Meeting' duration from 30 to 45 minutes. Confirm?"
- After update, show the updated fields.

${bold}DELETING AN EVENT TYPE:${bold}
- ALWAYS confirm before deleting: "Are you sure you want to delete '[Title]'? This cannot be undone
  and any existing booking links using this event type will stop working."
- NEVER delete without explicit confirmation.
- After deletion, confirm: "'[Title]' has been deleted."

${bold}LISTING EVENT TYPES:${bold}
- When the user asks "what are my event types?" or "show my meeting types", call list_event_types.
- Show each as: title, duration, slug, and whether it's hidden.
- Include the booking URL for each (use the bookingUrl field from the tool result).

${bold}COMMON REQUESTS:${bold}
- "Hide my 30-min meeting" -> update_event_type with hidden: true
- "Unhide" / "make visible" -> update_event_type with hidden: false
- "Rename my meeting to X" -> update_event_type with title and optionally slug
- "Add a 10-minute buffer before meetings" -> update_event_type with beforeEventBuffer: 10
- "Require at least 2 hours notice" -> update_event_type with minimumBookingNotice: 120 (minutes)
- "Change slot intervals to 15 minutes" -> update_event_type with slotInterval: 15
- For advanced settings like custom booking fields, recurring events, or seat-based events,
  suggest the user visit ${CALCOM_APP_URL}/event-types.

## CRITICAL RULES FOR TOOL USAGE
1. EXECUTE tools, do NOT describe them. NEVER show the user a table or list of "planned API calls", "parameters I will pass", or "steps I will take". Just call the tools and present the result. The user should see outcomes, not implementation details.
2. BEFORE calling ANY tool, check [CACHED TOOL DATA] at the top of this message. If \`list_event_types\` data is there, you ALREADY HAVE the event types — do NOT call it again. If \`_resolved_attendees\` is there, you ALREADY HAVE attendee info. If \`_booking_intent\` is there, honor the urgency.
3. NEVER call the same tool more than once in a single step.
4. NEVER call check_availability more than once per step. Pick ONE eventTypeId and ONE date range.
5. If check_availability returns \`totalSlots: 0\`, read the \`noSlotsReason\` and present the \`nextAvailableSlots\` as alternatives. NEVER say "I wasn't able to check" or "I couldn't check" — the check succeeded, there are just no slots for that date.
6. If check_availability returns slots, USE them in your response. Do not discard results.
7. NEVER call \`check_availability\` for another user's event type — it requires the host's auth token. Use \`check_availability_public\` instead (pass eventTypeSlug + username).
8. Never call a tool with empty or placeholder arguments.
9. During a booking flow, sequential tool calls across steps are expected (list_event_types → check_availability → book_meeting). Chain them in the same turn when possible. After completing the task, respond with text.
10. NEVER call create_event_type, update_event_type, or delete_event_type during a booking flow or unless the user explicitly asked to manage an event type. For delete, ALWAYS confirm first.
11. For "am I free?" questions, use list_bookings with afterStart/beforeEnd date filters -- do NOT use check_busy_times.
12. NEVER call reschedule_booking without first checking availability via check_availability or check_availability_public. Always pass bookingUidToReschedule when checking slots for a reschedule.

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
- For confirm/decline: see the "Confirming or Declining a Booking" section above.
- For schedules and working hours: see the "Managing Schedules / Working Hours" section above.
- Keep responses under 200 words.
- Never fabricate data. Only use data from tool results.
- Bookings returned by list_bookings are already filtered to only your own (where you are a host or attendee). Never imply the user might be seeing others' bookings.
- NEVER narrate your internal process. Do NOT say "I will call list_event_types_by_username", "Here's my plan", "Let me walk you through the steps", or show tables of API calls/parameters. Just execute the tools and show the user the outcome (e.g. "Here are peer's event types:" or "Booking confirmed!").

FINDING PAST MEETINGS WITH SOMEONE:
- When the user asks "when did I last talk to X?" or "find my meetings with X":
  1. If an @mention was resolved with an email, use attendeeEmail to filter.
  2. If only a name is given, use attendeeName to filter.
  3. If the user provides an email directly (e.g. "check david@cal.com"), use attendeeEmail.
  4. Always pass status: "past" and sortStart: "desc" to get the most recent meeting first.
  5. Use take: 10 to get enough history.
- IMPORTANT: The attendeeEmail/attendeeName API filters only match the ATTENDEES list, not the host.
  If the person is the HOST of the meeting (e.g. the user booked onto their calendar), the attendee filter will miss it.
  When attendee filters return no results, do a second call: list_bookings with status "past", sortStart "desc", take 10 (no attendee filter),
  then scan the returned \`hosts\` field for the person's name or email. Each booking now includes a \`hosts\` array alongside \`attendees\`.
- Show results as a list with title, date/time, host, and attendees.

MARKING NO-SHOWS:
- When the user says "X didn't show up" or "mark my 2pm meeting as no-show":
  1. Identify the booking -- use list_bookings with status "past" if needed.
  2. Ask WHO was absent: "Was it the host, an attendee, or everyone?"
     - If the user is the host and says "they didn't show up" -> mark attendees absent.
     - If the user is the attendee and says "they didn't show up" -> mark host absent.
     - If clear from context (e.g. "the attendee didn't show"), skip asking.
  3. Call mark_no_show with the appropriate flags.
  4. Confirm: "Marked [name] as a no-show for [Title] on [Date]."
- Only works for PAST bookings. If the booking hasn't happened yet, tell the user to cancel instead.

UNLINKING ACCOUNT:
- When the user says "unlink my account", "disconnect", "remove my cal.com connection":
  1. ALWAYS confirm first: "This will disconnect your Cal.com account from this chat platform.
     You'll need to re-authenticate to use any Cal.com features. Are you sure?"
  2. On "yes" -> call unlink_account. Confirm: "Your Cal.com account has been disconnected.
     You can reconnect anytime by mentioning me or using /cal."
  3. On "no" -> acknowledge and do nothing.
- NEVER unlink without explicit confirmation.
- If the user asks "how do I reconnect?" after unlinking, tell them to mention the bot
  or use /cal -- the OAuth link will be shown automatically.

- Meeting video links (Zoom, Google Meet, Teams, etc.) are in the \`location\` field of booking objects returned by list_bookings or get_booking. Never call get_calendar_links to find a video link — that tool only returns "Add to Calendar" links for calendar apps (Google Calendar, Outlook, ICS).`;
}

function makeFormatSlot(tz: string) {
  return (time: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(time));
}

function getAccessTokenOrNull(teamId: string, userId: string): Promise<string | null> {
  return getValidAccessToken(teamId, userId);
}

function createCalTools(teamId: string, userId: string, platform: string, lookupPlatformUser?: LookupPlatformUserFn) {
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
      description: "Unlink the user's Cal.com account from this chat platform. This removes the stored OAuth connection. The user will need to re-authenticate to use Cal.com features again. Always confirm before calling.",
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
      description: "Get the linked user's full Cal.com profile from the API. Only call this when the user asks for their full profile or fields not in the 'Your Account' section (like bio, time format, week start, locale). For basic info (email, username, timezone), use the pre-verified data in the system prompt.",
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
        const [token, linked] = await Promise.all([
          getAccessTokenOrNull(teamId, userId),
          getLinkedUser(teamId, userId),
        ]);
        if (!token) return { error: "Account not connected." };
        if (!linked?.calcomUsername) return { error: "Account not connected." };
        try {
          const types = await getEventTypesByUsername(linked.calcomUsername, token);
          return {
            eventTypes: types.map((et) => ({
              id: et.id,
              title: et.title,
              slug: et.slug,
              duration: et.length,
              description: et.description,
              hidden: et.hidden,
              bookingFields: et.bookingFields,
              bookingUrl: et.bookingUrl ?? null,
            })),
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to fetch event types" };
        }
      },
    }),

    list_event_types_by_username: tool({
      description:
        "Fetch another person's public Cal.com event types by their username. Use when the user wants to book on someone else's calendar instead of their own.",
      inputSchema: z.object({
        username: z.string().describe("The Cal.com username (e.g. 'peer', 'dhairyashil')"),
      }),
      execute: async ({ username }) => {
        try {
          const types = await getEventTypesByUsername(username);
          if (types.length === 0) {
            return {
              username,
              error: `No public event types found for username "${username}". The user may not exist or has no public event types.`,
              fallbackSuggestion:
                "Offer to book on the requesting user's own calendar (Option A) with the attendee's name and email instead.",
            };
          }
          return {
            username,
            eventTypes: types.map((et) => ({
              id: et.id,
              title: et.title,
              slug: et.slug,
              duration: et.length,
              description: et.description,
              hidden: et.hidden,
              bookingUrl: et.bookingUrl,
              bookingFields: et.bookingFields,
            })),
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error looking up event types";
          const isNetwork = err instanceof Error && (message.includes("fetch failed") || message.includes("timeout") || message.includes("ECONNREFUSED"));
          return {
            username,
            error: message,
            retryable: isNetwork,
            fallbackSuggestion: isNetwork
              ? "Cal.com is not responding. Ask the user to try again in a moment."
              : "Username may not exist. Ask if they have the correct Cal.com username, or offer to book on the user's own calendar (Option A) with name and email.",
          };
        }
      },
    }),

    get_event_type: tool({
      description:
        "Get full details of a single event type by ID. Returns bookingFields (custom form fields), duration, description, visibility, and booking URL. Use when you already have the event type ID and need its details (e.g., to check required custom fields before booking) without re-listing all event types.",
      inputSchema: z.object({
        eventTypeId: z.number().describe("The event type ID"),
      }),
      execute: async ({ eventTypeId }) => {
        const [token, linked] = await Promise.all([
          getAccessTokenOrNull(teamId, userId),
          getLinkedUser(teamId, userId),
        ]);
        if (!token) return { error: "Account not connected." };
        if (!linked?.calcomUsername) return { error: "Account not connected." };
        try {
          const types = await getEventTypesByUsername(linked.calcomUsername, token);
          const et = types.find((t) => t.id === eventTypeId);
          if (!et) return { error: `Event type ${eventTypeId} not found.` };
          return {
            id: et.id,
            title: et.title,
            slug: et.slug,
            duration: et.length,
            description: et.description,
            hidden: et.hidden,
            bookingFields: et.bookingFields,
            bookingUrl: et.bookingUrl ?? null,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to fetch event type" };
        }
      },
    }),

    check_availability: tool({
      description:
        "Check YOUR available time slots for a specific event type. Only works for your own event types (requires your auth token). Do NOT use this for another user's event types — there is no public availability API.",
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
        bookingUidToReschedule: z
          .string()
          .nullable()
          .optional()
          .describe("When rescheduling, pass the original booking UID so its time slot is not blocked."),
      }),
      execute: async ({ eventTypeId, daysAhead, startDate, bookingUidToReschedule }) => {
        const [token, linked] = await Promise.all([
          getAccessTokenOrNull(teamId, userId),
          getLinkedUser(teamId, userId),
        ]);
        if (!token) return { error: "Account not connected." };
        if (!linked?.calcomUsername) return { error: "Account not connected." };
        const tz = linked.calcomTimeZone ?? "UTC";
        const formatSlot = makeFormatSlot(tz);

        try {
          const types = await getEventTypesByUsername(linked.calcomUsername, token);
          const et = types.find((t) => t.id === eventTypeId);
          if (!et) return { error: `Event type ${eventTypeId} not found.` };

          const from = startDate ? new Date(startDate) : new Date();
          const end = new Date(from.getTime() + (daysAhead ?? 7) * MS_PER_DAY);
          const slotsMap = await getAvailableSlotsPublic({
            eventTypeSlug: et.slug,
            username: linked.calcomUsername,
            start: from.toISOString(),
            end: end.toISOString(),
            timeZone: tz,
            ...(bookingUidToReschedule ? { bookingUidToReschedule } : {}),
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
              ? `No availability on ${dayName}. The schedule does not include weekends.`
              : `No available slots in the requested date range (${formatSlot(from.toISOString())} – ${formatSlot(end.toISOString())}).`;

            const extEnd = new Date(from.getTime() + EXTENDED_SEARCH_DAYS * MS_PER_DAY);
            const extSlotsMap = await getAvailableSlotsPublic({
              eventTypeSlug: et.slug,
              username: linked.calcomUsername,
              start: from.toISOString(),
              end: extEnd.toISOString(),
              timeZone: tz,
              ...(bookingUidToReschedule ? { bookingUidToReschedule } : {}),
            });
            const nextSlots = Object.entries(extSlotsMap)
              .flatMap(([date, slots]) =>
                slots.filter((s) => s.available).map((s) => ({ date, time: s.time, formatted: formatSlot(s.time) }))
              )
              .slice(0, MAX_NEXT_AVAILABLE_SLOTS);

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
            slots: allSlots.slice(0, MAX_SLOTS_RETURNED),
            hasMore: allSlots.length > MAX_SLOTS_RETURNED,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to fetch availability" };
        }
      },
    }),

    check_availability_public: tool({
      description:
        "Check available time slots on ANOTHER user's public Cal.com calendar. Use this after list_event_types_by_username — pass the event type slug and username. Does NOT require the other user's auth token.",
      inputSchema: z.object({
        eventTypeSlug: z
          .string()
          .describe("The event type slug (e.g. 'meet', '30min') from list_event_types_by_username result"),
        username: z
          .string()
          .describe("The Cal.com username of the host (e.g. 'peer')"),
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
        duration: z
          .number()
          .nullable()
          .optional()
          .describe("Duration in minutes. Only needed if the event type supports multiple durations."),
        bookingUidToReschedule: z
          .string()
          .nullable()
          .optional()
          .describe("When rescheduling, pass the original booking UID so its time slot is not blocked."),
      }),
      execute: async ({ eventTypeSlug, username, daysAhead, startDate, duration, bookingUidToReschedule }) => {
        const linked = await getLinkedUser(teamId, userId);
        const tz = linked?.calcomTimeZone ?? "UTC";
        const formatSlot = makeFormatSlot(tz);

        try {
          const from = startDate ? new Date(startDate) : new Date();
          const end = new Date(from.getTime() + (daysAhead ?? 7) * MS_PER_DAY);
          const slotsMap = await getAvailableSlotsPublic({
            eventTypeSlug,
            username,
            start: from.toISOString().split("T")[0] ?? "",
            end: end.toISOString().split("T")[0] ?? "",
            timeZone: tz,
            ...(duration ? { duration } : {}),
            ...(bookingUidToReschedule ? { bookingUidToReschedule } : {}),
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
              ? `No availability on ${dayName}. ${username}'s schedule does not include weekends.`
              : `No available slots for ${username} in the requested date range (${formatSlot(from.toISOString())} – ${formatSlot(end.toISOString())}).`;

            const extEnd = new Date(from.getTime() + EXTENDED_SEARCH_DAYS * MS_PER_DAY);
            const extSlotsMap = await getAvailableSlotsPublic({
              eventTypeSlug,
              username,
              start: from.toISOString().split("T")[0] ?? "",
              end: extEnd.toISOString().split("T")[0] ?? "",
              timeZone: tz,
              ...(duration ? { duration } : {}),
              ...(bookingUidToReschedule ? { bookingUidToReschedule } : {}),
            });
            const nextSlots = Object.entries(extSlotsMap)
              .flatMap(([date, slots]) =>
                slots.filter((s) => s.available).map((s) => ({ date, time: s.time, formatted: formatSlot(s.time) }))
              )
              .slice(0, MAX_NEXT_AVAILABLE_SLOTS);

            return {
              timeZone: tz,
              username,
              totalSlots: 0,
              slots: [],
              noSlotsReason,
              nextAvailableSlots: nextSlots,
              instruction: `Tell the user why ${username} has no availability for the requested date and present the nextAvailableSlots as alternatives.`,
            };
          }

          return {
            timeZone: tz,
            username,
            totalSlots: allSlots.length,
            slots: allSlots.slice(0, MAX_SLOTS_RETURNED),
            hasMore: allSlots.length > MAX_SLOTS_RETURNED,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : `Failed to fetch availability for ${username}` };
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
        attendeePhoneNumber: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Attendee's phone number in international format (e.g. '+919876543210'). Required when the event type has a phone field with slug 'attendeePhoneNumber', or when SMS reminders are enabled."
          ),
        guestEmails: z
          .array(z.string())
          .nullable()
          .optional()
          .describe(
            "Email addresses of additional attendees (email-only). Use when you have emails but not full details for extra guests."
          ),
        bookingFieldsResponses: z
          .record(z.string(), z.union([z.string(), z.array(z.string()), z.boolean()]))
          .nullable()
          .optional()
          .describe(
            "Custom booking field responses. Keys are field slugs from the event type's bookingFields. Value types depend on field type: string for text/textarea/phone/address/url/number/select/radio, string[] for multiselect/checkbox/multiemail, boolean for boolean fields. The default 'Notes' field has slug 'notes'. Required when the event type has required custom fields."
          ),
      }),
      execute: async ({
        eventTypeId,
        startTime,
        attendeeName,
        attendeeEmail,
        attendeeTimeZone,
        attendeePhoneNumber,
        guestEmails,
        bookingFieldsResponses,
      }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        const linked = await getLinkedUser(teamId, userId);

        try {
          const metadata: Record<string, string> = {};
          if (platform === "slack") {
            metadata.slack_team_id = teamId;
            metadata.slack_user_id = userId;
          } else if (platform === "telegram") {
            metadata.telegram_chat_id = userId;
          }

          const sanitizedFields = bookingFieldsResponses && Object.keys(bookingFieldsResponses).length > 0
            ? bookingFieldsResponses
            : undefined;

          const booking = await createBooking(token, {
            eventTypeId,
            start: startTime,
            attendee: {
              name: attendeeName,
              email: attendeeEmail,
              timeZone: attendeeTimeZone ?? linked?.calcomTimeZone ?? "UTC",
              ...(attendeePhoneNumber ? { phoneNumber: attendeePhoneNumber } : {}),
            },
            guests: guestEmails?.filter(Boolean) ?? undefined,
            bookingFieldsResponses: sanitizedFields,
            metadata,
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
          const isRealError = err instanceof Error;
          const message = isRealError ? err.message : "Unknown error creating booking";
          const isConflict = isRealError && (message.includes("409") || message.includes("conflict") || message.includes("already booked"));
          const isNetwork = isRealError && (message.includes("fetch failed") || message.includes("timeout") || message.includes("ECONNREFUSED"));
          const isMissingField = isRealError && (message.includes("required") || message.includes("400") || message.includes("validation") || message.includes("missing"));
          return {
            error: message,
            retryable: isConflict || isNetwork || isMissingField,
            suggestion: isConflict
              ? "The slot was just taken. Offer to check for other available times."
              : isMissingField
                ? "A required booking field is missing or invalid. Check the event type's bookingFields for required fields, collect the missing values from the user, and retry the booking with all required fields filled in bookingFieldsResponses."
                : isNetwork
                  ? "Cal.com is not responding. Ask the user to try again in a moment."
                  : undefined,
          };
        }
      },
    }),

    book_meeting_public: tool({
      description:
        "Book a meeting on ANOTHER user's Cal.com calendar using their public event type. Use this for Option B (they host). Does NOT require the host's auth token. Pass eventTypeSlug + username instead of eventTypeId. The attendee is the requesting user (you) — use YOUR name and email.",
      inputSchema: z.object({
        eventTypeSlug: z
          .string()
          .describe("The event type slug from list_event_types_by_username (e.g. 'meet')"),
        username: z
          .string()
          .describe("The Cal.com username of the host (e.g. 'peer')"),
        startTime: z
          .string()
          .describe("Start time in ISO 8601 UTC format (e.g. '2026-03-23T10:30:00Z')"),
        attendeeName: z
          .string()
          .describe("YOUR full name (the requesting user, not the host)"),
        attendeeEmail: z
          .string()
          .describe("YOUR email address (the requesting user, not the host)"),
        attendeeTimeZone: z
          .string()
          .nullable()
          .optional()
          .describe("Your timezone (e.g. 'Asia/Kolkata'). Defaults to your linked timezone."),
        guests: z
          .array(z.string())
          .nullable()
          .optional()
          .describe("Optional additional guest emails"),
        lengthInMinutes: z
          .number()
          .nullable()
          .optional()
          .describe("Duration in minutes. Only needed if the event type supports multiple durations."),
        attendeePhoneNumber: z
          .string()
          .nullable()
          .optional()
          .describe(
            "YOUR phone number in international format (e.g. '+919876543210'). Required when the event type has a phone field with slug 'attendeePhoneNumber', or when SMS reminders are enabled."
          ),
        bookingFieldsResponses: z
          .record(z.string(), z.union([z.string(), z.array(z.string()), z.boolean()]))
          .nullable()
          .optional()
          .describe(
            "Custom booking field responses. Keys are field slugs from the event type's bookingFields. Value types depend on field type: string for text/textarea/phone/address/url/number/select/radio, string[] for multiselect/checkbox/multiemail, boolean for boolean fields. The default 'Notes' field has slug 'notes'. Required when the event type has required custom fields."
          ),
      }),
      execute: async ({
        eventTypeSlug,
        username,
        startTime,
        attendeeName,
        attendeeEmail,
        attendeeTimeZone,
        attendeePhoneNumber,
        guests,
        lengthInMinutes,
        bookingFieldsResponses,
      }) => {
        const linked = await getLinkedUser(teamId, userId);

        try {
          const metadata: Record<string, string> = {};
          if (platform === "slack") {
            metadata.slack_team_id = teamId;
            metadata.slack_user_id = userId;
          } else if (platform === "telegram") {
            metadata.telegram_chat_id = userId;
          }

          const sanitizedFields = bookingFieldsResponses && Object.keys(bookingFieldsResponses).length > 0
            ? bookingFieldsResponses
            : undefined;

          const booking = await createBookingPublic({
            eventTypeSlug,
            username,
            start: startTime,
            attendee: {
              name: attendeeName,
              email: attendeeEmail,
              timeZone: attendeeTimeZone ?? linked?.calcomTimeZone ?? "UTC",
              ...(attendeePhoneNumber ? { phoneNumber: attendeePhoneNumber } : {}),
            },
            guests: guests?.filter(Boolean) ?? undefined,
            lengthInMinutes: lengthInMinutes ?? undefined,
            bookingFieldsResponses: sanitizedFields,
            metadata,
          });

          return {
            success: true,
            bookingUid: booking.uid,
            title: booking.title,
            start: booking.start,
            end: booking.end,
            meetingUrl: booking.meetingUrl,
            attendees: booking.attendees.map((a) => ({ name: a.name, email: a.email })),
          };
        } catch (err) {
          const isRealError = err instanceof Error;
          const message = isRealError ? err.message : "Unknown error creating booking";
          const isConflict = isRealError && (message.includes("409") || message.includes("conflict") || message.includes("already booked"));
          const isNetwork = isRealError && (message.includes("fetch failed") || message.includes("timeout") || message.includes("ECONNREFUSED"));
          const isMissingField = isRealError && (message.includes("required") || message.includes("400") || message.includes("validation") || message.includes("missing"));
          return {
            error: message,
            retryable: isConflict || isNetwork || isMissingField,
            suggestion: isConflict
              ? "The slot was just taken. Offer to check for other available times."
              : isMissingField
                ? "A required booking field is missing or invalid. Check the event type's bookingFields for required fields, collect the missing values from the user, and retry the booking with all required fields filled in bookingFieldsResponses."
                : isNetwork
                  ? "Cal.com is not responding. Ask the user to try again in a moment."
                  : undefined,
          };
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
        "List the user's bookings with pagination. Can filter by status, attendee name/email, and date range. Supports sorting by start time. Returns hosts and attendees for each booking. Use skip/take for pagination. Note: attendeeEmail/attendeeName filters only match attendees, not hosts.",
      inputSchema: z.object({
        status: z
          .enum(["upcoming", "past", "cancelled", "recurring", "unconfirmed"])
          .nullable()
          .optional()
          .default("upcoming")
          .describe("Booking status filter. Default: upcoming."),
        attendeeEmail: z
          .string()
          .nullable()
          .optional()
          .describe("Filter by attendee email address."),
        attendeeName: z
          .string()
          .nullable()
          .optional()
          .describe("Filter by attendee name (partial match)."),
        afterStart: z
          .string()
          .nullable()
          .optional()
          .describe("Only bookings starting after this ISO 8601 date."),
        beforeEnd: z
          .string()
          .nullable()
          .optional()
          .describe("Only bookings ending before this ISO 8601 date."),
        sortStart: z
          .enum(["asc", "desc"])
          .nullable()
          .optional()
          .describe("Sort by start time. Use 'desc' for most recent first."),
        take: z
          .number()
          .nullable()
          .optional()
          .default(5)
          .describe("Max bookings to return. Default: 5."),
        skip: z
          .number()
          .nullable()
          .optional()
          .default(0)
          .describe("Number of bookings to skip for pagination. Default: 0."),
      }),
      execute: async ({ status, attendeeEmail, attendeeName, afterStart, beforeEnd, sortStart, take, skip }) => {
        const [token, linked] = await Promise.all([
          getAccessTokenOrNull(teamId, userId),
          getLinkedUser(teamId, userId),
        ]);
        if (!token) return { error: "Account not connected." };
        try {
          const currentUser = linked
            ? { id: linked.calcomUserId, email: linked.calcomEmail }
            : undefined;
          const requestedTake = take ?? 5;
          const bookings = await getBookings(
            token,
            {
              status: status ?? "upcoming",
              take: requestedTake + 1,
              skip: skip ?? 0,
              ...(attendeeEmail ? { attendeeEmail } : {}),
              ...(attendeeName ? { attendeeName } : {}),
              ...(afterStart ? { afterStart } : {}),
              ...(beforeEnd ? { beforeEnd } : {}),
              ...(sortStart ? { sortStart } : {}),
            },
            currentUser
          );
          const hasMore = bookings.length > requestedTake;
          const trimmed = hasMore ? bookings.slice(0, requestedTake) : bookings;
          return {
            bookings: trimmed.map((b) => ({
              uid: b.uid,
              title: b.title,
              status: b.status,
              start: b.start,
              end: b.end,
              hosts: b.hosts?.map((h) => ({ name: h.name, email: h.email })) ?? [],
              attendees: b.attendees.map((a) => ({ name: a.name, email: a.email })),
              meetingUrl: b.meetingUrl,
              location: b.location,
              eventType: b.eventType
                ? { id: b.eventType.id, title: b.eventType.title, slug: b.eventType.slug }
                : null,
              description: b.description,
              recurringBookingUid: b.recurringBookingUid ?? null,
            })),
            hasMore,
            manageUrl: `${CALCOM_APP_URL}/bookings`,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to fetch bookings" };
        }
      },
    }),

    get_booking: tool({
      description: "Get full details of a booking by UID, including status, start/end times, hosts, attendees, event type, meeting URL, and location. Use before cancel/reschedule to show the user what they're changing.",
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
            hosts: b.hosts?.map((h) => ({ name: h.name, email: h.email })) ?? [],
            attendees: b.attendees.map((a) => ({ name: a.name, email: a.email })),
            meetingUrl: b.meetingUrl,
            location: b.location,
            eventType: b.eventType
              ? { id: b.eventType.id, title: b.eventType.title, slug: b.eventType.slug }
              : null,
            description: b.description,
            recurringBookingUid: b.recurringBookingUid ?? null,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to fetch booking" };
        }
      },
    }),

    cancel_booking: tool({
      description: "Cancel a booking by its UID. Optionally provide a reason. For recurring bookings, set cancelSubsequentBookings to true to cancel this and all future occurrences.",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID to cancel"),
        reason: z.string().nullable().optional().describe("Cancellation reason"),
        cancelSubsequentBookings: z
          .boolean()
          .nullable()
          .optional()
          .describe("For recurring bookings only. If true, cancels this booking AND all future occurrences."),
      }),
      execute: async ({ bookingUid, reason, cancelSubsequentBookings }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const booking = await getBooking(token, bookingUid);
          await cancelBooking(token, bookingUid, reason ?? undefined, cancelSubsequentBookings ?? undefined);
          return {
            success: true,
            bookingUid,
            title: booking.title,
            start: booking.start,
            end: booking.end,
            attendees: booking.attendees.map((a) => ({ name: a.name, email: a.email })),
            cancelledSubsequent: cancelSubsequentBookings ?? false,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to cancel booking" };
        }
      },
    }),

    reschedule_booking: tool({
      description: "Reschedule a booking to a new time. Returns both old and new times for confirmation. Pass rescheduledBy with the host's email for auto-confirmation on confirmation-required event types.",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID to reschedule"),
        newStartTime: z.string().describe("New start time in ISO 8601 format"),
        reason: z.string().nullable().optional().describe("Reason for rescheduling"),
        rescheduledBy: z
          .string()
          .nullable()
          .optional()
          .describe("Email of the person rescheduling. Pass the event-type owner's email for auto-confirmation."),
      }),
      execute: async ({ bookingUid, newStartTime, reason, rescheduledBy }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const original = await getBooking(token, bookingUid);
          const rescheduled = await rescheduleBooking(
            token,
            bookingUid,
            newStartTime,
            reason ?? undefined,
            rescheduledBy ?? undefined
          );
          return {
            success: true,
            bookingUid: rescheduled.uid,
            title: rescheduled.title,
            previousStart: original.start,
            previousEnd: original.end,
            newStart: rescheduled.start,
            newEnd: rescheduled.end,
            attendees: rescheduled.attendees.map((a) => ({ name: a.name, email: a.email })),
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to reschedule booking" };
        }
      },
    }),

    confirm_booking: tool({
      description: "Confirm a pending booking. Only works on bookings with status 'pending' (from event types that require manual confirmation). The attendee will be notified once confirmed.",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID to confirm"),
      }),
      execute: async ({ bookingUid }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const details = await getBooking(token, bookingUid);
          const booking = await confirmBooking(token, bookingUid);
          return {
            success: true,
            bookingUid: booking.uid,
            title: booking.title,
            status: booking.status,
            start: details.start,
            end: details.end,
            attendees: details.attendees.map((a) => ({ name: a.name, email: a.email })),
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to confirm booking" };
        }
      },
    }),

    decline_booking: tool({
      description: "Decline a pending booking with an optional reason. Only works on bookings with status 'pending'. The attendee will be notified of the decline and reason.",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID to decline"),
        reason: z.string().nullable().optional().describe("Reason for declining"),
      }),
      execute: async ({ bookingUid, reason }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const details = await getBooking(token, bookingUid);
          const booking = await declineBooking(token, bookingUid, reason ?? undefined);
          return {
            success: true,
            bookingUid: booking.uid,
            title: booking.title,
            status: booking.status,
            start: details.start,
            end: details.end,
            attendees: details.attendees.map((a) => ({ name: a.name, email: a.email })),
            reason: reason ?? null,
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
      description:
        "Mark a booking participant as a no-show. Can mark the host as absent, specific attendees as absent, or both. Use after a past booking where someone didn't show up.",
      inputSchema: z.object({
        bookingUid: z.string().describe("The booking UID"),
        host: z
          .boolean()
          .nullable()
          .optional()
          .describe("Set to true if the host was absent"),
        attendeeEmails: z
          .array(z.string())
          .nullable()
          .optional()
          .describe("Email addresses of attendees who were absent"),
      }),
      execute: async ({ bookingUid, host, attendeeEmails }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const attendees = attendeeEmails?.map((email) => ({ email, absent: true }));
          await markNoShow(token, bookingUid, host ?? undefined, attendees);
          return { success: true, bookingUid };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to mark no-show" };
        }
      },
    }),

    update_profile: tool({
      description:
        "Update the user's Cal.com profile. Always confirm with the user before calling. For timezone, use IANA timezone strings (e.g. 'America/New_York', not 'EST'). Email changes require verification.",
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

          // Sync changed fields back to Redis so the cached LinkedUser stays fresh.
          // This ensures the system prompt's "Your Account" section and all timezone
          // conversions use the updated values.
          const linked = await getLinkedUser(teamId, userId);
          if (linked) {
            let dirty = false;
            if (me.email && me.email !== linked.calcomEmail) {
              linked.calcomEmail = me.email;
              dirty = true;
            }
            if (me.timeZone && me.timeZone !== linked.calcomTimeZone) {
              linked.calcomTimeZone = me.timeZone;
              dirty = true;
            }
            if (dirty) {
              await linkUser(teamId, userId, linked);
            }
          }

          return { success: true, name: me.name, email: me.email, timeZone: me.timeZone };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to update profile" };
        }
      },
    }),

    check_busy_times: tool({
      description: "Check the user's busy times from connected calendars. Requires calendar credential info -- prefer using list_bookings with afterStart/beforeEnd filters for availability checks.",
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
      description: "List all availability schedules with their working hours, timezones, and date overrides. Schedules define when the user is bookable (e.g. Mon-Fri 9-5). Each event type can be assigned a specific schedule.",
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
              availability: s.availability,
              overrides: s.overrides,
            })),
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to list schedules" };
        }
      },
    }),

    get_schedule: tool({
      description:
        "Get a schedule's full details including working hours (availability windows) and date-specific overrides. Use scheduleId 'default' for the default schedule.",
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
      description: "Create a new availability schedule with working hours. If availability is not provided, defaults to Monday-Friday 09:00-17:00. After creation, assign it to an event type via update_event_type if needed.",
      inputSchema: z.object({
        name: z.string().describe("Schedule name (e.g. 'Work Hours')"),
        timeZone: z.string().describe("IANA timezone (e.g. 'America/New_York')"),
        isDefault: z.boolean().describe("Whether this should be the default schedule"),
        availability: z
          .array(
            z.object({
              days: z
                .array(z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]))
                .describe("Days this window applies to"),
              startTime: z.string().describe("Start time in HH:MM format (e.g. '09:00')"),
              endTime: z.string().describe("End time in HH:MM format (e.g. '17:00')"),
            })
          )
          .nullable()
          .optional()
          .describe("Availability windows. Each entry defines days + time range. Defaults to Mon-Fri 09:00-17:00 if omitted."),
        overrides: z
          .array(
            z.object({
              date: z.string().describe("Date in YYYY-MM-DD format"),
              startTime: z.string().describe("Start time in HH:MM format"),
              endTime: z.string().describe("End time in HH:MM format"),
            })
          )
          .nullable()
          .optional()
          .describe("Date-specific overrides. Use to set different hours for a specific date."),
      }),
      execute: async ({ name, timeZone, isDefault, availability, overrides }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const schedule = await createSchedule(token, {
            name,
            timeZone,
            isDefault,
            ...(availability ? { availability } : {}),
            ...(overrides ? { overrides } : {}),
          });
          return {
            success: true,
            id: schedule.id,
            name: schedule.name,
            timeZone: schedule.timeZone,
            availability: schedule.availability,
            overrides: schedule.overrides,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to create schedule" };
        }
      },
    }),

    update_schedule: tool({
      description: "Update a schedule's name, timezone, working hours, or date overrides. The availability array REPLACES all existing windows -- always include the complete set of desired hours, not just changes.",
      inputSchema: z.object({
        scheduleId: z.number().describe("The schedule ID to update"),
        name: z.string().nullable().optional().describe("New schedule name"),
        timeZone: z.string().nullable().optional().describe("New IANA timezone"),
        isDefault: z.boolean().nullable().optional().describe("Set as default schedule"),
        availability: z
          .array(
            z.object({
              days: z
                .array(z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]))
                .describe("Days this window applies to"),
              startTime: z.string().describe("Start time in HH:MM format (e.g. '09:00')"),
              endTime: z.string().describe("End time in HH:MM format (e.g. '17:00')"),
            })
          )
          .nullable()
          .optional()
          .describe("Availability windows. REPLACES all existing windows. Include ALL desired windows."),
        overrides: z
          .array(
            z.object({
              date: z.string().describe("Date in YYYY-MM-DD format"),
              startTime: z.string().describe("Start time in HH:MM format"),
              endTime: z.string().describe("End time in HH:MM format"),
            })
          )
          .nullable()
          .optional()
          .describe("Date-specific overrides. REPLACES all existing overrides. Include ALL desired overrides."),
      }),
      execute: async ({ scheduleId, name, timeZone, isDefault, availability, overrides }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        const patch = Object.fromEntries(
          Object.entries({ name, timeZone, isDefault, availability, overrides }).filter(([, v]) => v != null)
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
            availability: schedule.availability,
            overrides: schedule.overrides,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to update schedule" };
        }
      },
    }),

    delete_schedule: tool({
      description: "Delete an availability schedule. This is irreversible. Event types using this schedule will fall back to the user's default schedule. Always confirm with the user before deleting.",
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
      description: "Create a new event type (meeting type) on Cal.com. Requires title, slug, and duration. Optionally set buffers, minimum notice, and slot intervals.",
      inputSchema: z.object({
        title: z.string().describe("Event type title (e.g. '30 Minute Meeting')"),
        slug: z.string().describe("URL slug (e.g. '30min')"),
        lengthInMinutes: z.number().describe("Duration in minutes"),
        description: z.string().nullable().optional().describe("Optional description"),
        hidden: z.boolean().nullable().optional().describe("Whether to hide from booking page"),
        minimumBookingNotice: z
          .number()
          .nullable()
          .optional()
          .describe("Minimum minutes of notice required before booking"),
        beforeEventBuffer: z
          .number()
          .nullable()
          .optional()
          .describe("Buffer minutes blocked before each meeting"),
        afterEventBuffer: z
          .number()
          .nullable()
          .optional()
          .describe("Buffer minutes blocked after each meeting"),
        slotInterval: z
          .number()
          .nullable()
          .optional()
          .describe("Slot interval in minutes. Defaults to event duration."),
        scheduleId: z
          .number()
          .nullable()
          .optional()
          .describe("Availability schedule ID to use for this event type"),
      }),
      execute: async ({ title, slug, lengthInMinutes, description, hidden, minimumBookingNotice, beforeEventBuffer, afterEventBuffer, slotInterval, scheduleId }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        try {
          const et = await createEventType(token, {
            title,
            slug,
            lengthInMinutes,
            ...(description != null ? { description } : {}),
            ...(hidden != null ? { hidden } : {}),
            ...(minimumBookingNotice != null ? { minimumBookingNotice } : {}),
            ...(beforeEventBuffer != null ? { beforeEventBuffer } : {}),
            ...(afterEventBuffer != null ? { afterEventBuffer } : {}),
            ...(slotInterval != null ? { slotInterval } : {}),
            ...(scheduleId != null ? { scheduleId } : {}),
          });
          return { success: true, id: et.id, title: et.title, slug: et.slug, length: et.length, bookingUrl: et.bookingUrl ?? null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to create event type" };
        }
      },
    }),

    update_event_type: tool({
      description: "Update an existing event type. Can change title, slug, duration, description, visibility, buffers, minimum booking notice, slot intervals, and schedule assignment.",
      inputSchema: z.object({
        eventTypeId: z.number().describe("The event type ID to update"),
        title: z.string().nullable().optional().describe("New title"),
        slug: z.string().nullable().optional().describe("New URL slug"),
        lengthInMinutes: z.number().nullable().optional().describe("New duration in minutes"),
        description: z.string().nullable().optional().describe("New description"),
        hidden: z.boolean().nullable().optional().describe("Whether to hide from booking page"),
        minimumBookingNotice: z
          .number()
          .nullable()
          .optional()
          .describe("Minimum minutes of notice required before booking (e.g. 120 for 2 hours)"),
        beforeEventBuffer: z
          .number()
          .nullable()
          .optional()
          .describe("Buffer minutes blocked before each meeting starts"),
        afterEventBuffer: z
          .number()
          .nullable()
          .optional()
          .describe("Buffer minutes blocked after each meeting ends"),
        slotInterval: z
          .number()
          .nullable()
          .optional()
          .describe("Slot interval in minutes (e.g. 15 means slots at 9:00, 9:15, 9:30). Defaults to event duration."),
        scheduleId: z
          .number()
          .nullable()
          .optional()
          .describe("Assign a specific availability schedule to this event type (by schedule ID)"),
      }),
      execute: async ({ eventTypeId, ...rest }) => {
        const token = await getAccessTokenOrNull(teamId, userId);
        if (!token) return { error: "Account not connected." };
        const patch = Object.fromEntries(
          Object.entries(rest).filter(([, v]) => v != null)
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
      description: "Delete an event type by ID. This is irreversible -- always confirm with the user first.",
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
    msg.includes("tool choice is none") ||
    causeMsg.includes("failed to call a function") ||
    causeMsg.includes("failed_generation") ||
    causeMsg.includes("tool call validation failed") ||
    causeMsg.includes("tool choice is none")
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
}: AgentStreamOptions) {
  const tools = createCalTools(teamId, userId, platform, lookupPlatformUser);

  // Keep only the last 10 messages from history to prevent stale context
  // (e.g. an old booking request) from hijacking unrelated follow-up messages.
  const recentHistory = (conversationHistory ?? []).slice(-MAX_HISTORY_MESSAGES);

  const messages: ModelMessage[] = [
    ...recentHistory,
    { role: "user" as const, content: userMessage },
  ];

  // With pre-resolution, user context injection, and tool result persistence,
  // the agent should need at most 3-4 steps per request. Keep a hard cap as safety net.

  // ─── Loop guard ───────────────────────────────────────────────────────────
  // Track tool calls across steps. If the same tool is called 2+ times with
  // identical arguments, force a text response to break the loop.
  const toolCallTracker = new Map<string, number>();

  const fallbackModels = getFallbackModels();
  const result = streamText({
    model: getModel(),
    system: getSystemPrompt(platform, userContext),
    messages,
    tools,
    toolChoice: "auto",
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    ...(fallbackModels && {
      providerOptions: {
        gateway: { models: fallbackModels },
      },
    }),
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
        return { toolChoice: "none" as const, activeTools: [] };
      }
      // On the final allowed step, force a text response so the model
      // cannot keep calling tools indefinitely.
      if (stepNumber === MAX_AGENT_STEPS - 1) {
        return { toolChoice: "none" as const, activeTools: [] };
      }
      return {};
    },
    onError({ error }) {
      logger?.error("Stream error", error);
      if (onErrorRef) {
        if (error instanceof Error) {
          onErrorRef.current = error;
        } else if (typeof error === "object" && error !== null && "message" in error) {
          const msg = (error as { message: string }).message;
          onErrorRef.current = new Error(msg);
        } else {
          onErrorRef.current = new Error(String(error));
        }
      }
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
