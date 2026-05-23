import type { ChatElement } from "chat";
import { bot, slackAdapter } from "@/lib/bot";
import { getLogger } from "@/lib/logger";
import type { DeliverResult } from "./types";

const logger = getLogger("deliver-slack");

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
    logger.warn("No installation found", { identifier, teamId });
    return { identifier, success: false, invalidIdentifier: true, error: "no_installation" };
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
        logger.warn("Invalid Slack identifier", { identifier, teamId, slackError });
        return { identifier, success: false, invalidIdentifier: true, error: slackError };
      }
      logger.error("Slack API error", { identifier, teamId, slackError });
      return { identifier, success: false, error: slackError || "slack_api_error" };
    }
    logger.error("Unexpected Slack delivery error", { identifier, teamId, error: String(err) });
    return { identifier, success: false, error: String(err) };
  }
}
