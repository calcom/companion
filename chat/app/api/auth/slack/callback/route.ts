import { bot, slackAdapter } from "@/lib/bot";
import { getLogger } from "@/lib/logger";

const logger = getLogger("slack-auth");
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");

  if (error) {
    redirect(`/?error=${encodeURIComponent(error)}`);
  }

  try {
    await bot.initialize();
    const { teamId } = await slackAdapter.handleOAuthCallback(request);
    logger.info("Slack app installed", { teamId });
    redirect(`/?installed=true&team=${teamId}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Slack OAuth callback error", { err });
    redirect(`/?error=${encodeURIComponent(message)}`);
  }
}
