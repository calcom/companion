import { deliverySchema } from "@/lib/push-notifications/contract";
import { verifyDeliverySignature } from "@/lib/push-notifications/signature";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 128 * 1024;

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CALCOM_DELIVERY_SECRET;
  if (!secret || !process.env.REDIS_URL)
    return Response.json({ error: "Delivery is not configured" }, { status: 503 });
  if (!request.body) return Response.json({ error: "Missing body" }, { status: 400 });
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
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
    const parsed = deliverySchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success)
      return Response.json({ error: "Invalid delivery request" }, { status: 400 });
    const { deliverNotifications } = await import("@/lib/push-notifications/service");
    return Response.json({ results: await deliverNotifications(parsed.data) });
  } catch {
    return Response.json({ error: "Delivery request failed" }, { status: 400 });
  }
}
