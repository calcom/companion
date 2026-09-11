import { disableChatSubscription, enableChatSubscription } from "../calcom/chat-subscriptions";
import { getLinkedUser, getValidAccessToken } from "../user-linking";
import type { Platform } from "./contract";
import { activateBinding, beginBinding } from "./store";

const dependencies = {
  disableChatSubscription,
  enableChatSubscription,
  getLinkedUser,
  getValidAccessToken,
  activateBinding,
  beginBinding,
};

export async function handleNotifyCommand(
  input: {
    platform: Platform;
    identifier: string;
    teamId?: string;
    argument: string;
    privateChat: boolean;
  },
  deps = dependencies
): Promise<string> {
  const { platform, identifier, teamId, argument } = input;
  if (platform === "TELEGRAM" && !input.privateChat)
    return "Use /notify on or /notify off in a private chat with the bot.";
  if (argument !== "on" && argument !== "off")
    return `Use ${platform === "SLACK" ? "/cal notify" : "/notify"} on or off.`;
  if (
    (platform === "SLACK" &&
      (!/^T[A-Z0-9]+$/.test(teamId ?? "") || !/^[UW][A-Z0-9]+$/.test(identifier))) ||
    (platform === "TELEGRAM" && !/^[1-9]\d{0,15}$/.test(identifier))
  )
    return "Could not verify your chat identity.";
  if (platform === "TELEGRAM" && !process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN)
    return "Telegram notifications are not configured yet.";
  try {
    const linkingTeam = platform === "SLACK" ? (teamId ?? "") : "telegram";
    if (argument === "off") {
      await deps.beginBinding(
        platform,
        { identifier, teamId },
        {
          calcomUserId: 0,
          oauthLinkedAt: "",
          enabledAfter: 0,
          pending: false,
        }
      );
      const token = await deps.getValidAccessToken(linkingTeam, identifier);
      if (token) await deps.disableChatSubscription(token, platform, identifier, teamId);
      return "Booking notifications are off for this chat. Your event preferences are unchanged.";
    }
    const token = await deps.getValidAccessToken(linkingTeam, identifier);
    const linked = await deps.getLinkedUser(linkingTeam, identifier);
    if (!token || !linked)
      return `Connect your Cal.com account with ${platform === "SLACK" ? "/cal link" : "/link"} first.`;
    const attempt = await deps.beginBinding(
      platform,
      { identifier, teamId },
      {
        calcomUserId: linked.calcomUserId,
        oauthLinkedAt: linked.linkedAt,
        enabledAfter: Date.now(),
        pending: true,
      }
    );
    await deps.enableChatSubscription(token, platform, identifier, teamId);
    const current = await deps.getLinkedUser(linkingTeam, identifier);
    if (
      current?.calcomUserId !== linked.calcomUserId ||
      current.linkedAt !== linked.linkedAt ||
      !(await deps.activateBinding(attempt))
    ) {
      return "Your connection changed. Run the notify command again.";
    }
    return "Booking notifications are on for this chat, using your existing event preferences.";
  } catch {
    return "Could not update notifications. They may not be enabled for your account yet. Please try again.";
  }
}
