import { slackAdapter } from "@/lib/bot";
import { parseCalcomWebhook, verifyCalcomWebhook } from "@/lib/calcom/webhooks";
import {
  bookingCancelledCard,
  bookingConfirmedCard,
  bookingCreatedCard,
  bookingReminderCard,
  bookingRescheduledCard,
} from "@/lib/notifications";
import { getLinkedUser, getWorkspaceNotificationConfig } from "@/lib/user-linking";

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

  // The Cal.com webhook payload includes the organizer's email.
  // We look up which Slack user/team is linked to that email, then
  // post the notification card in their DM (or configured channel).
  const organizerEmail = webhook.payload.organizer.email;

  // Try to find a Slack user linked to this Cal.com email across all teams.
  // In production, Cal.com would include a teamId or external identifier.
  // For now we use the metadata field to carry the Slack team_id.
  const metadata = webhook.payload.metadata as Record<string, string> | undefined;
  const teamId = metadata?.slack_team_id;

  if (!teamId) {
    // Without team context we can't route the notification.
    // This is expected when Cal.com webhooks aren't configured with metadata.
    return new Response("OK", { status: 200 });
  }

  const workspaceConfig = await getWorkspaceNotificationConfig(teamId);

  // Determine the target: DM to the organizer, or a configured channel.
  let targetChannelId: string | null = workspaceConfig?.defaultChannelId ?? null;

  // Try to find the Slack user for this organizer email via linked accounts.
  // We can't enumerate Redis keys here without a secondary index, so we rely on
  // the webhook metadata carrying the Slack user ID.
  const slackUserId = metadata?.slack_user_id;
  if (!targetChannelId && !slackUserId) {
    return new Response("OK", { status: 200 });
  }

  const installation = await slackAdapter.getInstallation(teamId);
  if (!installation) {
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

  try {
    await slackAdapter.withBotToken(installation.botToken, async () => {
      const { bot } = await import("@/lib/bot");
      // Post to DM channel if we have a user ID, otherwise to the configured channel
      const channelId = targetChannelId ?? slackUserId!;
      const channel = bot.channel(`slack:${channelId}`);
      await channel.post(card);
    });
  } catch (err) {
    console.error("Failed to send Cal.com notification to Slack:", err);
  }

  return new Response("OK", { status: 200 });
}
