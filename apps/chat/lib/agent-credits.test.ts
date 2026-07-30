import { strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { CalcomApiError } from "./calcom/client";
import {
  agentNoCreditsMessage,
  getAgentCreditBlockReason,
  shouldShowLowCreditWarning,
} from "./agent-credits";

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

describe("shouldShowLowCreditWarning", () => {
  it("shows the warning only for credit-based users with a low balance", () => {
    const zeroBalance = { monthlyRemaining: 0, additional: 0 };

    strictEqual(
      shouldShowLowCreditWarning(
        { calcomOrganizationId: 42, calcomOrgIsPlatform: false },
        zeroBalance
      ),
      false
    );
    strictEqual(
      shouldShowLowCreditWarning(
        { calcomOrganizationId: null, calcomOrgIsPlatform: null },
        zeroBalance
      ),
      true
    );
    strictEqual(
      shouldShowLowCreditWarning(
        { calcomOrganizationId: 42, calcomOrgIsPlatform: true },
        zeroBalance
      ),
      true
    );
    strictEqual(
      shouldShowLowCreditWarning(
        { calcomOrganizationId: 42, calcomOrgIsPlatform: null },
        zeroBalance
      ),
      true
    );
    strictEqual(
      shouldShowLowCreditWarning(
        { calcomOrganizationId: null, calcomOrgIsPlatform: null },
        { monthlyRemaining: 10, additional: 0 }
      ),
      false
    );
  });
});
