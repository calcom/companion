import { deliverySchema } from "@/lib/push-notifications/contract";
import { NotificationFormattingError } from "@/lib/push-notifications/formatter";
import { verifyDeliverySignature } from "@/lib/push-notifications/signature";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 128 * 1024;

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CALCOM_DELIVERY_SECRET;
  if (!secret?.trim() || !process.env.REDIS_URL?.trim())
    return Response.json({ error: "Delivery is not configured" }, { status: 503 });
  if (!request.body) return Response.json({ error: "Missing body" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    const reader = request.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return Response.json({ error: "Body too large" }, { status: 413 });
      }
      chunks.push(value);
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");
    if (!verifyDeliverySignature(rawBody, request.headers, secret))
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: "Invalid delivery request" }, { status: 400 });
    }
    const parsed = deliverySchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: "Invalid delivery request" }, { status: 400 });
    const { deliverNotifications } = await import("@/lib/push-notifications/service");
    return Response.json({ contractVersion: 2, results: await deliverNotifications(parsed.data) });
  } catch (error) {
    if (error instanceof NotificationFormattingError)
      return Response.json({ error: "Notification formatting failed" }, { status: 422 });
    return Response.json({ error: "Delivery request failed" }, { status: 500 });
  }
}
