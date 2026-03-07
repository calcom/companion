import { slackAdapter } from "@/lib/bot";
import { parseCalcomWebhook, verifyCalcomWebhook } from "@/lib/calcom/webhooks";
import {
  bookingCancelledCard,
  bookingConfirmedCard,
  bookingCreatedCard,
  bookingReminderCard,
  bookingRescheduledCard,
} from "@/lib/notifications";
import type { CalcomWebhookMetadata } from "@/lib/calcom/types";
import { getLinkedUserByEmail, getWorkspaceNotificationConfig } from "@/lib/user-linking";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("X-Cal-Signature-256");
  const webhookSecret = process.env.CALCOM_WEBHOOK_SECRET;

  if (webhookSecret) {
    const valid = verifyCalcomWebhook(body, signature, webhookSecret);
    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let webhook;
  try {
    webhook = parseCalcomWebhook(body);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  const metadata = webhook.payload.metadata as CalcomWebhookMetadata | undefined;
  const teamId = metadata?.slack_team_id;
  const slackUserId = metadata?.slack_user_id;
  let telegramChatId = metadata?.telegram_chat_id;

  if (!telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
    const linkedByEmail = await getLinkedUserByEmail(webhook.payload.organizer.email);
    if (linkedByEmail?.teamId === "telegram") {
      telegramChatId = linkedByEmail.userId;
    }
  }

  const workspaceConfig = teamId ? await getWorkspaceNotificationConfig(teamId) : null;
  const hasSlackTarget = teamId && (slackUserId || workspaceConfig?.defaultChannelId);
  const hasTelegramTarget = telegramChatId && process.env.TELEGRAM_BOT_TOKEN;

  if (!hasSlackTarget && !hasTelegramTarget) {
    return new Response("OK", { status: 200 });
  }
  const shouldNotify = (event: string) => {
    if (!workspaceConfig) return true;
    if (event === "BOOKING_CREATED") return workspaceConfig.notifyOnBookingCreated;
    if (event === "BOOKING_CANCELLED") return workspaceConfig.notifyOnBookingCancelled;
    if (event === "BOOKING_RESCHEDULED") return workspaceConfig.notifyOnBookingRescheduled;
    return true;
  };

  if (!shouldNotify(webhook.triggerEvent)) {
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

  if (hasSlackTarget && teamId) {
    const targetChannelId = workspaceConfig?.defaultChannelId ?? null;
    // Channel ID format: Slack channel ID (C...) or user ID (U...) for DMs
    const channelId = targetChannelId ?? slackUserId!;
    const installation = await slackAdapter.getInstallation(teamId);
    if (installation) {
      try {
        await slackAdapter.withBotToken(installation.botToken, async () => {
          const channel = bot.channel(`slack:${channelId}`);
          await channel.post(card);
        });
      } catch (err) {
        console.error("Failed to send Cal.com notification to Slack:", err);
      }
    }
  }

  if (hasTelegramTarget && telegramChatId) {
    try {
      // Channel ID format: Telegram chat ID (numeric)
      const channel = bot.channel(`telegram:${telegramChatId}`);
      await channel.post(card);
    } catch (err) {
      console.error("Failed to send Cal.com notification to Telegram:", err);
    }
  }

  return new Response("OK", { status: 200 });
}
