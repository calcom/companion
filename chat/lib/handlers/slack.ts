import {
  Actions,
  Button,
  Card,
  CardText,
  Divider,
  Field,
  Fields,
  LinkButton,
  Modal,
  Select,
  SelectOption,
  TextInput,
} from "chat";
import { cardToBlockKit } from "@chat-adapter/slack";
import type { SlackAdapter } from "@chat-adapter/slack";
import type { SlashCommandEvent, Thread } from "chat";
import type { Chat } from "chat";
import type { ModelMessage } from "ai";
import {
  clearBookingFlow,
  getBookingFlow,
  getLinkedUser,
  getValidAccessToken,
  setBookingFlow,
  unlinkUser,
} from "../user-linking";
import {
  createBooking,
  getAvailableSlots,
  getBookings,
  getEventTypes,
} from "../calcom/client";
import {
  availabilityCard,
  availabilityListCard,
  bookingConfirmationCard,
  helpCard,
  upcomingBookingsCard,
} from "../notifications";
import { formatBookingTime } from "../calcom/webhooks";
import { isAIRateLimitError, isAIToolCallError, runAgentStream } from "../agent";
import type { LookupPlatformUserFn } from "../agent";
import { generateAuthUrl } from "../calcom/oauth";
import { getLogger } from "../logger";

const logger = getLogger("slack-handlers");
const CALCOM_APP_URL = process.env.CALCOM_APP_URL ?? "https://app.cal.com";

const RETRY_STOP_BLOCKS = cardToBlockKit(
  Card({
    children: [Actions([Button({ id: "retry_response", label: "Retry" })])],
  })
);

export interface PlatformContext {
  platform: string;
  teamId: string;
  userId: string;
}

export interface PostAgentStreamFn {
  (
    thread: Thread,
    agentResult: { textStream: AsyncIterable<string>; text: PromiseLike<string> },
    ctx: { platform: string; teamId: string; userId: string },
    options?: { onErrorRef?: { current: Error | null } }
  ): Promise<void>;
}

export interface RegisterSlackHandlersDeps {
  postAgentStream: PostAgentStreamFn;
  withBotErrorHandling: (
    fn: () => Promise<void>,
    options: {
      postError: (message: string) => Promise<unknown>;
      logContext?: string;
      getCustomErrorMessage?: (err: unknown) => string | undefined;
    }
  ) => Promise<void>;
  extractPlatformContextFromEvent: (event: {
    adapter: { name: string };
    raw: unknown;
    user: { userId: string };
  }) => PlatformContext;
  extractTeamIdFromRaw: (raw: unknown, adapterName?: string) => string;
  buildHistory: (thread: Thread) => Promise<ModelMessage[]>;
  makeLookupSlackUser: (teamId: string) => LookupPlatformUserFn;
}

function oauthLinkMessage(platform: string, teamId: string, userId: string) {
  const authUrl = generateAuthUrl(platform, teamId, userId);
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

export function registerSlackHandlers(
  bot: Chat,
  getSlackAdapter: () => SlackAdapter,
  deps: RegisterSlackHandlersDeps
): void {
  const { postAgentStream, withBotErrorHandling, extractPlatformContextFromEvent, extractTeamIdFromRaw, buildHistory, makeLookupSlackUser } = deps;

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

      const dmThread = await bot.openDM(event.user);
      await dmThread.post(message);
    }
  }

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

    await event.channel.postEphemeral(event.user, oauthLinkMessage("slack", teamId, userId), {
      fallbackToDM: true,
    });
  }

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

  // ─── App Home ────────────────────────────────────────────────────────────

  bot.onAppHomeOpened(async (event) => {
    const slack = getSlackAdapter();

    const raw = event as unknown as Record<string, unknown>;
    const teamId = typeof raw.teamId === "string" ? raw.teamId : "";
    const userId = event.userId;
    logger.debug("App Home opened", { teamId, userId });
    const linked = await getLinkedUser(teamId, userId);

    if (!linked) {
      const authUrl = generateAuthUrl("slack", teamId, userId);
      const welcomeCard = Card({
        title: "Welcome to Cal.com! :calendar:",
        children: [
          CardText("Connect your Cal.com account to get started."),
          Actions([
            LinkButton({ url: authUrl, label: "Continue with Cal.com" }),
          ]),
        ],
      });
      await slack.publishHomeView(userId, {
        type: "home",
        blocks: cardToBlockKit(welcomeCard),
      });
      return;
    }

    try {
      const accessToken = await getValidAccessToken(teamId, userId);
      if (!accessToken) {
        const authUrl = generateAuthUrl("slack", teamId, userId);
        const reconnectCard = Card({
          title: "Session Expired",
          children: [
            CardText("Your Cal.com session has expired. Please reconnect your account."),
            Actions([
              LinkButton({ url: authUrl, label: "Reconnect Cal.com" }),
            ]),
          ],
        });
        await slack.publishHomeView(userId, {
          type: "home",
          blocks: cardToBlockKit(reconnectCard),
        });
        return;
      }

      const bookings = await getBookings(
        accessToken,
        { status: "upcoming", take: 5 },
        { id: linked.calcomUserId, email: linked.calcomEmail }
      );

      const homeCard = Card({
        title: `Welcome back, ${linked.calcomUsername}! :calendar:`,
        subtitle: "Upcoming Bookings",
        children: [
          ...(bookings.length > 0
            ? bookings.slice(0, 5).flatMap((b) => [
                Fields([
                  Field({
                    label: b.title,
                    value: `${formatBookingTime(b.start, b.end, linked.calcomTimeZone)}\nWith: ${b.attendees.map((a) => a.name).join(", ")}`,
                  }),
                ]),
                ...(b.meetingUrl
                  ? [Actions([LinkButton({ url: b.meetingUrl, label: "Join" })])]
                  : []),
                Divider(),
              ])
            : [CardText("No upcoming bookings.")]),
          CardText(':bulb: _Tip: @mention me in any channel to chat naturally — "show my bookings", "book a meeting with @someone", "what\'s my availability?"_'),
          Divider(),
          Actions([
            Button({ id: "book_meeting", label: "Book a meeting" }),
            LinkButton({ url: `${CALCOM_APP_URL}/bookings`, label: "View All Bookings" }),
            LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" }),
          ]),
        ],
      });
      await slack.publishHomeView(userId, {
        type: "home",
        blocks: cardToBlockKit(homeCard),
      });
    } catch {
      const authUrl = generateAuthUrl("slack", teamId, userId);
      const errorCard = Card({
        title: "Could Not Load Bookings",
        children: [
          CardText("Your session may have expired — please reconnect."),
          Actions([
            LinkButton({ url: authUrl, label: "Reconnect Cal.com" }),
          ]),
        ],
      });
      await slack.publishHomeView(userId, {
        type: "home",
        blocks: cardToBlockKit(errorCard),
      });
    }
  });

  // ─── Action: book_meeting (App Home) ──────────────────────────────────────

  bot.onAction("book_meeting", async (event) => {
    if (event.adapter.name !== "slack") return;

    const ctx = extractPlatformContextFromEvent(event);
    logger.info("Action book_meeting", { actionId: "book_meeting", teamId: ctx.teamId, userId: ctx.userId });

    const openModal = (event as { openModal?: (modal: unknown) => Promise<unknown> }).openModal;
    if (!openModal) return;

    const raw = event.raw as Record<string, unknown>;
    const teamId = typeof raw.team_id === "string" ? raw.team_id : "";

    const selectUserModal = Modal({
      callbackId: "book_select_user",
      title: "Book a Meeting",
      submitLabel: "Continue",
      notifyOnClose: true,
      privateMetadata: JSON.stringify({ teamId }),
      children: [
        TextInput({
          id: "target_user",
          label: "Who to book with?",
          placeholder: "Enter Slack user ID (e.g. U12345) or paste @mention",
        }),
      ],
    });
    await openModal(selectUserModal);
  });

  // ─── Slack Assistants API ───────────────────────────────────────────────

  bot.onAssistantThreadStarted(async (event) => {
    const slack = getSlackAdapter();

    await slack.setSuggestedPrompts(
      event.channelId,
      event.threadTs,
      [
        { title: "What's on my calendar?", message: "Show me my upcoming bookings" },
        { title: "Book a meeting", message: "Help me schedule a new meeting" },
        { title: "Check availability", message: "What slots are open this week?" },
      ],
      "How can I help?"
    );
  });

  // ─── Slash commands ──────────────────────────────────────────────────────

  bot.onSlashCommand("/cal", async (event) => {
    if (event.adapter.name !== "slack") return;

    const args = event.text.trim().split(/\s+/);
    const subcommand = args[0]?.toLowerCase() ?? "help";
    const teamId = extractTeamIdFromRaw(event.raw, event.adapter.name);
    const userId = event.user.userId;
    logger.info("Slash command /cal", { subcommand, teamId, userId });

    const lastStreamErrorRef = { current: null as Error | null };
    await withBotErrorHandling(
      async () => {
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
          case "bookings": {
            const accessToken = await getValidAccessToken(teamId, userId);
            if (!accessToken) {
              await event.channel.postEphemeral(
                event.user,
                oauthLinkMessage("slack", teamId, userId),
                { fallbackToDM: true }
              );
              return;
            }
            const linked = await getLinkedUser(teamId, userId);
            if (!linked) {
              await event.channel.postEphemeral(
                event.user,
                oauthLinkMessage("slack", teamId, userId),
                { fallbackToDM: true }
              );
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
            await safeChannelPost(event, card);
            break;
          }
          case "availability": {
            const accessToken = await getValidAccessToken(teamId, userId);
            if (!accessToken) {
              await event.channel.postEphemeral(
                event.user,
                oauthLinkMessage("slack", teamId, userId),
                { fallbackToDM: true }
              );
              return;
            }
            const linked = await getLinkedUser(teamId, userId);
            if (!linked) {
              await event.channel.postEphemeral(
                event.user,
                oauthLinkMessage("slack", teamId, userId),
                { fallbackToDM: true }
              );
              return;
            }
            const eventTypes = await getEventTypes(accessToken).catch(() => []);
            if (eventTypes.length === 0) {
              await event.channel.postEphemeral(
                event.user,
                "You have no event types. Create one at " + CALCOM_APP_URL + " first.",
                { fallbackToDM: true }
              );
              return;
            }
            const mentionMatch = event.text.match(/<@([A-Z0-9]+)>/);
            const targetSlackId = mentionMatch?.[1];
            const eventType = eventTypes[0]!;
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

            if (targetSlackId) {
              const lookupTarget = makeLookupSlackUser(teamId);
              const targetProfile = await lookupTarget(targetSlackId);
              const targetName = targetProfile?.realName ?? targetProfile?.name ?? "Attendee";
              const targetEmail = targetProfile?.email;
              if (targetEmail) {
                await setBookingFlow(teamId, userId, {
                  eventTypeId: eventType.id,
                  eventTypeTitle: eventType.title,
                  targetUserSlackId: targetSlackId,
                  targetName,
                  targetEmail,
                  step: "awaiting_slot",
                  slots: allSlots,
                });
                await safeChannelPost(event, availabilityCard(allSlots, eventType.title, targetName));
              } else {
                await safeChannelPost(
                  event,
                  availabilityListCard(allSlots, eventType.title)
                );
              }
            } else {
              await safeChannelPost(event, availabilityListCard(allSlots, eventType.title));
            }
            break;
          }
          case "book": {
            const mentionMatch = event.text.match(/<@([A-Z0-9]+)>/);
            const targetSlackId = mentionMatch?.[1];
            if (!targetSlackId) {
              await event.channel.postEphemeral(
                event.user,
                "Usage: `/cal book @user` — mention the person you want to book with.",
                { fallbackToDM: true }
              );
              return;
            }

            const accessToken = await getValidAccessToken(teamId, userId);
            if (!accessToken) {
              await event.channel.postEphemeral(
                event.user,
                oauthLinkMessage("slack", teamId, userId),
                { fallbackToDM: true }
              );
              return;
            }

            const linked = await getLinkedUser(teamId, userId);
            if (!linked) {
              await event.channel.postEphemeral(
                event.user,
                oauthLinkMessage("slack", teamId, userId),
                { fallbackToDM: true }
              );
              return;
            }

            const eventTypes = await getEventTypes(accessToken).catch(() => []);
            if (eventTypes.length === 0) {
              await event.channel.postEphemeral(
                event.user,
                "You have no event types. Create one at " + CALCOM_APP_URL + " first.",
                { fallbackToDM: true }
              );
              return;
            }

            const openModal = (event as { openModal?: (modal: unknown) => Promise<unknown> }).openModal;
            if (!openModal) {
              const result = runAgentStream({
                teamId,
                userId,
                userMessage: `book meeting with <@${targetSlackId}>`,
                lookupPlatformUser: makeLookupSlackUser(teamId),
                platform: "slack",
                logger: bot.getLogger("agent"),
                onErrorRef: lastStreamErrorRef,
              });
              await safeChannelPost(event, result.textStream);
              return;
            }

            const bookModal = Modal({
              callbackId: "book_event_type",
              title: "Book a Meeting",
              submitLabel: "Continue",
              notifyOnClose: true,
              privateMetadata: JSON.stringify({ teamId, targetSlackId }),
              children: [
                Select({
                  id: "event_type",
                  label: "Event Type",
                  placeholder: "Select a meeting type",
                  options: eventTypes.map((et) =>
                    SelectOption({ label: et.title, value: String(et.id) })
                  ),
                }),
              ],
            });
            await openModal(bookModal);
            break;
          }
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
              lookupPlatformUser: makeLookupSlackUser(teamId),
              platform: "slack",
              logger: bot.getLogger("agent"),
              onErrorRef: lastStreamErrorRef,
            });

            await safeChannelPost(event, result.textStream);
          }
        }
      },
      {
        postError: (msg) => safeChannelPost(event, msg).catch(() => {}),
        logContext: "/cal",
        getCustomErrorMessage: () => {
          if (!lastStreamErrorRef.current) return undefined;
          if (isAIRateLimitError(lastStreamErrorRef.current))
            return "I've hit my daily token limit. Please try again later when the limit resets.";
          if (isAIToolCallError(lastStreamErrorRef.current))
            return "I had trouble processing that request. Please try again, or be more specific (e.g. run /cal bookings first, then cancel by booking ID).";
          return undefined;
        },
      }
    );
  });

  // ─── Modal submit: book_select_user (App Home → event type) ─────────────────

  bot.onModalSubmit("book_select_user", async (event) => {
    if (event.adapter.name !== "slack") return;

    const meta = event.privateMetadata
      ? (JSON.parse(event.privateMetadata) as { teamId: string })
      : null;
    logger.info("Modal submit book_select_user", { teamId: meta?.teamId, userId: event.user?.userId });
    if (!meta) return;

    const input = event.values.target_user?.trim() ?? "";
    const match = input.match(/U[A-Z0-9]+/);
    const targetSlackId = match?.[0];
    if (!targetSlackId) {
      return {
        action: "errors" as const,
        errors: {
          target_user:
            "Enter a valid Slack user ID (e.g. U12345) or paste an @mention.",
        },
      };
    }

    const { teamId } = meta;
    const userId = event.user.userId;
    const accessToken = await getValidAccessToken(teamId, userId);
    if (!accessToken) {
      const dm = await bot.openDM(event.user);
      await dm.post(oauthLinkMessage("slack", teamId, userId)).catch(() => {});
      return;
    }

    const eventTypes = await getEventTypes(accessToken).catch(() => []);
    if (eventTypes.length === 0) {
      const dm = await bot.openDM(event.user);
      await dm
        .post("You have no event types. Create one at " + CALCOM_APP_URL + " first.")
        .catch(() => {});
      return;
    }

    const lookupTarget = makeLookupSlackUser(teamId);
    const targetProfile = await lookupTarget(targetSlackId);
    const targetEmail = targetProfile?.email;
    if (!targetEmail) {
      return {
        action: "errors" as const,
        errors: {
          target_user:
            "Could not find that user's email on Slack. Try /cal book @user in a channel instead.",
        },
      };
    }

    const bookEventTypeModal = Modal({
      callbackId: "book_event_type",
      title: "Book a Meeting",
      submitLabel: "Continue",
      notifyOnClose: true,
      privateMetadata: JSON.stringify({ teamId, targetSlackId }),
      children: [
        Select({
          id: "event_type",
          label: "Event Type",
          placeholder: "Select a meeting type",
          options: eventTypes.map((et) =>
            SelectOption({ label: et.title, value: String(et.id) })
          ),
        }),
      ],
    });
    return { action: "push" as const, modal: bookEventTypeModal };
  });

  // ─── Modal close: book_select_user ────────────────────────────────────────

  bot.onModalClose("book_select_user", async (event) => {
    if (event.adapter.name !== "slack") return;
    const dm = await bot.openDM(event.user);
    await dm.post("Booking cancelled. Run `/cal book @user` in a channel when ready.").catch(() => {});
  });

  // ─── Modal close: book_event_type ──────────────────────────────────────────

  bot.onModalClose("book_event_type", async (event) => {
    if (event.adapter.name !== "slack") return;
    const msg = "Booking cancelled. Run `/cal book @user` when ready.";
    if (event.relatedThread) {
      await event.relatedThread.post(msg).catch(() => {});
    } else if (event.relatedChannel) {
      await event.relatedChannel
        .postEphemeral(event.user, msg, { fallbackToDM: true })
        .catch(() => {});
    } else {
      const dm = await bot.openDM(event.user);
      await dm.post(msg).catch(() => {});
    }
  });

  // ─── Modal submit: book_event_type ───────────────────────────────────────
  // Uses relatedChannel for slash-command context; falls back to DM when opened from App Home.

  bot.onModalSubmit("book_event_type", async (event) => {
    if (event.adapter.name !== "slack") return;

    const meta = event.privateMetadata
      ? (JSON.parse(event.privateMetadata) as { teamId: string; targetSlackId: string })
      : null;
    logger.info("Modal submit book_event_type", { teamId: meta?.teamId, userId: event.user?.userId, eventTypeId: event.values?.event_type });
    if (!meta) return;

    const eventTypeRaw = event.values.event_type;
    if (!eventTypeRaw || Number.isNaN(Number(eventTypeRaw))) {
      return { action: "errors" as const, errors: { event_type: "Please select an event type" } };
    }

    const { teamId, targetSlackId } = meta;
    const userId = event.user.userId;
    const eventTypeId = Number(eventTypeRaw);

    const accessToken = await getValidAccessToken(teamId, userId);
    if (!accessToken) {
      if (event.relatedChannel) {
        await event.relatedChannel.postEphemeral(
          event.user,
          oauthLinkMessage("slack", teamId, userId),
          { fallbackToDM: true }
        );
      } else {
        const dm = await bot.openDM(event.user);
        await dm.post(oauthLinkMessage("slack", teamId, userId));
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
      const errMsg =
        "Could not find that user's email on Slack. Please book via @mention and provide their email.";
      if (event.relatedChannel) {
        await event.relatedChannel.postEphemeral(event.user, errMsg, { fallbackToDM: true });
      } else {
        const dm = await bot.openDM(event.user);
        await dm.post(errMsg);
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
      } else {
        const dm = await bot.openDM(event.user);
        await dm.post(availabilityCard(allSlots, eventTypeTitle, targetName));
      }
    } catch {
      const errMsg = "Failed to fetch available slots. Please try again.";
      if (event.relatedChannel) {
        await event.relatedChannel.postEphemeral(event.user, errMsg, { fallbackToDM: true });
      } else {
        const dm = await bot.openDM(event.user);
        await dm.post(errMsg);
      }
    }
  });

  // ─── Action: select_slot ─────────────────────────────────────────────────

  bot.onAction("select_slot", async (event) => {
    if (event.adapter.name !== "slack") return;

    const ctx = extractPlatformContextFromEvent(event);
    const { teamId, userId } = ctx;
    logger.info("Action select_slot", { actionId: "select_slot", teamId, userId });
    const selectedTime = event.value ?? "";

    await withBotErrorHandling(
      async () => {
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
      },
      {
        postError: (msg) => event.thread.post(msg).catch(() => {}),
        logContext: "select_slot",
      }
    );
  });

  // ─── Action: confirm_booking + cancel_booking ─────────────────────────────

  bot.onAction(["confirm_booking", "cancel_booking"], async (event) => {
    if (event.adapter.name !== "slack") return;

    const ctx = extractPlatformContextFromEvent(event);
    const { teamId, userId } = ctx;
    logger.info("Action confirm/cancel booking", { actionId: event.actionId, teamId, userId });

    if (event.actionId === "cancel_booking") {
      await withBotErrorHandling(
        async () => {
          await clearBookingFlow(teamId, userId);
          await event.thread.post("Booking cancelled.");
        },
        {
          postError: (msg) => event.thread.post(msg).catch(() => {}),
          logContext: "cancel_booking",
        }
      );
      return;
    }

    await withBotErrorHandling(
      async () => {
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

        const confirmCard = Card({
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
        });
        await sent.edit(confirmCard);
      },
      {
        postError: (msg) => event.thread.post(msg).catch(() => {}),
        logContext: "confirm_booking",
        getCustomErrorMessage: (err) =>
          (err instanceof Error ? `Failed to create booking: ${err.message}` : undefined),
      }
    );
  });

  // ─── Action: retry_response ─────────────────────────────────────────────

  bot.onAction("retry_response", async (event) => {
    const ctx = extractPlatformContextFromEvent(event);
    const { teamId, userId } = ctx;
    logger.info("Action retry_response", { actionId: "retry_response", teamId, userId, platform: event.adapter.name });

    if (event.adapter.name !== "slack" && event.adapter.name !== "telegram") return;

    const lastStreamErrorRef = { current: null as Error | null };
    await withBotErrorHandling(
      async () => {
        const linked = await getLinkedUser(teamId, userId);
        if (!linked) return;

        const history = await buildHistory(event.thread as Thread);
        const lastUserMessage = [...history].reverse().find((m) => m.role === "user");
        if (!lastUserMessage) return;

        await event.thread.startTyping();

        const result = runAgentStream({
          teamId,
          userId,
          userMessage: lastUserMessage.content as string,
          conversationHistory: history.slice(0, -1),
          lookupPlatformUser: event.adapter.name === "slack" ? makeLookupSlackUser(teamId) : undefined,
          platform: event.adapter.name as "slack" | "telegram",
          logger: bot.getLogger("agent"),
          onErrorRef: lastStreamErrorRef,
        });

        await postAgentStream(event.thread as Thread, result, ctx, { onErrorRef: lastStreamErrorRef });
      },
      {
        postError: (msg) => event.thread.post(msg).catch(() => {}),
        logContext: "retry_response",
        getCustomErrorMessage: () => {
          if (!lastStreamErrorRef.current) return undefined;
          if (isAIRateLimitError(lastStreamErrorRef.current))
            return "I've hit my daily token limit. Please try again later when the limit resets.";
          if (isAIToolCallError(lastStreamErrorRef.current))
            return "I had trouble processing that request. Please try again, or be more specific (e.g. run /cal bookings first, then cancel by booking ID).";
          return undefined;
        },
      }
    );
  });
}

export { RETRY_STOP_BLOCKS };
