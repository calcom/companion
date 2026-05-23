import { type DeliverResult, deliverSlack } from "./deliver-slack";
import { deliverTelegram } from "./deliver-telegram";
import { buildPushCard, type ChatPushPayload } from "./formatter";

export type DeliverRequest =
  | {
      platform: "SLACK";
      subscriptions: Array<{ identifier: string; teamId: string }>;
      payload: ChatPushPayload;
    }
  | {
      platform: "TELEGRAM";
      subscriptions: Array<{ identifier: string }>;
      payload: ChatPushPayload;
    };

export type { DeliverResult };

export async function deliverNotifications(request: DeliverRequest): Promise<DeliverResult[]> {
  const card = buildPushCard(request.payload);

  const settled = await Promise.allSettled(
    request.subscriptions.map((sub) => {
      if (request.platform === "SLACK") {
        const slackSub = sub as { identifier: string; teamId: string };
        return deliverSlack(slackSub.identifier, slackSub.teamId, card);
      }
      return deliverTelegram(sub.identifier, card);
    })
  );

  return settled.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return {
      identifier: request.subscriptions[i].identifier,
      success: false,
    };
  });
}
