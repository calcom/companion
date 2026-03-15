import type { Chat, ChatElement, Message, Thread } from "chat";
import { Actions, Button, Card, CardText, LinkButton } from "chat";
import {
  cancelBooking,
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
  availabilityListCard,
  cancelConfirmCard,
  eventTypesListCard,
  profileCard,
  rescheduleConfirmCard,
  schedulesListCard,
  telegramBookingConfirmCard,
  telegramEventTypePickerCard,
  telegramHelpCard,
  telegramSlotPickerCard,
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
  setBookingFlow,
  setCancelFlow,
  setRescheduleFlow,
  unlinkUser,
} from "../user-linking";

const logger = getLogger("telegram-handlers");

export const TELEGRAM_COMMANDS = [
  "start",
  "help",
  "link",
  "unlink",
  "bookings",
  "availability",
  "profile",
  "eventtypes",
  "schedules",
  "book",
  "cancel",
  "reschedule",
];

export const TELEGRAM_COMMAND_RE = new RegExp(
  `^\\/(cal\\s+)?(${TELEGRAM_COMMANDS.join("|")})(@\\w+)?\\b`,
  "i"
);

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

async function postPrivately(
  thread: Thread,
  message: Message,
  content: string | ChatElement,
  isGroup: boolean
) {
  if (isGroup) {
    await thread.postEphemeral(message.author, content, { fallbackToDM: true });
  } else {
    await thread.post(content);
  }
}

function formatSlotLabel(time: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(time));
}

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
  const rest = first === "/cal" ? parts.slice(2).join(" ").trim() : parts.slice(1).join(" ").trim();

  const isGroup = thread.id !== `telegram:${ctx.userId}`;

  async function postOAuthLinkPrivately() {
    if (isGroup) {
      await thread.post("Please check your DMs to connect your Cal.com account.");
      await thread.postEphemeral(
        message.author,
        oauthLinkMessage(ctx.platform, ctx.teamId, ctx.userId),
        { fallbackToDM: true }
      );
    } else {
      await thread.post(oauthLinkMessage(ctx.platform, ctx.teamId, ctx.userId));
    }
  }

  async function requireAuth(): Promise<{
    accessToken: string;
    linked: Awaited<ReturnType<typeof getLinkedUser>> & {};
  } | null> {
    const accessToken = await getValidAccessToken(ctx.teamId, ctx.userId);
    if (!accessToken) {
      await postOAuthLinkPrivately();
      return null;
    }
    const linked = await getLinkedUser(ctx.teamId, ctx.userId);
    if (!linked) {
      await postOAuthLinkPrivately();
      return null;
    }
    return { accessToken, linked };
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
            `Your Cal.com account (**${existing.calcomUsername}** \u00b7 ${existing.calcomEmail}) is already connected. Use /unlink to disconnect.`
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
        const auth = await requireAuth();
        if (!auth) return;
        const bookings = await getBookings(
          auth.accessToken,
          { status: "upcoming", take: 5 },
          { id: auth.linked.calcomUserId, email: auth.linked.calcomEmail }
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
        await postPrivately(thread, message, card, isGroup);
        return;
      }

      if (cmd === "availability") {
        const auth = await requireAuth();
        if (!auth) return;
        const slug = rest || undefined;
        const eventTypes = await getEventTypesByUsername(auth.linked.calcomUsername);
        if (eventTypes.length === 0) {
          await thread.post("You have no event types. Create one at https://app.cal.com first.");
          return;
        }
        const eventType = slug
          ? eventTypes.find((et) => et.slug === slug) ?? eventTypes[0]
          : eventTypes[0];
        const now = new Date();
        const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const slotsMap = await getAvailableSlotsPublic({
          eventTypeSlug: eventType.slug,
          username: auth.linked.calcomUsername,
          start: now.toISOString(),
          end: weekLater.toISOString(),
          timeZone: auth.linked.calcomTimeZone,
        });
        const allSlots = Object.values(slotsMap)
          .flat()
          .filter((s) => s.available)
          .slice(0, 5)
          .map((s) => ({
            time: s.time,
            label: formatSlotLabel(s.time, auth.linked.calcomTimeZone),
          }));
        const card = availabilityListCard(allSlots, eventType.title);
        await postPrivately(thread, message, card, isGroup);
        return;
      }

      if (cmd === "profile") {
        const auth = await requireAuth();
        if (!auth) return;
        const card = profileCard({
          calcomUsername: auth.linked.calcomUsername,
          calcomEmail: auth.linked.calcomEmail,
          calcomTimeZone: auth.linked.calcomTimeZone,
          linkedAt: auth.linked.linkedAt,
          calcomOrganizationId: auth.linked.calcomOrganizationId,
        });
        await postPrivately(thread, message, card, isGroup);
        return;
      }

      if (cmd === "eventtypes") {
        const auth = await requireAuth();
        if (!auth) return;
        const eventTypes = await getEventTypesByUsername(auth.linked.calcomUsername);
        const card = eventTypesListCard(
          eventTypes.map((et) => ({
            title: et.title,
            slug: et.slug,
            length: et.length,
            hidden: et.hidden,
          })),
          auth.linked.calcomUsername
        );
        await postPrivately(thread, message, card, isGroup);
        return;
      }

      if (cmd === "schedules") {
        const auth = await requireAuth();
        if (!auth) return;
        const schedules = await getSchedules(auth.accessToken);
        const card = schedulesListCard(
          schedules.map((s) => ({
            name: s.name,
            isDefault: s.isDefault,
            timeZone: s.timeZone,
            availability: s.availability,
          }))
        );
        await postPrivately(thread, message, card, isGroup);
        return;
      }

      if (cmd === "book") {
        const targetUsername = rest.replace(/^@/, "");
        if (!targetUsername) {
          await thread.post("Usage: `/book <username>` \u2014 enter the Cal.com username to book with.");
          return;
        }
        const auth = await requireAuth();
        if (!auth) return;
        const targetEventTypes = await getEventTypesByUsername(targetUsername);
        if (targetEventTypes.length === 0) {
          await thread.post(`No public event types found for **${targetUsername}**.`);
          return;
        }
        await setBookingFlow(ctx.teamId, ctx.userId, {
          eventTypeId: targetEventTypes[0].id,
          eventTypeTitle: targetEventTypes[0].title,
          targetUsername,
          eventTypeSlug: targetEventTypes[0].slug,
          isPublicBooking: true,
          step: "awaiting_slot",
        });
        const card = telegramEventTypePickerCard(
          targetEventTypes.map((et) => ({ title: et.title, slug: et.slug, length: et.length })),
          targetUsername
        );
        await thread.post(card);
        return;
      }

      if (cmd === "cancel") {
        const auth = await requireAuth();
        if (!auth) return;
        const bookings = await getBookings(
          auth.accessToken,
          { status: "upcoming", take: 10 },
          { id: auth.linked.calcomUserId, email: auth.linked.calcomEmail }
        );
        if (bookings.length === 0) {
          await thread.post(
            Card({
              title: "Cancel Booking",
              children: [
                CardText("You have no upcoming bookings to cancel."),
                Actions([LinkButton({ url: "https://app.cal.com/bookings", label: "View Bookings" })]),
              ],
            })
          );
          return;
        }
        await setCancelFlow(ctx.teamId, ctx.userId, {
          bookingUid: JSON.stringify(
            bookings.map((b) => ({
              uid: b.uid, title: b.title, start: b.start, end: b.end,
              isRecurring: !!b.recurringBookingUid,
            }))
          ),
          bookingTitle: "",
          isRecurring: false,
          step: "awaiting_confirmation",
        });
        await thread.post(
          Card({
            title: "Cancel a Booking",
            subtitle: "Select a booking to cancel",
            children: bookings.map((b, i) => {
              const time = formatBookingTime(b.start, b.end);
              return Actions([Button({ id: `tg_cancel_bk_${i}`, label: `${b.title} \u2014 ${time}` })]);
            }),
          })
        );
        return;
      }

      if (cmd === "reschedule") {
        const auth = await requireAuth();
        if (!auth) return;
        const bookings = await getBookings(
          auth.accessToken,
          { status: "upcoming", take: 10 },
          { id: auth.linked.calcomUserId, email: auth.linked.calcomEmail }
        );
        if (bookings.length === 0) {
          await thread.post(
            Card({
              title: "Reschedule Booking",
              children: [
                CardText("You have no upcoming bookings to reschedule."),
                Actions([LinkButton({ url: "https://app.cal.com/bookings", label: "View Bookings" })]),
              ],
            })
          );
          return;
        }
        await setRescheduleFlow(ctx.teamId, ctx.userId, {
          bookingUid: JSON.stringify(
            bookings.map((b) => ({
              uid: b.uid, title: b.title, start: b.start, end: b.end,
              eventTypeId: b.eventType?.id ?? 0,
              eventTypeSlug: b.eventType?.slug ?? "",
            }))
          ),
          bookingTitle: "",
          originalStart: "",
          eventTypeId: 0,
          step: "awaiting_slot",
        });
        await thread.post(
          Card({
            title: "Reschedule a Booking",
            subtitle: "Select a booking to reschedule",
            children: bookings.map((b, i) => {
              const time = formatBookingTime(b.start, b.end);
              return Actions([Button({ id: `tg_resched_bk_${i}`, label: `${b.title} \u2014 ${time}` })]);
            }),
          })
        );
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
  async function requireAuthForAction(
    thread: { post: (msg: string) => Promise<unknown> },
    teamId: string,
    userId: string
  ): Promise<{ accessToken: string; linked: NonNullable<Awaited<ReturnType<typeof getLinkedUser>>> } | null> {
    const accessToken = await getValidAccessToken(teamId, userId);
    if (!accessToken) {
      await thread.post("Your Cal.com session has expired. Please reconnect with /link and try again.");
      return null;
    }
    const linked = await getLinkedUser(teamId, userId);
    if (!linked) {
      await thread.post("Your Cal.com account is not connected. Use /link to connect.");
      return null;
    }
    return { accessToken, linked };
  }

  bot.onNewMessage(TELEGRAM_COMMAND_RE, async (thread, message) => {
    await handleTelegramCommand(thread, message, deps);
  });

  bot.onNewMessage(/^\/.+/, async (thread, message) => {
    if (thread.adapter.name !== "telegram") return;
    if (message.author.isBot || message.author.isMe) return;
    const ctx = deps.extractContext(thread, message);
    const isGroup = thread.id !== `telegram:${ctx.userId}`;
    if (isGroup) return;
    const text = message.text.trim();
    if (TELEGRAM_COMMAND_RE.test(text)) return;
    await thread.post("Unknown command. Use /help to see available commands.");
  });

  for (let i = 0; i < 20; i++) {
    bot.onAction(`tg_book_et_${i}`, async (event) => {
      if (event.adapter.name !== "telegram") return;
      if (!event.thread) return;
      const thread = event.thread;
      const ctx = deps.extractContext(
        { adapter: event.adapter },
        { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
      );
      await deps.withBotErrorHandling(
        async () => {
          const flow = await getBookingFlow(ctx.teamId, ctx.userId);
          if (!flow?.targetUsername) {
            await thread.post("Booking session expired. Please start again with /book.");
            return;
          }
          const targetEventTypes = await getEventTypesByUsername(flow.targetUsername);
          const selected = targetEventTypes[i];
          if (!selected) {
            await thread.post("Event type not found. Please try again.");
            return;
          }
          const auth = await requireAuthForAction(thread, ctx.teamId, ctx.userId);
          if (!auth) return;
          const { linked } = auth;
          const now = new Date();
          const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const slotsMap = await getAvailableSlotsPublic({
            eventTypeSlug: selected.slug,
            username: flow.targetUsername,
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
              label: formatSlotLabel(s.time, linked.calcomTimeZone),
            }));
          if (allSlots.length === 0) {
            await thread.post(`No available slots for **${selected.title}** in the next 7 days.`);
            await clearBookingFlow(ctx.teamId, ctx.userId);
            return;
          }
          await setBookingFlow(ctx.teamId, ctx.userId, {
            ...flow,
            eventTypeId: selected.id,
            eventTypeTitle: selected.title,
            eventTypeSlug: selected.slug,
            step: "awaiting_slot",
            slots: allSlots,
          });
          await thread.post(telegramSlotPickerCard(allSlots, selected.title));
        },
        {
          postError: (msg) => thread.post(msg).catch(() => {}),
          logContext: "tg_book_et action",
        }
      );
    });
  }

  for (let i = 0; i < 5; i++) {
    bot.onAction(`tg_book_slot_${i}`, async (event) => {
      if (event.adapter.name !== "telegram") return;
      if (!event.thread) return;
      const thread = event.thread;
      const ctx = deps.extractContext(
        { adapter: event.adapter },
        { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
      );
      await deps.withBotErrorHandling(
        async () => {
          const flow = await getBookingFlow(ctx.teamId, ctx.userId);
          if (!flow?.slots?.[i]) {
            await thread.post("Booking session expired. Please start again with /book.");
            return;
          }
          const slot = flow.slots[i];
          await setBookingFlow(ctx.teamId, ctx.userId, {
            ...flow,
            selectedSlot: slot.time,
            step: "awaiting_confirmation",
          });
          await thread.post(
            telegramBookingConfirmCard(
              flow.eventTypeTitle,
              slot.label,
              flow.targetUsername ?? flow.targetName ?? "Attendee"
            )
          );
        },
        {
          postError: (msg) => thread.post(msg).catch(() => {}),
          logContext: "tg_book_slot action",
        }
      );
    });
  }

  bot.onAction("tg_book_confirm", async (event) => {
    if (event.adapter.name !== "telegram") return;
    if (!event.thread) return;
    const thread = event.thread;
    const ctx = deps.extractContext(
      { adapter: event.adapter },
      { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
    );
    await deps.withBotErrorHandling(
      async () => {
        const flow = await getBookingFlow(ctx.teamId, ctx.userId);
        if (!flow?.selectedSlot) {
          await thread.post("Booking session expired. Please start again with /book.");
          return;
        }
        const linked = await getLinkedUser(ctx.teamId, ctx.userId);
        if (!linked) {
          await thread.post("Your Cal.com account is not connected. Use /link to connect.");
          return;
        }
        if (flow.isPublicBooking && flow.eventTypeSlug && flow.targetUsername) {
          const booking = await createBookingPublic({
            eventTypeSlug: flow.eventTypeSlug,
            username: flow.targetUsername,
            start: flow.selectedSlot,
            attendee: {
              name: linked.calcomUsername,
              email: linked.calcomEmail,
              timeZone: linked.calcomTimeZone,
            },
          });
          const time = formatBookingTime(booking.start, booking.end, linked.calcomTimeZone);
          await thread.post(
            Card({
              title: "Booking Confirmed!",
              children: [
                CardText(`**${booking.title}**\n${time}`),
                ...(booking.meetingUrl
                  ? [Actions([LinkButton({ url: booking.meetingUrl, label: "Join Meeting" })])]
                  : []),
              ],
            })
          );
        } else {
          await thread.post("Booking could not be completed — missing booking details. Please start again with /book.");
        }
        await clearBookingFlow(ctx.teamId, ctx.userId);
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "tg_book_confirm action",
      }
    );
  });

  bot.onAction("tg_book_cancel", async (event) => {
    if (event.adapter.name !== "telegram") return;
    if (!event.thread) return;
    const thread = event.thread;
    const ctx = deps.extractContext(
      { adapter: event.adapter },
      { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
    );
    await clearBookingFlow(ctx.teamId, ctx.userId);
    await thread.post("Booking cancelled.");
  });

  for (let i = 0; i < 10; i++) {
    bot.onAction(`tg_cancel_bk_${i}`, async (event) => {
      if (event.adapter.name !== "telegram") return;
      if (!event.thread) return;
      const thread = event.thread;
      const ctx = deps.extractContext(
        { adapter: event.adapter },
        { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
      );
      await deps.withBotErrorHandling(
        async () => {
          const flow = await getCancelFlow(ctx.teamId, ctx.userId);
          if (!flow) {
            await thread.post("Cancel session expired. Please start again with /cancel.");
            return;
          }
          let bookings: Array<{ uid: string; title: string; start: string; end: string; isRecurring: boolean }>;
          try {
            bookings = JSON.parse(flow.bookingUid);
          } catch {
            await thread.post("Cancel session expired. Please start again with /cancel.");
            return;
          }
          const selected = bookings[i];
          if (!selected) {
            await thread.post("Booking not found. Please try again.");
            return;
          }
          await setCancelFlow(ctx.teamId, ctx.userId, {
            bookingUid: selected.uid,
            bookingTitle: selected.title,
            isRecurring: selected.isRecurring,
            step: "awaiting_confirmation",
          });
          const time = formatBookingTime(selected.start, selected.end);
          await thread.post(cancelConfirmCard(selected.title, time, selected.isRecurring));
        },
        {
          postError: (msg) => thread.post(msg).catch(() => {}),
          logContext: "tg_cancel_bk action",
        }
      );
    });
  }

  bot.onAction("cancel_confirm", async (event) => {
    if (event.adapter.name !== "telegram") return;
    if (!event.thread) return;
    const thread = event.thread;
    const ctx = deps.extractContext(
      { adapter: event.adapter },
      { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
    );
    await deps.withBotErrorHandling(
      async () => {
        const flow = await getCancelFlow(ctx.teamId, ctx.userId);
        if (!flow || !flow.bookingUid || flow.bookingUid.startsWith("[")) {
          await thread.post("Cancel session expired. Please start again with /cancel.");
          return;
        }
        const accessToken = await getValidAccessToken(ctx.teamId, ctx.userId);
        if (!accessToken) {
          await thread.post("Your Cal.com session has expired. Please reconnect with /link and try again.");
          return;
        }
        await cancelBooking(accessToken, flow.bookingUid, "Cancelled via Telegram bot");
        await clearCancelFlow(ctx.teamId, ctx.userId);
        await thread.post(`Booking **${flow.bookingTitle}** has been cancelled.`);
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "cancel_confirm action",
      }
    );
  });

  bot.onAction("cancel_all", async (event) => {
    if (event.adapter.name !== "telegram") return;
    if (!event.thread) return;
    const thread = event.thread;
    const ctx = deps.extractContext(
      { adapter: event.adapter },
      { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
    );
    await deps.withBotErrorHandling(
      async () => {
        const flow = await getCancelFlow(ctx.teamId, ctx.userId);
        if (!flow || !flow.bookingUid || flow.bookingUid.startsWith("[")) {
          await thread.post("Cancel session expired. Please start again with /cancel.");
          return;
        }
        const accessToken = await getValidAccessToken(ctx.teamId, ctx.userId);
        if (!accessToken) {
          await thread.post("Your Cal.com session has expired. Please reconnect with /link and try again.");
          return;
        }
        await cancelBooking(accessToken, flow.bookingUid, "Cancelled via Telegram bot", true);
        await clearCancelFlow(ctx.teamId, ctx.userId);
        await thread.post(`Booking **${flow.bookingTitle}** and all future occurrences have been cancelled.`);
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "cancel_all action",
      }
    );
  });

  bot.onAction("cancel_back", async (event) => {
    if (event.adapter.name !== "telegram") return;
    if (!event.thread) return;
    const thread = event.thread;
    const ctx = deps.extractContext(
      { adapter: event.adapter },
      { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
    );
    await clearCancelFlow(ctx.teamId, ctx.userId);
    await thread.post("Cancellation aborted.");
  });

  for (let i = 0; i < 10; i++) {
    bot.onAction(`tg_resched_bk_${i}`, async (event) => {
      if (event.adapter.name !== "telegram") return;
      if (!event.thread) return;
      const thread = event.thread;
      const ctx = deps.extractContext(
        { adapter: event.adapter },
        { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
      );
      await deps.withBotErrorHandling(
        async () => {
          const flow = await getRescheduleFlow(ctx.teamId, ctx.userId);
          if (!flow) {
            await thread.post("Reschedule session expired. Please start again with /reschedule.");
            return;
          }
          let bookings: Array<{ uid: string; title: string; start: string; end: string; eventTypeId: number; eventTypeSlug?: string }>;
          try {
            bookings = JSON.parse(flow.bookingUid);
          } catch {
            await thread.post("Reschedule session expired. Please start again with /reschedule.");
            return;
          }
          const selected = bookings[i];
          if (!selected) {
            await thread.post("Booking not found. Please try again.");
            return;
          }
          const auth = await requireAuthForAction(thread, ctx.teamId, ctx.userId);
          if (!auth) return;
          const { linked } = auth;
          const eventTypeSlug = selected.eventTypeSlug;
          if (!eventTypeSlug) {
            await thread.post("Cannot reschedule: event type information is missing for this booking.");
            await clearRescheduleFlow(ctx.teamId, ctx.userId);
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
              label: formatSlotLabel(s.time, linked.calcomTimeZone),
            }));
          if (allSlots.length === 0) {
            await thread.post("No available slots in the next 7 days. Please try again later.");
            await clearRescheduleFlow(ctx.teamId, ctx.userId);
            return;
          }
          await setRescheduleFlow(ctx.teamId, ctx.userId, {
            bookingUid: selected.uid,
            bookingTitle: selected.title,
            originalStart: selected.start,
            eventTypeId: selected.eventTypeId,
            step: "awaiting_slot",
            slots: allSlots,
          });
          const originalTime = formatBookingTime(selected.start, selected.end);
          await thread.post(
            Card({
              title: "Pick a New Time",
              subtitle: selected.title,
              children: [
                CardText(`Currently: ${originalTime}`),
                ...allSlots.map((s, slotIdx) =>
                  Actions([Button({ id: `tg_resched_slot_${slotIdx}`, label: s.label })])
                ),
                Actions([Button({ id: "tg_resched_cancel", style: "danger" as const, label: "Cancel" })]),
              ],
            })
          );
        },
        {
          postError: (msg) => thread.post(msg).catch(() => {}),
          logContext: "tg_resched_bk action",
        }
      );
    });
  }

  for (let i = 0; i < 5; i++) {
    bot.onAction(`tg_resched_slot_${i}`, async (event) => {
      if (event.adapter.name !== "telegram") return;
      if (!event.thread) return;
      const thread = event.thread;
      const ctx = deps.extractContext(
        { adapter: event.adapter },
        { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
      );
      await deps.withBotErrorHandling(
        async () => {
          const flow = await getRescheduleFlow(ctx.teamId, ctx.userId);
          if (!flow?.slots?.[i]) {
            await thread.post("Reschedule session expired. Please start again with /reschedule.");
            return;
          }
          const slot = flow.slots[i];
          await setRescheduleFlow(ctx.teamId, ctx.userId, {
            ...flow,
            selectedSlot: slot.time,
            step: "awaiting_confirmation",
          });
          const linked = await getLinkedUser(ctx.teamId, ctx.userId);
          const tz = linked?.calcomTimeZone ?? "UTC";
          const oldTime = formatSlotLabel(flow.originalStart, tz);
          const newTime = slot.label;
          await thread.post(rescheduleConfirmCard(flow.bookingTitle, oldTime, newTime));
        },
        {
          postError: (msg) => thread.post(msg).catch(() => {}),
          logContext: "tg_resched_slot action",
        }
      );
    });
  }

  bot.onAction("reschedule_confirm", async (event) => {
    if (event.adapter.name !== "telegram") return;
    if (!event.thread) return;
    const thread = event.thread;
    const ctx = deps.extractContext(
      { adapter: event.adapter },
      { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
    );
    await deps.withBotErrorHandling(
      async () => {
        const flow = await getRescheduleFlow(ctx.teamId, ctx.userId);
        if (!flow?.selectedSlot) {
          await thread.post("Reschedule session expired. Please start again with /reschedule.");
          return;
        }
        const accessToken = await getValidAccessToken(ctx.teamId, ctx.userId);
        if (!accessToken) {
          await thread.post("Your Cal.com session has expired. Please reconnect with /link and try again.");
          return;
        }
        const booking = await rescheduleBooking(
          accessToken,
          flow.bookingUid,
          flow.selectedSlot,
          "Rescheduled via Telegram bot"
        );
        const linked = await getLinkedUser(ctx.teamId, ctx.userId);
        const tz = linked?.calcomTimeZone ?? "UTC";
        const newTime = formatBookingTime(booking.start, booking.end, tz);
        await clearRescheduleFlow(ctx.teamId, ctx.userId);
        await thread.post(`Booking **${flow.bookingTitle}** rescheduled to ${newTime}.`);
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "reschedule_confirm action",
      }
    );
  });

  bot.onAction("reschedule_back", async (event) => {
    if (event.adapter.name !== "telegram") return;
    if (!event.thread) return;
    const thread = event.thread;
    const ctx = deps.extractContext(
      { adapter: event.adapter },
      { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
    );
    await clearRescheduleFlow(ctx.teamId, ctx.userId);
    await thread.post("Reschedule cancelled.");
  });

  bot.onAction("tg_resched_cancel", async (event) => {
    if (event.adapter.name !== "telegram") return;
    if (!event.thread) return;
    const thread = event.thread;
    const ctx = deps.extractContext(
      { adapter: event.adapter },
      { author: event.user, raw: event.raw } as { author: { userId: string }; raw: unknown }
    );
    await clearRescheduleFlow(ctx.teamId, ctx.userId);
    await thread.post("Reschedule cancelled.");
  });
}
