import type { ChatElement } from "chat";
import { bot, slackAdapter } from "@/lib/bot";

export type DeliverResult = {
  identifier: string;
  success: boolean;
  invalidIdentifier?: boolean;
};

const INVALID_SLACK_ERROR_CODES = new Set([
  "channel_not_found",
  "not_in_channel",
  "account_inactive",
]);

export async function deliverSlack(
  identifier: string,
  teamId: string,
  card: ChatElement
): Promise<DeliverResult> {
  const installation = await slackAdapter.getInstallation(teamId);
  if (!installation) {
    return { identifier, success: false, invalidIdentifier: true };
  }

  try {
    await slackAdapter.withBotToken(installation.botToken, async () => {
      await bot.channel(`slack:${identifier}`).post(card);
    });
    return { identifier, success: true };
  } catch (err) {
    const msg = String(err).toLowerCase();
    const isInvalid = [...INVALID_SLACK_ERROR_CODES].some((code) => msg.includes(code));
    if (isInvalid) {
      return { identifier, success: false, invalidIdentifier: true };
    }
    return { identifier, success: false };
  }
}
