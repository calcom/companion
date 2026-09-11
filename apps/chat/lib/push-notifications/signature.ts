import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyDeliverySignature(
  rawBody: string,
  headers: Headers,
  secret: string,
  now = Date.now()
): boolean {
  const timestamp = headers.get("x-cal-timestamp") ?? "";
  const signature = headers.get("x-cal-signature") ?? "";
  if (!secret || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (!Number.isSafeInteger(Number(timestamp)) || Math.abs(now / 1000 - Number(timestamp)) > 300)
    return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
