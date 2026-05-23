import type { ChatElement } from "chat";
import { bot, slackAdapter } from "@/lib/bot";
import type { DeliverResult } from "./types";

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
    if (
      err instanceof Error &&
      "code" in err &&
      (err as Record<string, unknown>).code === "slack_webapi_platform_error"
    ) {
      const data = (err as Record<string, unknown>).data as Record<string, unknown> | undefined;
      const slackError = typeof data?.error === "string" ? data.error : "";
      if (INVALID_SLACK_ERROR_CODES.has(slackError)) {
        return { identifier, success: false, invalidIdentifier: true };
      }
    }
    return { identifier, success: false };
  }
}
