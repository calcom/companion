import { getLinkedUser } from "../user-linking";
import {
  type DeliveryRequest,
  type DeliveryResult,
  resultFor,
  type Subscription,
} from "./contract";
import { formatNotification } from "./formatter";
import { claimDelivery, finishDelivery, getBinding, isCurrentBinding } from "./store";
import { prepareTransport } from "./transport";

const dependencies = { getLinkedUser, getBinding, claimDelivery, finishDelivery, prepareTransport };

export async function deliverNotifications(
  request: DeliveryRequest,
  deps = dependencies
): Promise<DeliveryResult[]> {
  const age = Date.now() - Date.parse(request.occurredAt);
  if (age < -300_000 || age > 7 * 24 * 60 * 60 * 1000) {
    return request.subscriptions.map((sub) => resultFor(sub, "unknown"));
  }
  const message = formatNotification(request.payload);
  const deadline = Date.now() + 6000;
  const results: DeliveryResult[] = new Array(request.subscriptions.length);
  let next = 0;

  async function hasBinding(sub: Subscription) {
    const [binding, linked] = await Promise.all([
      deps.getBinding(request.platform, sub),
      deps.getLinkedUser(
        request.platform === "SLACK" ? (sub.teamId ?? "") : "telegram",
        sub.identifier
      ),
    ]);
    if (
      binding?.pending &&
      linked?.calcomUserId === sub.calcomUserId &&
      binding.oauthLinkedAt === linked.linkedAt
    )
      return "retryable" as const;
    return isCurrentBinding(binding, linked, sub) ? null : ("invalid" as const);
  }

  async function deliver(sub: Subscription): Promise<DeliveryResult> {
    let claim: Awaited<ReturnType<typeof claimDelivery>> | undefined;
    try {
      const unavailable = await hasBinding(sub);
      if (unavailable) return resultFor(sub, unavailable);
      const send = await deps.prepareTransport(request.platform, sub);
      if (!send || Date.now() >= deadline) return resultFor(sub, "retryable");
      claim = await deps.claimDelivery(request, sub);
      if (claim.outcome !== "claimed") return resultFor(sub, claim.outcome);
      const changed = await hasBinding(sub);
      if (changed) {
        await deps.finishDelivery(claim, changed);
        return resultFor(sub, changed);
      }
      const result = await send(message);
      await deps.finishDelivery(claim, result.outcome, result.retryAfterSeconds);
      return resultFor(sub, result.outcome);
    } catch {
      // Once claimed, a lost response or failed persistence must never cause an automatic resend.
      return resultFor(sub, claim ? "unknown" : "retryable");
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(4, request.subscriptions.length) }, async () => {
      while (next < request.subscriptions.length) {
        const index = next++;
        const sub = request.subscriptions[index];
        results[index] = Date.now() >= deadline ? resultFor(sub, "retryable") : await deliver(sub);
      }
    })
  );
  return results;
}
