import { NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";

const logger = getLogger("calcom-auth");

import { exchangeCodeForTokens, verifyState } from "@/lib/calcom/oauth";
import type { LinkedUser } from "@/lib/user-linking";
import { linkUser } from "@/lib/user-linking";

const CALCOM_API_URL = process.env.CALCOM_API_URL ?? "https://api.cal.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

interface CalcomMe {
  id: number;
  username: string;
  email: string;
  name: string;
  timeZone: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const desc = url.searchParams.get("error_description") ?? error;
    return redirectWithError(`Authorization denied: ${desc}`);
  }

  if (!code || !state) {
    return redirectWithError("Missing authorization code or state parameter.");
  }

  const payload = verifyState(state);
  if (!payload) {
    return redirectWithError("Invalid or expired authorization link. Please try /cal link again.");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const meRes = await fetch(`${CALCOM_API_URL}/v2/me`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "cal-api-version": "2024-08-13",
      },
    });

    if (!meRes.ok) {
      throw new Error(`Failed to fetch Cal.com profile (${meRes.status})`);
    }

    const meBody = (await meRes.json()) as { status: string; data: CalcomMe };
    const me = meBody.data;

    const linkedUser: LinkedUser = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      calcomUserId: me.id,
      calcomEmail: me.email,
      calcomUsername: me.username,
      calcomTimeZone: me.timeZone,
      linkedAt: new Date().toISOString(),
    };

    await linkUser(payload.teamId, payload.userId, linkedUser);

    logger.info("Cal.com account linked", {
      teamId: payload.teamId,
      userId: payload.userId,
      platform: payload.platform,
      calcomEmail: me.email,
    });

    return redirectWithSuccess(me.name, me.email, payload.teamId, payload.platform);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during authorization.";
    logger.error("Cal.com OAuth callback error", { err });
    // payload is in scope here — pass platform/teamId so the complete page shows correct retry instructions.
    return redirectWithError(message, payload.platform, payload.teamId);
  }
}

function redirectWithSuccess(name: string, email: string, teamId: string, platform: string) {
  const params = new URLSearchParams({
    calcom_linked: `Connected as ${name} (${email}).`,
    team: teamId,
    platform,
  });
  if (platform === "telegram" && process.env.TELEGRAM_BOT_USERNAME) {
    params.set("telegram_bot", process.env.TELEGRAM_BOT_USERNAME);
  }
  return NextResponse.redirect(`${APP_URL}/auth/calcom/complete?${params}`);
}

function redirectWithError(message: string, platform?: string, teamId?: string) {
  const params = new URLSearchParams({ error: message });
  if (platform) params.set("platform", platform);
  if (teamId) params.set("team", teamId);
  return NextResponse.redirect(`${APP_URL}/auth/calcom/complete?${params}`);
}
