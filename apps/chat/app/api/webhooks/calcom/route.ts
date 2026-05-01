import { getSendblueAdapter, slackAdapter } from "@/lib/bot";
import type { CalcomWebhookMetadata } from "@/lib/calcom/types";
import { parseCalcomWebhook, verifyCalcomWebhook } from "@/lib/calcom/webhooks";
import { formatCalcomWebhookForSendblue } from "@/lib/format-for-sendblue";
import { getLogger } from "@/lib/logger";
import {
  bookingCancelledCard,
  bookingConfirmedCard,
  bookingCreatedCard,
  bookingReminderCard,
  bookingRescheduledCard,
} from "@/lib/notifications";
import { getLinkedUserByEmail, getWorkspaceNotificationConfig } from "@/lib/user-linking";

const logger = getLogger("calcom-webhook");

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("X-Cal-Signature-256");
  const webhookSecret = process.env.CALCOM_WEBHOOK_SECRET;

  if (webhookSecret) {
    const valid = verifyCalcomWebhook(body, signature, webhookSecret);
    if (!valid) {
      logger.warn("Cal.com webhook invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let webhook;
  try {
    webhook = parseCalcomWebhook(body);
  } catch {
    logger.warn("Cal.com webhook invalid payload");
    return new Response("Invalid payload", { status: 400 });
  }

  const metadata = webhook.payload.metadata as CalcomWebhookMetadata | undefined;
  const teamId = metadata?.slack_team_id;
  const slackUserId = metadata?.slack_user_id;
  let telegramChatId = metadata?.telegram_chat_id;
  let sendbluePhone = metadata?.sendblue_phone;
  const sendblueThreadId = metadata?.sendblue_thread_id;
  const hasExplicitRouting = !!(
    teamId ||
    slackUserId ||
    telegramChatId ||
    sendbluePhone ||
    sendblueThreadId
  );
  const needsLinkedUserRouting =
    !hasExplicitRouting &&
    ((!telegramChatId && !!process.env.TELEGRAM_BOT_TOKEN) ||
      (!sendbluePhone && !sendblueThreadId && !!process.env.SENDBLUE_API_KEY));

  if (needsLinkedUserRouting) {
    const linkedByEmail = await getLinkedUserByEmail(webhook.payload.organizer.email);
    if (!telegramChatId && linkedByEmail?.teamId === "telegram") {
      telegramChatId = linkedByEmail.userId;
    } else if (!sendbluePhone && !sendblueThreadId && linkedByEmail?.teamId === "sendblue") {
      sendbluePhone = linkedByEmail.userId;
    }
  }

  const sendblueAdapter = getSendblueAdapter();
  const workspaceConfig = teamId ? await getWorkspaceNotificationConfig(teamId) : null;
  const hasSlackTarget = !!(teamId && (slackUserId || workspaceConfig?.defaultChannelId));
  const hasTelegramTarget = !!(telegramChatId && process.env.TELEGRAM_BOT_TOKEN);
  const hasSendblueTarget = !!(sendblueAdapter && (sendbluePhone || sendblueThreadId));

  logger.info("Cal.com webhook", {
    event: webhook.triggerEvent,
    organizerEmail: webhook.payload.organizer.email,
    hasSlackTarget,
    hasTelegramTarget,
    hasSendblueTarget,
  });

  if (!hasSlackTarget && !hasTelegramTarget && !hasSendblueTarget) {
    logger.info("Cal.com webhook skipped", { reason: "no_target", event: webhook.triggerEvent });
    return new Response("OK", { status: 200 });
  }
  const shouldNotify = (event: string) => {
    if (!workspaceConfig) return true;
    if (event === "BOOKING_CREATED") return workspaceConfig.notifyOnBookingCreated;
    if (event === "BOOKING_CANCELLED") return workspaceConfig.notifyOnBookingCancelled;
    if (event === "BOOKING_RESCHEDULED") return workspaceConfig.notifyOnBookingRescheduled;
    return true;
  };

  const shouldNotifySlack = shouldNotify(webhook.triggerEvent);
  if (!shouldNotifySlack && !hasTelegramTarget && !hasSendblueTarget) {
    logger.info("Cal.com webhook skipped", {
      reason: "workspace_config",
      event: webhook.triggerEvent,
    });
    return new Response("OK", { status: 200 });
  }

  let card;
  switch (webhook.triggerEvent) {
    case "BOOKING_CREATED":
      card = bookingCreatedCard(webhook);
      break;
    case "BOOKING_RESCHEDULED":
      card = bookingRescheduledCard(webhook);
      break;
    case "BOOKING_CANCELLED":
      card = bookingCancelledCard(webhook);
      break;
    case "BOOKING_CONFIRMED":
      card = bookingConfirmedCard(webhook);
      break;
    case "BOOKING_REMINDER":
      card = bookingReminderCard(webhook);
      break;
    default:
      return new Response("OK", { status: 200 });
  }

  const { bot } = await import("@/lib/bot");

  if (hasSlackTarget && teamId && shouldNotifySlack) {
    const targetChannelId = workspaceConfig?.defaultChannelId ?? null;
    // Channel ID format: Slack channel ID (C...) or user ID (U...) for DMs
    const channelId = targetChannelId ?? slackUserId ?? "";
    const installation = await slackAdapter.getInstallation(teamId);
    if (installation) {
      try {
        await slackAdapter.withBotToken(installation.botToken, async () => {
          const channel = bot.channel(`slack:${channelId}`);
          await channel.post(card);
        });
        logger.info("Cal.com notification sent", {
          target: "slack",
          channelId,
          event: webhook.triggerEvent,
        });
      } catch (err) {
        logger.error("Cal.com notification failed", {
          err,
          target: "slack",
          channelId,
          event: webhook.triggerEvent,
        });
      }
    }
  }

  if (hasTelegramTarget && telegramChatId) {
    try {
      // Channel ID format: Telegram chat ID (numeric)
      const channel = bot.channel(`telegram:${telegramChatId}`);
      await channel.post(card);
      logger.info("Cal.com notification sent", {
        target: "telegram",
        chatId: telegramChatId,
        event: webhook.triggerEvent,
      });
    } catch (err) {
      logger.error("Cal.com notification failed", {
        err,
        target: "telegram",
        chatId: telegramChatId,
        event: webhook.triggerEvent,
      });
    }
  }

  if (hasSendblueTarget && sendblueAdapter) {
    try {
      const threadId =
        sendblueThreadId ||
        sendblueAdapter.encodeThreadId({
          fromNumber: process.env.SENDBLUE_FROM_NUMBER ?? "",
          contactNumber: sendbluePhone,
        });
      const channel = bot.channel(threadId);
      await channel.post(formatCalcomWebhookForSendblue(webhook));
      logger.info("Cal.com notification sent", {
        target: "sendblue",
        threadId,
        event: webhook.triggerEvent,
      });
    } catch (err) {
      logger.error("Cal.com notification failed", {
        err,
        target: "sendblue",
        phone: sendbluePhone,
        threadId: sendblueThreadId,
        event: webhook.triggerEvent,
      });
    }
  }

  return new Response("OK", { status: 200 });
}
