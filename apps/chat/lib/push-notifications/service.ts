import { deliverSlack } from "./deliver-slack";
import { deliverTelegram } from "./deliver-telegram";
import { buildPushCard, type ChatPushPayload } from "./formatter";
import type { DeliverResult } from "./types";

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

  const settled =
    request.platform === "SLACK"
      ? await Promise.allSettled(
          request.subscriptions.map((sub) => deliverSlack(sub.identifier, sub.teamId, card))
        )
      : await Promise.allSettled(
          request.subscriptions.map((sub) => deliverTelegram(sub.identifier, card))
        );

  return settled.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return {
      identifier: request.subscriptions[i].identifier,
      success: false,
    };
  });
}
