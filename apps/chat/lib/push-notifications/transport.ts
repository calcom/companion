import type { Platform, ProviderDeliveryResult, Subscription } from "./contract";
import { deliverSlackNotification } from "./deliver-slack";
import { deliverTelegramNotification } from "./deliver-telegram";
import type { FormattedNotification } from "./formatter";
import { getNotificationSlackToken } from "./slack-installation";

type NotificationSender = (message: FormattedNotification) => Promise<ProviderDeliveryResult>;

export async function prepareTransport(
  platform: Platform,
  subscription: Subscription
): Promise<NotificationSender | null> {
  if (platform === "SLACK") {
    if (!subscription.teamId) return null;
    const token = await getNotificationSlackToken(subscription.teamId);
    if (!token) return null;
    return (message) => deliverSlackNotification(token, subscription.identifier, message);
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return (message) => deliverTelegramNotification(token, subscription.identifier, message);
}
