import { Actions, Button, Card, ChannelImpl, Chat, Divider, Field, Fields, LinkButton } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createRedisState } from "@chat-adapter/state-redis";
import type { SlashCommandEvent } from "chat";
import type { ModelMessage } from "ai";
import {
  clearBookingFlow,
  getBookingFlow,
  getLinkedUser,
  getValidAccessToken,
  setBookingFlow,
  unlinkUser,
} from "./user-linking";
import {
  createBooking,
  getAvailableSlots,
  getBookings,
  getEventTypes,
} from "./calcom/client";
import {
  availabilityCard,
  bookingConfirmationCard,
  helpCard,
  linkAccountCard,
  upcomingBookingsCard,
} from "./notifications";
import { formatBookingTime } from "./calcom/webhooks";
import { runAgentStream } from "./agent";
import type { LookupSlackUserFn } from "./agent";
import { generateAuthUrl } from "./calcom/oauth";

const CALCOM_APP_URL = process.env.CALCOM_APP_URL ?? "https://app.cal.com";

// ─── Slack user lookup via users.info API ────────────────────────────────────

function makeLookupSlackUser(teamId: string): LookupSlackUserFn {
  return async (slackUserId: string) => {
    try {
      const installation = await slackAdapter.getInstallation(teamId);
      if (!installation?.botToken) return null;

      const res = await fetch(
        `https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`,
        { headers: { Authorization: `Bearer ${installation.botToken}` } }
      );
      if (!res.ok) return null;

      const data = (await res.json()) as {
        ok: boolean;
        user?: {
          id: string;
          name: string;
          real_name?: string;
          profile?: { display_name?: string; real_name?: string; email?: string };
        };
      };
      if (!data.ok || !data.user) return null;

      return {
        id: data.user.id,
        name: data.user.name,
        realName:
          data.user.profile?.real_name ??
          data.user.real_name ??
          data.user.name,
        email: data.user.profile?.email,
      };
    } catch {
      return null;
    }
  };
}

const globalForBot = globalThis as unknown as {
  _slackAdapter?: ReturnType<typeof createSlackAdapter>;
  _chatBot?: Chat;
};

if (!globalForBot._slackAdapter) {
  globalForBot._slackAdapter = createSlackAdapter({
    clientId: process.env.SLACK_CLIENT_ID!,
    clientSecret: process.env.SLACK_CLIENT_SECRET!,
    encryptionKey: process.env.SLACK_ENCRYPTION_KEY,
  });
}

if (!globalForBot._chatBot) {
  globalForBot._chatBot = new Chat({
    userName: "calcom",
    adapters: { slack: globalForBot._slackAdapter },
    state: createRedisState({ url: process.env.REDIS_URL! }),
  });
}

export const slackAdapter = globalForBot._slackAdapter;
export const bot = globalForBot._chatBot;

// Clear handlers from previous hot reloads before re-registering
const b = bot as unknown as Record<string, unknown[]>;
for (const key of Object.keys(b)) {
  if (key.endsWith("Handlers") && Array.isArray(b[key])) {
    b[key].length = 0;
  }
}

// ─── Helper to extract Slack context from raw payloads ──────────────────────

function extractTeamId(raw: unknown): string {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (typeof r.team === "string") return r.team;
    if (r.team && typeof r.team === "object") {
      const t = r.team as Record<string, unknown>;
      if (typeof t.id === "string") return t.id;
    }
    if (typeof r.team_id === "string") return r.team_id;
  }
  return "";
}

// ─── Build conversation history from thread messages ────────────────────────

async function buildHistory(thread: {
  adapter: {
    fetchMessages: (
      id: string,
      opts: { limit: number }
    ) => Promise<{
      messages: Array<{
        text: string;
        author: { isMe: boolean | string; isBot: boolean | string };
      }>;
    }>;
  };
  id: string;
}): Promise<ModelMessage[]> {
  try {
    const result = await thread.adapter.fetchMessages(thread.id, { limit: 30 });
    return result.messages
      .filter((msg) => msg.text.trim())
      .map((msg) => ({
        role: (msg.author.isMe ? "assistant" : "user") as "assistant" | "user",
        content: msg.text,
      }));
  } catch {
    return [];
  }
}

// ─── Helper: post OAuth link prompt ─────────────────────────────────────────

function oauthLinkMessage(teamId: string, slackUserId: string) {
  const authUrl = generateAuthUrl(teamId, slackUserId);
  return Card({
    title: "Connect Your Cal.com Account",
    children: [
      Actions([
        LinkButton({
          url: authUrl,
          label: "Continue with Cal.com",
        }),
      ]),
    ],
  });
}

// ─── Agentic mention handler ────────────────────────────────────────────────

bot.onNewMention(async (thread, message) => {
  const teamId = extractTeamId(message.raw);
  const userId = message.author.userId;

  console.log("[Cal Bot] New mention:", { teamId, userId, text: message.text });

  const linked = await getLinkedUser(teamId, userId);
  if (!linked) {
    await thread.post(oauthLinkMessage(teamId, userId));
    return;
  }

  await thread.subscribe();

  const result = runAgentStream({
    teamId,
    userId,
    userMessage: message.text,
    lookupSlackUser: makeLookupSlackUser(teamId),
  });

  await thread.post(result.textStream);
});

// ─── Agentic thread follow-up ───────────────────────────────────────────────

bot.onSubscribedMessage(async (thread, message) => {
  if (message.author.isBot || message.author.isMe) return;

  const teamId = extractTeamId(message.raw);
  const userId = message.author.userId;

  console.log("[Cal Bot] Thread follow-up:", { teamId, userId, text: message.text });

  const history = await buildHistory(thread);

  const result = runAgentStream({
    teamId,
    userId,
    userMessage: message.text,
    conversationHistory: history.slice(0, -1),
    lookupSlackUser: makeLookupSlackUser(teamId),
  });

  await thread.post(result.textStream);
});

// ─── App Home ────────────────────────────────────────────────────────────────

bot.onAppHomeOpened(async (event) => {
  const { SlackAdapter } = await import("@chat-adapter/slack");
  const slack = bot.getAdapter("slack") as InstanceType<typeof SlackAdapter>;

  const raw = event as unknown as Record<string, unknown>;
  const teamId = typeof raw.teamId === "string" ? raw.teamId : "";
  const userId = event.userId;
  const linked = await getLinkedUser(teamId, userId);

  if (!linked) {
    const authUrl = generateAuthUrl(teamId, userId);
    await slack.publishHomeView(userId, {
      type: "home",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Welcome to Cal.com!* :calendar:\n\nConnect your Cal.com account to get started.",
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Continue with Cal.com" },
              url: authUrl,
              style: "primary",
            },
          ],
        },
      ],
    });
    return;
  }

  try {
    const accessToken = await getValidAccessToken(teamId, userId);
    if (!accessToken) {
      const authUrl = generateAuthUrl(teamId, userId);
      await slack.publishHomeView(userId, {
        type: "home",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Your Cal.com session has expired. Please reconnect your account.",
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Reconnect Cal.com" },
                url: authUrl,
                style: "primary",
              },
            ],
          },
        ],
      });
      return;
    }

    const bookings = await getBookings(accessToken, {
      status: "upcoming",
      take: 5,
    });

    const bookingBlocks = bookings.flatMap((b) => [
      {
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,
          text: `*${b.title}*\n${formatBookingTime(b.start, b.end, linked.calcomTimeZone)}\nWith: ${b.attendees.map((a) => a.name).join(", ")}`,
        },
        ...(b.meetingUrl
          ? {
              accessory: {
                type: "button" as const,
                text: { type: "plain_text" as const, text: "Join" },
                url: b.meetingUrl,
              },
            }
          : {}),
      },
      { type: "divider" as const },
    ]);

    await slack.publishHomeView(userId, {
      type: "home",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Welcome back, ${linked.calcomUsername}!* :calendar:`,
          },
        },
        { type: "divider" },
        {
          type: "header",
          text: { type: "plain_text", text: "Upcoming Bookings" },
        },
        ...(bookingBlocks.length > 0
          ? bookingBlocks
          : [
              {
                type: "section",
                text: { type: "mrkdwn", text: "No upcoming bookings." },
              },
            ]),
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: ':bulb: _Tip: @mention me in any channel to chat naturally — "show my bookings", "book a meeting with @someone", "what\'s my availability?"_',
            },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View All Bookings" },
              url: `${CALCOM_APP_URL}/bookings`,
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Open Cal.com" },
              url: CALCOM_APP_URL,
            },
          ],
        },
      ],
    });
  } catch {
    const authUrl = generateAuthUrl(teamId, userId);
    await slack.publishHomeView(userId, {
      type: "home",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Could not load your bookings. Your session may have expired — please reconnect.",
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Reconnect Cal.com" },
              url: authUrl,
              style: "primary",
            },
          ],
        },
      ],
    });
  }
});

// ─── Helper: post to channel with DM fallback ──────────────────────────────

async function safeChannelPost(
  event: SlashCommandEvent,
  message: Parameters<SlashCommandEvent["channel"]["post"]>[0]
) {
  try {
    await event.channel.post(message);
  } catch (err) {
    const isChannelError =
      err instanceof Error &&
      (err.message.includes("channel_not_found") || err.message.includes("not_in_channel"));
    if (!isChannelError) throw err;

    const { SlackAdapter } = await import("@chat-adapter/slack");
    const slack = bot.getAdapter("slack") as InstanceType<typeof SlackAdapter>;
    const dmThreadId = await slack.openDM(event.user.userId);
    const dmChannel = new ChannelImpl({
      id: dmThreadId,
      adapter: slack,
      stateAdapter: undefined as never,
    });
    await dmChannel.post(message);
  }
}

// ─── Slash commands ──────────────────────────────────────────────────────────

bot.onSlashCommand("/cal", async (event) => {
  const args = event.text.trim().split(/\s+/);
  const subcommand = args[0]?.toLowerCase() ?? "help";
  const teamId = extractTeamId(event.raw);
  const userId = event.user.userId;

  switch (subcommand) {
    case "link":
      await handleLink(event, teamId, userId);
      break;
    case "unlink":
      await handleUnlink(event, teamId, userId);
      break;
    case "help":
      await safeChannelPost(event, helpCard());
      break;
    default: {
      const naturalQuery = event.text.trim();
      if (!naturalQuery) {
        await safeChannelPost(event, helpCard());
        return;
      }

      const result = runAgentStream({
        teamId,
        userId,
        userMessage: naturalQuery,
        lookupSlackUser: makeLookupSlackUser(teamId),
      });

      await safeChannelPost(event, result.textStream);
    }
  }
});

// ─── /cal link ───────────────────────────────────────────────────────────────

async function handleLink(event: SlashCommandEvent, teamId: string, userId: string) {
  const existing = await getLinkedUser(teamId, userId);
  if (existing) {
    await event.channel.postEphemeral(
      event.user,
      `Your Cal.com account (*${existing.calcomUsername}* · ${existing.calcomEmail}) is already connected. Use \`/cal unlink\` first to disconnect.`,
      { fallbackToDM: true }
    );
    return;
  }

  await event.channel.postEphemeral(event.user, oauthLinkMessage(teamId, userId), {
    fallbackToDM: true,
  });
}

// ─── /cal unlink ─────────────────────────────────────────────────────────────

async function handleUnlink(event: SlashCommandEvent, teamId: string, userId: string) {
  const linked = await getLinkedUser(teamId, userId);
  if (!linked) {
    await event.channel.postEphemeral(event.user, "Your Cal.com account is not connected.", {
      fallbackToDM: true,
    });
    return;
  }
  await unlinkUser(teamId, userId);
  await event.channel.postEphemeral(
    event.user,
    `Your Cal.com account (*${linked.calcomUsername}*) has been disconnected.`,
    { fallbackToDM: true }
  );
}

// ─── Modal submit: book_event_type ──────────────────────────────────────────

bot.onModalSubmit("book_event_type", async (event): Promise<undefined> => {
  const meta = event.privateMetadata
    ? (JSON.parse(event.privateMetadata) as { teamId: string; targetSlackId: string })
    : null;
  if (!meta) return;

  const { teamId, targetSlackId } = meta;
  const userId = event.user.userId;
  const eventTypeId = Number(event.values.event_type);

  const accessToken = await getValidAccessToken(teamId, userId);
  if (!accessToken) {
    if (event.relatedChannel) {
      await event.relatedChannel.postEphemeral(
        event.user,
        oauthLinkMessage(teamId, userId),
        { fallbackToDM: true }
      );
    }
    return;
  }

  const linked = await getLinkedUser(teamId, userId);
  if (!linked) return;

  const lookupTarget = makeLookupSlackUser(teamId);
  const targetProfile = await lookupTarget(targetSlackId);
  const targetName = targetProfile?.realName ?? targetProfile?.name ?? "Attendee";
  const targetEmail = targetProfile?.email;

  if (!targetEmail) {
    if (event.relatedChannel) {
      await event.relatedChannel.postEphemeral(
        event.user,
        "Could not find that user's email on Slack. Please book via @mention and provide their email.",
        { fallbackToDM: true }
      );
    }
    return;
  }

  try {
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const slotsMap = await getAvailableSlots(accessToken, {
      eventTypeId,
      start: now.toISOString(),
      end: weekLater.toISOString(),
      timeZone: linked.calcomTimeZone,
    });

    const allSlots = Object.values(slotsMap)
      .flat()
      .filter((s) => s.available)
      .slice(0, 5)
      .map((s) => ({
        time: s.time,
        label: new Intl.DateTimeFormat("en-US", {
          timeZone: linked.calcomTimeZone,
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(new Date(s.time)),
      }));

    const eventTypeTitle =
      (await getEventTypes(accessToken).catch(() => [])).find(
        (et) => et.id === eventTypeId
      )?.title ?? `Meeting`;

    await setBookingFlow(teamId, userId, {
      eventTypeId,
      eventTypeTitle,
      targetUserSlackId: targetSlackId,
      targetName,
      targetEmail,
      step: "awaiting_slot",
      slots: allSlots,
    });

    if (event.relatedChannel) {
      await event.relatedChannel.post(availabilityCard(allSlots, eventTypeTitle, targetName));
    }
  } catch {
    if (event.relatedChannel) {
      await event.relatedChannel.postEphemeral(
        event.user,
        "Failed to fetch available slots. Please try again.",
        { fallbackToDM: true }
      );
    }
  }
});

// ─── Action: select a slot ──────────────────────────────────────────────────

bot.onAction("select_slot", async (event) => {
  const teamId = extractTeamId(event.raw);
  const userId = event.user.userId;
  const selectedTime = event.value ?? "";

  const [accessToken, flow] = await Promise.all([
    getValidAccessToken(teamId, userId),
    getBookingFlow(teamId, userId),
  ]);

  if (!accessToken || !flow) {
    await event.thread.post("Booking session expired. Please start again by @mentioning me.");
    return;
  }

  const slotLabel = flow.slots?.find((s) => s.time === selectedTime)?.label ?? selectedTime;

  await setBookingFlow(teamId, userId, {
    ...flow,
    step: "awaiting_confirmation",
    selectedSlot: selectedTime,
  });

  await event.thread.post(
    bookingConfirmationCard(flow.eventTypeTitle, slotLabel, flow.targetName ?? "them")
  );
});

// ─── Action: confirm booking ─────────────────────────────────────────────────

bot.onAction("confirm_booking", async (event) => {
  const teamId = extractTeamId(event.raw);
  const userId = event.user.userId;

  const [accessToken, flow, linked] = await Promise.all([
    getValidAccessToken(teamId, userId),
    getBookingFlow(teamId, userId),
    getLinkedUser(teamId, userId),
  ]);

  if (!accessToken || !flow || !flow.selectedSlot || !flow.targetEmail || !linked) {
    await event.thread.post("Booking session expired. Please start again by @mentioning me.");
    return;
  }

  const sent = await event.thread.post("Creating your booking...");

  try {
    const booking = await createBooking(accessToken, {
      eventTypeId: flow.eventTypeId,
      start: flow.selectedSlot,
      attendee: {
        name: flow.targetName ?? "Attendee",
        email: flow.targetEmail,
        timeZone: linked.calcomTimeZone,
      },
    });

    await clearBookingFlow(teamId, userId);

    const time = formatBookingTime(booking.start, booking.end, linked.calcomTimeZone);

    await sent.edit(
      Card({
        title: "Booking Confirmed!",
        subtitle: booking.title,
        children: [
          Fields([
            Field({ label: "When", value: time }),
            Field({
              label: "With",
              value: booking.attendees.map((a) => a.name).join(", "),
            }),
          ]),
          Divider(),
          Actions([
            ...(booking.meetingUrl
              ? [LinkButton({ url: booking.meetingUrl, label: "Join Meeting" })]
              : []),
            LinkButton({
              url: `${CALCOM_APP_URL}/bookings`,
              label: "View Bookings",
            }),
          ]),
        ],
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await sent.edit(`Failed to create booking: ${msg}`);
  }
});

// ─── Action: cancel booking flow ────────────────────────────────────────────

bot.onAction("cancel_booking", async (event) => {
  const teamId = extractTeamId(event.raw);
  await clearBookingFlow(teamId, event.user.userId);
  await event.thread.post("Booking cancelled.");
});
