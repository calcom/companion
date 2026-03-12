import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

const SLACK_OAUTH_STATE_COOKIE = "slack_oauth_state";
const STATE_TTL_SECONDS = 600; // 10 minutes — enough for a user to complete the flow

export async function GET(request: Request) {
  const state = randomUUID();

  const scopes = [
    "app_mentions:read",
    "assistant:write",
    "channels:history",
    "channels:join",
    "channels:read",
    "chat:write",
    "chat:write.public",
    "commands",
    "groups:history",
    "groups:read",
    "im:history",
    "im:read",
    "im:write",
    "mpim:history",
    "mpim:read",
    "reactions:read",
    "reactions:write",
    "users:read",
    "users:read.email",
  ].join(",");

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Slack app is not configured. SLACK_CLIENT_ID is missing." },
      { status: 500 }
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/+$/, "");
  const redirectUri = `${appUrl}/api/auth/slack/callback`;

  const slackUrl = new URL("https://slack.com/oauth/v2/authorize");
  slackUrl.searchParams.set("client_id", clientId);
  slackUrl.searchParams.set("scope", scopes);
  slackUrl.searchParams.set("redirect_uri", redirectUri);
  slackUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(slackUrl.toString());
  response.cookies.set(SLACK_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_TTL_SECONDS,
    path: "/",
  });

  return response;
}
