import { isRedirectError } from "next/dist/client/components/redirect-error";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { bot, slackAdapter } from "@/lib/bot";
import { getLogger } from "@/lib/logger";

const logger = getLogger("slack-auth");

const SLACK_OAUTH_STATE_COOKIE = "slack_oauth_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");

  if (error) {
    redirect(`/?error=${encodeURIComponent(error)}`);
  }

  // CSRF protection: verify the state param matches the cookie stamped during install redirect.
  const stateParam = url.searchParams.get("state");
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(SLACK_OAUTH_STATE_COOKIE)?.value;

  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    logger.warn("Slack OAuth state mismatch — possible CSRF attempt");
    redirect(
      `/?error=${encodeURIComponent("Invalid state parameter. Please try installing again.")}`
    );
  }

  // State is consumed — delete the cookie so it can't be replayed.
  cookieStore.delete(SLACK_OAUTH_STATE_COOKIE);

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
