import { makeRequest } from "./request";

export interface RegisterAppPushSubscriptionInput {
  token: string;
  platform: "IOS" | "ANDROID";
  deviceId: string;
}

export async function registerAppPushSubscription(
  input: RegisterAppPushSubscriptionInput
): Promise<{ status: string; data: { id: number } }> {
  return makeRequest("/notifications/subscriptions/app-push", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function removeAppPushSubscription(token: string): Promise<{ status: string }> {
  return makeRequest("/notifications/subscriptions/app-push", {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
}
