import type { SlackAdapter } from "@chat-adapter/slack";
import { cardToBlockKit } from "@chat-adapter/slack";
import type { ModelMessage } from "ai";
import type { Chat, SlashCommandEvent, Thread } from "chat";
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
import type { LookupPlatformUserFn } from "../agent";
import { isAIRateLimitError, isAIToolCallError, runAgentStream } from "../agent";
import {
  CalcomApiError,
  cancelBooking,
  createBooking,
  createBookingPublic,
  getAvailableSlotsPublic,
  getBookings,
  getEventTypesByUsername,
  getSchedules,
  rescheduleBooking,
} from "../calcom/client";
import { generateAuthUrl } from "../calcom/oauth";
import { formatBookingTime } from "../calcom/webhooks";
import { getLogger } from "../logger";
import {
  availabilityCard,
  availabilityListCard,
  bookConfirmCard,
  bookEventTypePickerCard,
  bookSlotPickerCard,
  bookingConfirmationCard,
  cancelBookingPickerCard,
  cancelConfirmCard,
  eventTypesListCard,
  helpCard,
  profileCard,
  rescheduleBookingPickerCard,
  rescheduleConfirmCard,
  rescheduleSlotPickerCard,
  schedulesListCard,
  upcomingBookingsCard,
} from "../notifications";
import {
  clearBookingFlow,
  clearCancelFlow,
  clearRescheduleFlow,
  getBookingFlow,
  getCancelFlow,
  getLinkedUser,
  getRescheduleFlow,
  getValidAccessToken,
  isOrgPlanUser,
  setBookingFlow,
  setCancelFlow,
  setRescheduleFlow,
  unlinkUser,
} from "../user-linking";

const logger = getLogger("slack-handlers");
const CALCOM_APP_URL = process.env.CALCOM_APP_URL ?? "https://app.cal.com";

function isSlackAuthError(err: unknown): boolean {
  if (
    err instanceof Error &&
    "code" in err &&
    (err as Record<string, unknown>).code === "slack_webapi_platform_error"
  ) {
    const slackErr = (err as Record<string, unknown>).data as Record<string, unknown> | undefined;
    return slackErr?.error === "not_authed" || slackErr?.error === "invalid_auth";
  }
  return false;
}

export interface PlatformContext {
  platform: string;
  teamId: string;
  userId: string;
}

export type PostAgentStreamFn = (
  thread: Thread,
  agentResult: { textStream: AsyncIterable<string>; text: PromiseLike<string> },
  ctx: { platform: string; teamId: string; userId: string },
  options?: { onErrorRef?: { current: Error | null } }
) => Promise<void>;

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
  friendlyCalcomError: (err: import("../calcom/client").CalcomApiError, context?: string) => string;
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
  const {
    postAgentStream,
    withBotErrorHandling,
    extractPlatformContextFromEvent,
    extractTeamIdFromRaw,
    buildHistory,
    makeLookupSlackUser,
    friendlyCalcomError,
  } = deps;

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
          Actions([LinkButton({ url: authUrl, label: "Continue with Cal.com" })]),
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
            Actions([LinkButton({ url: authUrl, label: "Reconnect Cal.com" })]),
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
        { status: "upcoming", take: 20 },
        { id: linked.calcomUserId, email: linked.calcomEmail }
      );

      const homeCard = Card({
        title: `Welcome back, ${linked.calcomUsername}! :calendar:`,
        subtitle: "Upcoming Bookings",
        children: [
          ...(bookings.length > 0
            ? bookings.slice(0, 20).flatMap((b) => [
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
          CardText(
            ':bulb: _Tip: @mention me in any channel to chat naturally — "show my bookings", "book a meeting with @someone", "what\'s my availability?"_'
          ),
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
    } catch (err) {
      const isAuthError = err instanceof CalcomApiError && (err.statusCode === 401 || err.statusCode === 403);
      const authUrl = generateAuthUrl("slack", teamId, userId);
      const errorCard = isAuthError
        ? Card({
            title: "Could Not Load Bookings",
            children: [
              CardText("Your session may have expired — please reconnect."),
              Actions([LinkButton({ url: authUrl, label: "Reconnect Cal.com" })]),
            ],
          })
        : Card({
            title: "Could Not Load Bookings",
            children: [
              CardText("Could not load bookings. Please try again later."),
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
    logger.info("Action book_meeting", {
      actionId: "book_meeting",
      teamId: ctx.teamId,
      userId: ctx.userId,
    });

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
            await event.channel.postEphemeral(event.user, helpCard(), { fallbackToDM: true });
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
              { status: "upcoming", take: 20 },
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
            await event.channel.postEphemeral(event.user, card, { fallbackToDM: true });
            break;
          }
          case "availability": {
            const linked = await getLinkedUser(teamId, userId);
            if (!linked) {
              await event.channel.postEphemeral(
                event.user,
                oauthLinkMessage("slack", teamId, userId),
                { fallbackToDM: true }
              );
              return;
            }
            const eventTypes = await getEventTypesByUsername(linked.calcomUsername);
            if (eventTypes.length === 0) {
              await event.channel.postEphemeral(
                event.user,
                `You have no event types. Create one at <${CALCOM_APP_URL}|cal.com>.`,
                { fallbackToDM: true }
              );
              return;
            }
            const mentionMatch = event.text.match(/<@([A-Z0-9]+)>/);
            const targetSlackId = mentionMatch?.[1];
            const eventType = eventTypes[0];
            const now = new Date();
            const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            const slotsMap = await getAvailableSlotsPublic({
              eventTypeSlug: eventType.slug,
              username: linked.calcomUsername,
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
              await event.channel.postEphemeral(
                event.user,
                availabilityListCard(allSlots, eventType.title, {
                  targetName,
                  hint: "Use `/cal book <cal-username>` to book a meeting (Cal.com username, not Slack name).",
                }),
                { fallbackToDM: true }
              );
            } else {
              await event.channel.postEphemeral(event.user, availabilityListCard(allSlots, eventType.title), { fallbackToDM: true });
            }
            break;
          }
          case "book": {
            const targetUsername = args.slice(1).join(" ").trim().replace(/^@/, "");
            if (!targetUsername) {
              await event.channel.postEphemeral(
                event.user,
                "Usage: `/cal book <username>` — enter the Cal.com username to book with.",
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

            const targetEventTypes = await getEventTypesByUsername(targetUsername);
            if (targetEventTypes.length === 0) {
              await event.channel.postEphemeral(
                event.user,
                `No public event types found for *${targetUsername}*. Check the username and try again.`,
                { fallbackToDM: true }
              );
              return;
            }

            if (targetEventTypes.length === 1) {
              const et = targetEventTypes[0];
              const now = new Date();
              const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
              const slotsMap = await getAvailableSlotsPublic({
                eventTypeSlug: et.slug,
                username: targetUsername,
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

              await setBookingFlow(teamId, userId, {
                eventTypeId: et.id,
                eventTypeTitle: et.title,
                targetUsername,
                eventTypeSlug: et.slug,
                isPublicBooking: true,
                step: "awaiting_slot",
                slots: allSlots,
              });

              await event.channel.postEphemeral(
                event.user,
                bookSlotPickerCard(allSlots, et.title, targetUsername),
                { fallbackToDM: true }
              );
            } else {
              await setBookingFlow(teamId, userId, {
                eventTypeId: 0,
                eventTypeTitle: "",
                targetUsername,
                isPublicBooking: true,
                step: "awaiting_slot",
              });

              await event.channel.postEphemeral(
                event.user,
                bookEventTypePickerCard(targetEventTypes, targetUsername),
                { fallbackToDM: true }
              );
            }
            break;
          }
          case "profile": {
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
            const card = profileCard({
              calcomUsername: linked.calcomUsername,
              calcomEmail: linked.calcomEmail,
              calcomTimeZone: linked.calcomTimeZone,
              linkedAt: linked.linkedAt,
              calcomOrganizationId: linked.calcomOrganizationId,
            });
            await event.channel.postEphemeral(event.user, card, { fallbackToDM: true });
            break;
          }
          case "event-types":
          case "eventtypes": {
            const linked = await getLinkedUser(teamId, userId);
            if (!linked) {
              await event.channel.postEphemeral(
                event.user,
                oauthLinkMessage("slack", teamId, userId),
                { fallbackToDM: true }
              );
              return;
            }
            const eventTypes = await getEventTypesByUsername(linked.calcomUsername);
            const card = eventTypesListCard(
              eventTypes.map((et) => ({
                title: et.title,
                slug: et.slug,
                length: et.length,
                hidden: et.hidden,
                bookingUrl: et.bookingUrl,
              }))
            );
            await event.channel.postEphemeral(event.user, card, { fallbackToDM: true });
            break;
          }
          case "schedules": {
            const accessToken = await getValidAccessToken(teamId, userId);
            if (!accessToken) {
              await event.channel.postEphemeral(
                event.user,
                oauthLinkMessage("slack", teamId, userId),
                { fallbackToDM: true }
              );
              return;
            }
            const schedules = await getSchedules(accessToken);
            const card = schedulesListCard(
              schedules.map((s) => ({
                name: s.name,
                isDefault: s.isDefault,
                timeZone: s.timeZone,
                availability: s.availability,
              }))
            );
            await event.channel.postEphemeral(event.user, card, { fallbackToDM: true });
            break;
          }
          case "cancel": {
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
              { status: "upcoming", take: 100 },
              { id: linked.calcomUserId, email: linked.calcomEmail }
            );
            const card = cancelBookingPickerCard(
              bookings.map((b) => ({
                uid: b.uid,
                title: b.title,
                start: b.start,
                end: b.end,
              }))
            );
            await event.channel.postEphemeral(event.user, card, { fallbackToDM: true });
            break;
          }
          case "reschedule": {
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
              { status: "upcoming", take: 100 },
              { id: linked.calcomUserId, email: linked.calcomEmail }
            );
            const card = rescheduleBookingPickerCard(
              bookings.map((b) => ({
                uid: b.uid,
                title: b.title,
                start: b.start,
                end: b.end,
              }))
            );
            await event.channel.postEphemeral(event.user, card, { fallbackToDM: true });
            break;
          }
          default: {
            const naturalQuery = event.text.trim();
            if (!naturalQuery) {
              await event.channel.postEphemeral(event.user, helpCard(), { fallbackToDM: true });
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
            if (!isOrgPlanUser(linked)) {
              await event.channel.postEphemeral(
                event.user,
                "The AI assistant is available on the Cal.com Organizations plan. Use `/cal help` to see available slash commands, or upgrade at <https://cal.com/pricing|cal.com/pricing>.",
                { fallbackToDM: true }
              );
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
        postError: (msg) =>
          event.channel.postEphemeral(event.user, msg, { fallbackToDM: true }).catch(() => {}),
        logContext: "/cal",
        getCustomErrorMessage: (err) => {
          if (!lastStreamErrorRef.current) return undefined;
          if (isAIRateLimitError(lastStreamErrorRef.current))
            return "I've hit my daily token limit. Please try again later when the limit resets.";
          if (isAIToolCallError(lastStreamErrorRef.current))
            return "I had trouble processing that request. Please try again, or be more specific (e.g. run /cal bookings first, then cancel by booking ID).";
          if (lastStreamErrorRef.current instanceof CalcomApiError)
            return friendlyCalcomError(lastStreamErrorRef.current);
          if (isSlackAuthError(err))
            return "Sorry, something went wrong while processing your request. Please try again.";
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
    logger.info("Modal submit book_select_user", {
      teamId: meta?.teamId,
      userId: event.user?.userId,
    });
    if (!meta) return;

    const input = event.values.target_user?.trim() ?? "";
    const match = input.match(/U[A-Z0-9]+/);
    const targetSlackId = match?.[0];
    if (!targetSlackId) {
      return {
        action: "errors" as const,
        errors: {
          target_user: "Enter a valid Slack user ID (e.g. U12345) or paste an @mention.",
        },
      };
    }

    const { teamId } = meta;
    const userId = event.user.userId;
    const linked = await getLinkedUser(teamId, userId);
    if (!linked) {
      const dm = await bot.openDM(event.user);
      await dm.post(oauthLinkMessage("slack", teamId, userId)).catch(() => {});
      return;
    }

    const eventTypes = await getEventTypesByUsername(linked.calcomUsername);
    if (eventTypes.length === 0) {
      const dm = await bot.openDM(event.user);
      await dm
        .post(`You have no event types. Create one at <${CALCOM_APP_URL}|cal.com> first.`)
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
          options: eventTypes.map((et) => SelectOption({ label: et.title, value: String(et.id) })),
        }),
      ],
    });
    return { action: "push" as const, modal: bookEventTypeModal };
  });

  // ─── Modal close: book_select_user ────────────────────────────────────────

  bot.onModalClose("book_select_user", async (event) => {
    if (event.adapter.name !== "slack") return;
    const dm = await bot.openDM(event.user);
    await dm
      .post("Booking cancelled. Run `/cal book @user` in a channel when ready.")
      .catch(() => {});
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
    logger.info("Modal submit book_event_type", {
      teamId: meta?.teamId,
      userId: event.user?.userId,
      eventTypeId: event.values?.event_type,
    });
    if (!meta) return;

    const eventTypeRaw = event.values.event_type;
    if (!eventTypeRaw || Number.isNaN(Number(eventTypeRaw))) {
      return { action: "errors" as const, errors: { event_type: "Please select an event type" } };
    }

    const { teamId, targetSlackId } = meta;
    const userId = event.user.userId;
    const eventTypeId = Number(eventTypeRaw);

    const linked = await getLinkedUser(teamId, userId);
    if (!linked) {
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
      const eventTypes = await getEventTypesByUsername(linked.calcomUsername);
      const matchedEventType = eventTypes.find((et) => et.id === eventTypeId);
      const eventTypeSlug = matchedEventType?.slug;
      if (!eventTypeSlug) {
        const errMsg = "Event type not found. It may have been deleted. Please try again.";
        if (event.relatedChannel) {
          await event.relatedChannel.postEphemeral(event.user, errMsg, { fallbackToDM: true });
        } else {
          const dm = await bot.openDM(event.user);
          await dm.post(errMsg);
        }
        return;
      }

      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const slotsMap = await getAvailableSlotsPublic({
        eventTypeSlug,
        username: linked.calcomUsername,
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

      const eventTypeTitle = matchedEventType?.title ?? "Meeting";

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
    if (!event.thread) return;
    const thread = event.thread;

    await withBotErrorHandling(
      async () => {
        const [accessToken, flow] = await Promise.all([
          getValidAccessToken(teamId, userId),
          getBookingFlow(teamId, userId),
        ]);

        if (!accessToken || !flow) {
          await thread.post("Booking session expired. Please start again by @mentioning me.");
          return;
        }

        const slotLabel = flow.slots?.find((s) => s.time === selectedTime)?.label ?? selectedTime;

        await setBookingFlow(teamId, userId, {
          ...flow,
          step: "awaiting_confirmation",
          selectedSlot: selectedTime,
        });

        await thread.post(
          bookingConfirmationCard(flow.eventTypeTitle, slotLabel, flow.targetName ?? "them")
        );
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
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

    if (!event.thread) return;
    const thread = event.thread;

    if (event.actionId === "cancel_booking") {
      await withBotErrorHandling(
        async () => {
          await clearBookingFlow(teamId, userId);
          await thread.post("Booking cancelled.");
        },
        {
          postError: (msg) => thread.post(msg).catch(() => {}),
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
          await thread.post("Booking session expired. Please start again by @mentioning me.");
          return;
        }

        const sent = await thread.post("Creating your booking...");

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
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "confirm_booking",
        getCustomErrorMessage: (err) => {
          if (err instanceof CalcomApiError) {
            return friendlyCalcomError(err, "booking");
          }
          return err instanceof Error ? "Failed to create the booking. Please try again." : undefined;
        },
      }
    );
  });

  // ─── Public booking flow action handlers (/cal book <username>) ───────────

  bot.onAction("select_book_event_type", async (event) => {
    if (event.adapter.name !== "slack") return;

    const ctx = extractPlatformContextFromEvent(event);
    const { teamId, userId } = ctx;
    const selectedSlug = event.value ?? "";
    if (!event.thread) return;
    const thread = event.thread;

    await withBotErrorHandling(
      async () => {
        const [flow, linked] = await Promise.all([
          getBookingFlow(teamId, userId),
          getLinkedUser(teamId, userId),
        ]);

        if (!flow || !flow.targetUsername || !linked) {
          await thread.post("Booking session expired. Please start again with `/cal book <username>`.");
          return;
        }

        const targetUsername = flow.targetUsername;
        const targetEventTypes = await getEventTypesByUsername(targetUsername);
        const selectedEt = targetEventTypes.find((et) => et.slug === selectedSlug);
        if (!selectedEt) {
          await thread.post("Event type not found. Please start again with `/cal book <username>`.");
          return;
        }

        const now = new Date();
        const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const slotsMap = await getAvailableSlotsPublic({
          eventTypeSlug: selectedSlug,
          username: targetUsername,
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

        await setBookingFlow(teamId, userId, {
          ...flow,
          eventTypeId: selectedEt.id,
          eventTypeTitle: selectedEt.title,
          eventTypeSlug: selectedSlug,
          step: "awaiting_slot",
          slots: allSlots,
        });

        await thread.post(bookSlotPickerCard(allSlots, selectedEt.title, targetUsername));
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "select_book_event_type",
      }
    );
  });

  bot.onAction("select_book_slot", async (event) => {
    if (event.adapter.name !== "slack") return;

    const ctx = extractPlatformContextFromEvent(event);
    const { teamId, userId } = ctx;
    const selectedTime = event.value ?? "";
    if (!event.thread) return;
    const thread = event.thread;

    await withBotErrorHandling(
      async () => {
        const flow = await getBookingFlow(teamId, userId);

        if (!flow || !flow.targetUsername) {
          await thread.post("Booking session expired. Please start again with `/cal book <username>`.");
          return;
        }

        const slotLabel = flow.slots?.find((s) => s.time === selectedTime)?.label ?? selectedTime;

        await setBookingFlow(teamId, userId, {
          ...flow,
          step: "awaiting_confirmation",
          selectedSlot: selectedTime,
        });

        await thread.post(
          bookConfirmCard(flow.eventTypeTitle, slotLabel, flow.targetUsername)
        );
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "select_book_slot",
      }
    );
  });

  bot.onAction(["confirm_book", "cancel_book"], async (event) => {
    if (event.adapter.name !== "slack") return;

    const ctx = extractPlatformContextFromEvent(event);
    const { teamId, userId } = ctx;
    if (!event.thread) return;
    const thread = event.thread;

    if (event.actionId === "cancel_book") {
      await withBotErrorHandling(
        async () => {
          await clearBookingFlow(teamId, userId);
          await thread.post("Booking cancelled.");
        },
        {
          postError: (msg) => thread.post(msg).catch(() => {}),
          logContext: "cancel_book",
        }
      );
      return;
    }

    await withBotErrorHandling(
      async () => {
        const [flow, linked] = await Promise.all([
          getBookingFlow(teamId, userId),
          getLinkedUser(teamId, userId),
        ]);

        if (
          !flow ||
          !flow.selectedSlot ||
          !flow.eventTypeSlug ||
          !flow.targetUsername ||
          !linked
        ) {
          await thread.post(
            "Booking session expired. Please start again with `/cal book <username>`."
          );
          return;
        }

        const sent = await thread.post("Creating your booking...");

        const booking = await createBookingPublic({
          eventTypeSlug: flow.eventTypeSlug,
          username: flow.targetUsername,
          start: flow.selectedSlot,
          attendee: {
            name: linked.calcomUsername ?? linked.calcomEmail,
            email: linked.calcomEmail,
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
                value: flow.targetUsername,
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
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "confirm_book",
        getCustomErrorMessage: (err) => {
          if (err instanceof CalcomApiError) {
            return friendlyCalcomError(err, "booking");
          }
          return err instanceof Error
            ? "Failed to create the booking. Please try again."
            : undefined;
        },
      }
    );
  });

  // ─── Cancel flow action handlers ──────────────────────────────────────────

  bot.onAction("cancel_bk", async (event) => {
    if (event.adapter.name !== "slack") return;

    const ctx = extractPlatformContextFromEvent(event);
    const { teamId, userId } = ctx;
    const bookingUid = event.value ?? "";
    if (!event.thread) return;
    const thread = event.thread;

    await withBotErrorHandling(
      async () => {
        const accessToken = await getValidAccessToken(teamId, userId);
        if (!accessToken) return;
        const linked = await getLinkedUser(teamId, userId);
        if (!linked) return;

        const bookings = await getBookings(
          accessToken,
          { status: "upcoming", take: 100 },
          { id: linked.calcomUserId, email: linked.calcomEmail }
        );
        const selected = bookings.find((b) => b.uid === bookingUid);
        if (!selected) {
          await thread.post("Booking not found. It may have already been cancelled.");
          return;
        }

        await setCancelFlow(teamId, userId, {
          bookingUid: selected.uid,
          bookingTitle: selected.title,
          isRecurring: !!selected.recurringBookingUid,
          step: "awaiting_confirmation",
        });

        const time = formatBookingTime(selected.start, selected.end, linked.calcomTimeZone);
        await thread.post(cancelConfirmCard(selected.title, time, !!selected.recurringBookingUid));
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "cancel_bk action",
      }
    );
  });

  bot.onAction(["cancel_confirm", "cancel_all", "cancel_back"], async (event) => {
    if (event.adapter.name !== "slack") return;

    const ctx = extractPlatformContextFromEvent(event);
    const { teamId, userId } = ctx;
    if (!event.thread) return;
    const thread = event.thread;

    if (event.actionId === "cancel_back") {
      await clearCancelFlow(teamId, userId);
      await thread.post("Cancellation aborted.");
      return;
    }

    await withBotErrorHandling(
      async () => {
        const flow = await getCancelFlow(teamId, userId);
        if (!flow?.bookingUid) {
          await thread.post("Cancel session expired. Please start again with `/cal cancel`.");
          return;
        }
        const accessToken = await getValidAccessToken(teamId, userId);
        if (!accessToken) return;

        const cancelAll = event.actionId === "cancel_all";
        await cancelBooking(accessToken, flow.bookingUid, "Cancelled via Slack bot", cancelAll);
        await clearCancelFlow(teamId, userId);

        const msg = cancelAll
          ? `Booking *${flow.bookingTitle}* and all future occurrences have been cancelled.`
          : `Booking *${flow.bookingTitle}* has been cancelled.`;
        await thread.post(msg);
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "cancel_confirm action",
        getCustomErrorMessage: (err) => {
          if (err instanceof CalcomApiError) return friendlyCalcomError(err);
          return undefined;
        },
      }
    );
  });

  // ─── Reschedule flow action handlers ────────────────────────────────────────

  bot.onAction("reschedule_bk", async (event) => {
    if (event.adapter.name !== "slack") return;

    const ctx = extractPlatformContextFromEvent(event);
    const { teamId, userId } = ctx;
    const bookingUid = event.value ?? "";
    if (!event.thread) return;
    const thread = event.thread;

    await withBotErrorHandling(
      async () => {
        const accessToken = await getValidAccessToken(teamId, userId);
        if (!accessToken) return;
        const linked = await getLinkedUser(teamId, userId);
        if (!linked) return;

        const bookings = await getBookings(
          accessToken,
          { status: "upcoming", take: 100 },
          { id: linked.calcomUserId, email: linked.calcomEmail }
        );
        const selected = bookings.find((b) => b.uid === bookingUid);
        if (!selected) {
          await thread.post("Booking not found. It may have already been cancelled.");
          return;
        }

        const eventTypeSlug = selected.eventType?.slug;
        const eventTypeId = selected.eventType?.id ?? 0;
        if (!eventTypeSlug) {
          await thread.post("Cannot reschedule: event type information is missing for this booking.");
          return;
        }

        const emailLower = linked.calcomEmail.toLowerCase();
        const isHost =
          selected.hosts?.some(
            (h) =>
              String(h.id) === String(linked.calcomUserId) ||
              h.email?.toLowerCase() === emailLower
          );
        if (!isHost) {
          await thread.post(
            "You're an attendee on this booking, not the host. Rescheduling as an attendee isn't supported here — please use the reschedule link in your booking confirmation email or reschedule at <https://app.cal.com/bookings|app.cal.com/bookings>."
          );
          return;
        }

        const now = new Date();
        const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const slotsMap = await getAvailableSlotsPublic({
          eventTypeSlug,
          username: linked.calcomUsername,
          start: now.toISOString(),
          end: weekLater.toISOString(),
          timeZone: linked.calcomTimeZone,
          bookingUidToReschedule: bookingUid,
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

        if (allSlots.length === 0) {
          await thread.post("No available slots in the next 7 days. Please try again later.");
          return;
        }

        await setRescheduleFlow(teamId, userId, {
          bookingUid: selected.uid,
          bookingTitle: selected.title,
          originalStart: selected.start,
          eventTypeId,
          step: "awaiting_slot",
          slots: allSlots,
        });

        const originalTime = formatBookingTime(selected.start, selected.end, linked.calcomTimeZone);
        await thread.post(rescheduleSlotPickerCard(allSlots, selected.title, originalTime));
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "reschedule_bk action",
      }
    );
  });

  bot.onAction("reschedule_select_slot", async (event) => {
    if (event.adapter.name !== "slack") return;

    const ctx = extractPlatformContextFromEvent(event);
    const { teamId, userId } = ctx;
    const selectedTime = event.value ?? "";
    if (!event.thread) return;
    const thread = event.thread;

    await withBotErrorHandling(
      async () => {
        const flow = await getRescheduleFlow(teamId, userId);
        if (!flow) {
          await thread.post("Reschedule session expired. Please start again with `/cal reschedule`.");
          return;
        }

        const slotLabel = flow.slots?.find((s) => s.time === selectedTime)?.label ?? selectedTime;
        const linked = await getLinkedUser(teamId, userId);
        const tz = linked?.calcomTimeZone ?? "UTC";
        const oldTime = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(new Date(flow.originalStart));

        await setRescheduleFlow(teamId, userId, {
          ...flow,
          selectedSlot: selectedTime,
          step: "awaiting_confirmation",
        });

        await thread.post(rescheduleConfirmCard(flow.bookingTitle, oldTime, slotLabel));
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "reschedule_select_slot action",
      }
    );
  });

  bot.onAction(["reschedule_confirm", "reschedule_back"], async (event) => {
    if (event.adapter.name !== "slack") return;

    const ctx = extractPlatformContextFromEvent(event);
    const { teamId, userId } = ctx;
    if (!event.thread) return;
    const thread = event.thread;

    if (event.actionId === "reschedule_back") {
      await clearRescheduleFlow(teamId, userId);
      await thread.post("Reschedule cancelled.");
      return;
    }

    await withBotErrorHandling(
      async () => {
        const flow = await getRescheduleFlow(teamId, userId);
        if (!flow?.selectedSlot) {
          await thread.post("Reschedule session expired. Please start again with `/cal reschedule`.");
          return;
        }
        const accessToken = await getValidAccessToken(teamId, userId);
        if (!accessToken) return;

        const booking = await rescheduleBooking(
          accessToken,
          flow.bookingUid,
          flow.selectedSlot,
          "Rescheduled via Slack bot"
        );
        const linked = await getLinkedUser(teamId, userId);
        const tz = linked?.calcomTimeZone ?? "UTC";
        const newTime = formatBookingTime(booking.start, booking.end, tz);
        await clearRescheduleFlow(teamId, userId);
        await thread.post(`Booking *${flow.bookingTitle}* rescheduled to ${newTime}.`);
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "reschedule_confirm action",
        getCustomErrorMessage: (err) => {
          if (err instanceof CalcomApiError) return friendlyCalcomError(err);
          return undefined;
        },
      }
    );
  });

  // ─── Action: retry_response ─────────────────────────────────────────────

  bot.onAction("retry_response", async (event) => {
    const ctx = extractPlatformContextFromEvent(event);
    const { teamId, userId } = ctx;
    logger.info("Action retry_response", {
      actionId: "retry_response",
      teamId,
      userId,
      platform: event.adapter.name,
    });

    if (event.adapter.name !== "slack" && event.adapter.name !== "telegram") return;

    if (!event.thread) return;
    const thread = event.thread as Thread;

    const lastStreamErrorRef = { current: null as Error | null };
    await withBotErrorHandling(
      async () => {
        const linked = await getLinkedUser(teamId, userId);
        if (!linked) return;

        const history = await buildHistory(thread);
        const lastUserMessage = [...history].reverse().find((m) => m.role === "user");
        if (!lastUserMessage) return;

        await thread.startTyping();

        const result = runAgentStream({
          teamId,
          userId,
          userMessage: lastUserMessage.content as string,
          conversationHistory: history.slice(0, -1),
          lookupPlatformUser:
            event.adapter.name === "slack" ? makeLookupSlackUser(teamId) : undefined,
          platform: event.adapter.name as "slack" | "telegram",
          logger: bot.getLogger("agent"),
          onErrorRef: lastStreamErrorRef,
        });

        await postAgentStream(thread, result, ctx, {
          onErrorRef: lastStreamErrorRef,
        });
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "retry_response",
        getCustomErrorMessage: (err) => {
          if (!lastStreamErrorRef.current) return undefined;
          if (isAIRateLimitError(lastStreamErrorRef.current))
            return "I've hit my daily token limit. Please try again later when the limit resets.";
          if (isAIToolCallError(lastStreamErrorRef.current))
            return "I had trouble processing that request. Please try again, or be more specific (e.g. run /cal bookings first, then cancel by booking ID).";
          if (lastStreamErrorRef.current instanceof CalcomApiError)
            return friendlyCalcomError(lastStreamErrorRef.current);
          if (isSlackAuthError(err))
            return "Sorry, something went wrong while processing your request. Please try again.";
          return undefined;
        },
      }
    );
  });
}
