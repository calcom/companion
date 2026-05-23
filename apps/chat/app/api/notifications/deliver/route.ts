import crypto from "node:crypto";
import { type DeliverRequest, deliverNotifications } from "@/lib/push-notifications/service";

const secretHmac = process.env.CALCOM_DELIVERY_SECRET
  ? crypto
      .createHmac("sha256", "delivery-verify")
      .update(process.env.CALCOM_DELIVERY_SECRET)
      .digest()
  : null;

function verifyDeliverySecret(header: string | null): boolean {
  if (!secretHmac || !header) return false;
  try {
    const headerHmac = crypto.createHmac("sha256", "delivery-verify").update(header).digest();
    return crypto.timingSafeEqual(headerHmac, secretHmac);
  } catch {
    return false;
  }
}

function parseDeliverRequest(body: unknown): DeliverRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.platform !== "SLACK" && b.platform !== "TELEGRAM") return null;
  if (!Array.isArray(b.subscriptions) || b.subscriptions.length === 0) return null;
  if (typeof b.payload !== "object" || b.payload === null) return null;

  if (b.platform === "SLACK") {
    const valid = b.subscriptions.every(
      (s: unknown) =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as Record<string, unknown>).identifier === "string" &&
        typeof (s as Record<string, unknown>).teamId === "string"
    );
    if (!valid) return null;
  }

  return body as DeliverRequest;
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-cal-delivery-secret");
  if (!verifyDeliverySecret(secret)) {
    return new Response(null, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = parseDeliverRequest(body);
  if (!parsed) {
    return new Response(null, { status: 400 });
  }

  const results = await deliverNotifications(parsed);
  return Response.json({ results });
}
