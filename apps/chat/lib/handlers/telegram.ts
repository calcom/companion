import type { Chat, Message, Thread } from "chat";
import { Actions, Card, LinkButton } from "chat";
import { getAvailableSlots, getBookings, getEventTypes } from "../calcom/client";
import { generateAuthUrl } from "../calcom/oauth";
import { getLogger } from "../logger";
import { availabilityListCard, telegramHelpCard, upcomingBookingsCard } from "../notifications";
import { getLinkedUser, getValidAccessToken, unlinkUser } from "../user-linking";

const logger = getLogger("telegram-handlers");

const TELEGRAM_COMMAND_RE = /^\/(cal\s+)?(start|help|link|unlink|bookings|availability)/i;

export interface RegisterTelegramHandlersDeps {
  withBotErrorHandling: (
    fn: () => Promise<void>,
    options: {
      postError: (message: string) => Promise<unknown>;
      logContext?: string;
    }
  ) => Promise<void>;
  extractContext: (
    thread: { adapter: { name: string } },
    message: { author: { userId: string }; raw: unknown }
  ) => { platform: string; teamId: string; userId: string };
}

function oauthLinkMessage(platform: string, teamId: string, userId: string) {
  const authUrl = generateAuthUrl(platform, teamId, userId);
  return Card({
    title: "Connect Your Cal.com Account",
    children: [Actions([LinkButton({ url: authUrl, label: "Continue with Cal.com" })])],
  });
}

/**
 * Handle a Telegram slash command (/start, /help, /link, /unlink, /bookings, /availability).
 * Returns true if the message was a recognized command and was handled.
 * Extracted so it can be called from both onNewMessage and onSubscribedMessage.
 */
export async function handleTelegramCommand(
  thread: Thread,
  message: Message,
  deps: RegisterTelegramHandlersDeps
): Promise<boolean> {
  if (thread.adapter.name !== "telegram") return false;

  const text = message.text.trim();
  if (!TELEGRAM_COMMAND_RE.test(text)) return false;

  const { withBotErrorHandling, extractContext } = deps;
  const ctx = extractContext(thread, message);
  const parts = text.split(/\s+/);
  const first = parts[0]?.replace(/@\w+$/, "").toLowerCase();
  const cmd = first === "/cal" ? parts[1]?.toLowerCase() : (first?.replace(/^\//, "") ?? "");

  // In Telegram, thread.id equals `telegram:{userId}` only for DMs.
  // Group threads have a negative chat ID, so they differ.
  const isGroup = thread.id !== `telegram:${ctx.userId}`;

  // Send the signed OAuth URL privately to avoid exposing it in group chats.
  // Any group member could click a publicly posted link and complete the OAuth
  // flow, which would link their Cal.com account to the requester's Telegram ID.
  async function postOAuthLinkPrivately() {
    if (isGroup) {
      await thread.post("Please check your DMs to connect your Cal.com account.");
      await thread.postEphemeral(
        message.author,
        oauthLinkMessage(ctx.platform, ctx.teamId, ctx.userId),
        {
          fallbackToDM: true,
        }
      );
    } else {
      await thread.post(oauthLinkMessage(ctx.platform, ctx.teamId, ctx.userId));
    }
  }

  logger.info("Telegram command received", { command: cmd, chatId: ctx.userId, isGroup });

  await withBotErrorHandling(
    async () => {
      if (cmd === "start" || cmd === "help") {
        await thread.post(telegramHelpCard());
        return;
      }
      if (cmd === "link") {
        const existing = await getLinkedUser(ctx.teamId, ctx.userId);
        if (existing) {
          await thread.post(
            `Your Cal.com account (**${existing.calcomUsername}**) is already connected.`
          );
          return;
        }
        await postOAuthLinkPrivately();
        return;
      }
      if (cmd === "unlink") {
        const linked = await getLinkedUser(ctx.teamId, ctx.userId);
        if (!linked) {
          await thread.post("Your Cal.com account is not connected.");
          return;
        }
        await unlinkUser(ctx.teamId, ctx.userId);
        await thread.post(
          `Your Cal.com account (**${linked.calcomUsername}**) has been disconnected.`
        );
        return;
      }
      if (cmd === "bookings") {
        const accessToken = await getValidAccessToken(ctx.teamId, ctx.userId);
        if (!accessToken) {
          await postOAuthLinkPrivately();
          return;
        }
        const linked = await getLinkedUser(ctx.teamId, ctx.userId);
        if (!linked) {
          await postOAuthLinkPrivately();
          return;
        }
        const bookings = await getBookings(
          accessToken,
          { status: "upcoming", take: 5 },
          { id: linked.calcomUserId, email: linked.calcomEmail }
        );
        const card = upcomingBookingsCard(
          bookings.map((b) => ({
            uid: b.uid,
            title: b.title,
            start: b.start,
            end: b.end,
            attendees: b.attendees,
            meetingUrl: b.meetingUrl ?? null,
          }))
        );
        await thread.post(card);
        return;
      }
      if (cmd === "availability") {
        const accessToken = await getValidAccessToken(ctx.teamId, ctx.userId);
        if (!accessToken) {
          await postOAuthLinkPrivately();
          return;
        }
        const linked = await getLinkedUser(ctx.teamId, ctx.userId);
        if (!linked) {
          await postOAuthLinkPrivately();
          return;
        }
        const eventTypes = await getEventTypes(accessToken).catch(() => []);
        if (eventTypes.length === 0) {
          await thread.post(
            "You have no event types. Create one at https://app.cal.com first."
          );
          return;
        }
        const eventType = eventTypes[0];
        const now = new Date();
        const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const slotsMap = await getAvailableSlots(accessToken, {
          eventTypeId: eventType.id,
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
        const card = availabilityListCard(allSlots, eventType.title);
        await thread.post(card);
        return;
      }
    },
    {
      postError: (msg) => thread.post(msg).catch(() => {}),
      logContext: "telegram command",
    }
  );

  return true;
}

export function registerTelegramHandlers(bot: Chat, deps: RegisterTelegramHandlersDeps): void {
  bot.onNewMessage(
    TELEGRAM_COMMAND_RE,
    async (thread, message) => {
      await handleTelegramCommand(thread, message, deps);
    }
  );
}
