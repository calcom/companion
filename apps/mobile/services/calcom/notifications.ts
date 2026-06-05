import { makeRequest } from "./request";

export interface RegisterAppPushSubscriptionInput {
  token: string;
  platform: "IOS" | "ANDROID";
  deviceId: string;
}

export async function registerAppPushSubscription(
  input: RegisterAppPushSubscriptionInput
): Promise<{ status: string; data: { id: number } }> {
  try {
    return await makeRequest<{ status: string; data: { id: number } }>(
      "/notifications/subscriptions/app-push",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );
  } catch (error) {
    console.error("registerAppPushSubscription error");
    throw error;
  }
}

export async function removeAppPushSubscription(token: string): Promise<{ status: string }> {
  try {
    return await makeRequest<{ status: string }>(
      "/notifications/subscriptions/app-push",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      },
      "2024-08-13",
      false,
      { skipAuthFailure: true }
    );
  } catch (error) {
    console.error("removeAppPushSubscription error");
    throw error;
  }
}
