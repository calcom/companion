import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { sanitizePathSegment } from "../utils/path-sanitizer.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const getBookingRoutingTraceSchema = {
  bookingUid: z.string().describe("Booking UID to get the routing trace for. Use get_bookings to find UIDs."),
};

export async function getBookingRoutingTrace(params: { bookingUid: string }) {
  try {
    const uid = sanitizePathSegment(params.bookingUid);
    const data = await calApi(`bookings/${uid}/routing-trace`);
    return ok(data);
  } catch (err) {
    return handleError("get_booking_routing_trace", err);
  }
}
