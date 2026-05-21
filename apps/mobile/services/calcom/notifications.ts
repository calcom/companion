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
    return await makeRequest<{ status: string }>("/notifications/subscriptions/app-push", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
  } catch (error) {
    console.error("removeAppPushSubscription error");
    throw error;
  }
}
