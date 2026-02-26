import { bot, slackAdapter } from "@/lib/bot";
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
    redirect(`/?installed=true&team=${teamId}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Slack OAuth callback error:", err);
    redirect(`/?error=${encodeURIComponent(message)}`);
  }
}
