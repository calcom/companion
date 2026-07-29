import { strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { CalcomApiError } from "./calcom/client";
import { agentNoCreditsMessage, getAgentCreditBlockReason } from "./agent-credits";

describe("agent credit errors", () => {
  it("asks Slack users to reconnect when the credit check lacks CREDITS_READ", () => {
    const error = new CalcomApiError(
      "insufficient_scope: token does not have the required scopes. Required: CREDITS_READ.",
      403
    );

    const reason = getAgentCreditBlockReason(error);

    strictEqual(reason, "scope_upgrade_required");
    strictEqual(
      agentNoCreditsMessage("slack", reason),
      "To use AI features, reconnect your Cal.com account by running `/cal unlink`, then `/cal link`."
    );
  });

  it("keeps other credit-check failures on the generic verification path", () => {
    const error = new CalcomApiError("Service unavailable", 503);

    strictEqual(getAgentCreditBlockReason(error), "verification_failed");
  });
});
