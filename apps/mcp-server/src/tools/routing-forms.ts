import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { sanitizePathSegment } from "../utils/path-sanitizer.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const calculateRoutingFormSlotsSchema = {
  routingFormId: z.string().describe("Routing form ID"),
  start: z.string().describe("Range start, UTC ISO 8601"),
  end: z.string().describe("Range end, UTC ISO 8601"),
  timeZone: z.string().optional().describe("Result time zone (default UTC)"),
  duration: z.number().optional().describe("Desired slot duration in minutes"),
  format: z.enum(["range", "time"]).optional().describe("Slot format: 'range' (start+end) or 'time'"),
  bookingUidToReschedule: z.string().optional().describe("Booking UID being rescheduled (unlocks its slot)"),
};

export async function calculateRoutingFormSlots(params: {
  routingFormId: string;
  start: string;
  end: string;
  timeZone?: string;
  duration?: number;
  format?: "range" | "time";
  bookingUidToReschedule?: string;
}) {
  try {
    const body: Record<string, unknown> = { start: params.start, end: params.end };
    if (params.timeZone !== undefined) body.timeZone = params.timeZone;
    if (params.duration !== undefined) body.duration = params.duration;
    if (params.format !== undefined) body.format = params.format;
    if (params.bookingUidToReschedule !== undefined) body.bookingUidToReschedule = params.bookingUidToReschedule;
    const formId = sanitizePathSegment(params.routingFormId);
    const data = await calApi(`routing-forms/${formId}/calculate-slots`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("calculate_routing_form_slots", err);
  }
}
