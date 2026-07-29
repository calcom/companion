import type { Logger } from "chat";
import { CalcomApiError, checkCredits } from "./calcom/client";

export interface AgentCreditContext {
  platform: string;
  teamId: string;
  userId: string;
}

interface RequireAgentCreditsParams {
  accessToken: string;
  ctx: AgentCreditContext;
  logger: Logger;
  gateName: string;
  postNoCredits: (message: string) => Promise<unknown>;
}

export type AgentCreditsBlockReason =
  | "no_credits"
  | "scope_upgrade_required"
  | "verification_failed";

export function getAgentCreditBlockReason(error: unknown): AgentCreditsBlockReason {
  if (
    error instanceof CalcomApiError &&
    error.statusCode === 403 &&
    error.message.includes("insufficient_scope") &&
    error.message.includes("CREDITS_READ")
  ) {
    return "scope_upgrade_required";
  }

  return "verification_failed";
}

export function agentNoCreditsMessage(platform: string, reason: AgentCreditsBlockReason): string {
  if (reason === "no_credits") {
    return platform === "slack"
      ? "You don't have AI credits available right now. Use `/cal help` to see the regular slash commands you can still use."
      : "You don't have AI credits available right now. Use /help to see the regular commands you can still use.";
  }

  if (reason === "scope_upgrade_required") {
    return platform === "slack"
      ? "To use AI features, reconnect your Cal.com account by running `/cal unlink`, then `/cal link`."
      : "To use AI features, reconnect your Cal.com account by running /unlink, then /link.";
  }

  return platform === "slack"
    ? "The AI assistant isn't available right now because we couldn't verify available AI credits for your account. Use `/cal help` to see the regular slash commands you can still use."
    : "The AI assistant isn't available right now because we couldn't verify available AI credits for your account. Use /help to see the regular commands you can still use.";
}

/**
 * AI-cost gates must fail closed. If Cal.com cannot confirm available credits,
 * do not start an LLM request.
 */
export async function requireAgentCredits({
  accessToken,
  ctx,
  logger,
  gateName,
  postNoCredits,
}: RequireAgentCreditsParams): Promise<boolean> {
  logger.info("Checking agent credits", {
    gateName,
    platform: ctx.platform,
    teamId: ctx.teamId,
    userId: ctx.userId,
  });

  try {
    const credits = await checkCredits(accessToken);
    const monthlyRemaining = credits.balance.monthlyRemaining;
    const additional = credits.balance.additional;

    logger.info("Agent credits check result", {
      gateName,
      platform: ctx.platform,
      teamId: ctx.teamId,
      userId: ctx.userId,
      hasCredits: credits.hasCredits,
      monthlyRemaining,
      additional,
    });

    if (!credits.hasCredits) {
      logger.info("Agentic blocked - no credits", {
        gateName,
        platform: ctx.platform,
        teamId: ctx.teamId,
        userId: ctx.userId,
        monthlyRemaining,
        additional,
      });
      await postNoCredits(agentNoCreditsMessage(ctx.platform, "no_credits"));
      return false;
    }

    if (monthlyRemaining + additional <= 0) {
      logger.warn("Agent credits response has no visible balance but allows usage", {
        gateName,
        platform: ctx.platform,
        teamId: ctx.teamId,
        userId: ctx.userId,
        monthlyRemaining,
        additional,
      });
    }

    return true;
  } catch (err) {
    logger.warn("Agent credits check failed, blocking request", {
      gateName,
      platform: ctx.platform,
      teamId: ctx.teamId,
      userId: ctx.userId,
      error: String(err),
      statusCode: err instanceof CalcomApiError ? err.statusCode : undefined,
      code: err instanceof CalcomApiError ? err.code : undefined,
    });
    await postNoCredits(agentNoCreditsMessage(ctx.platform, getAgentCreditBlockReason(err)));
    return false;
  }
}
