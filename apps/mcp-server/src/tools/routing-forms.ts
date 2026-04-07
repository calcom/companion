import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { sanitizePathSegment } from "../utils/path-sanitizer.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const calculateRoutingFormSlotsSchema = {
  routingFormId: z.string().describe("Routing form ID. Use get_org_routing_forms to find this — never guess."),
  response: z
    .record(z.unknown())
    .describe("Routing form response object. Keys are routing form field IDs, values are the user's answers. Use get_org_routing_forms to discover the form's fields and their IDs. Ask the user for the answer values — never fabricate."),
  start: z.string().describe("Range start in UTC, ISO 8601 (e.g. '2024-08-13' or '2024-08-13T09:00:00Z')"),
  end: z.string().describe("Range end in UTC, ISO 8601 (e.g. '2024-08-14' or '2024-08-14T18:00:00Z')"),
  timeZone: z.string().optional().describe("IANA time zone for returned slots (default UTC)"),
  duration: z.number().optional().describe("Desired slot duration in minutes (for variable-duration events)"),
  format: z.enum(["range", "time"]).optional().describe("Slot format: 'range' returns start+end, 'time' returns start only"),
  bookingUidToReschedule: z.string().optional().describe("Booking UID being rescheduled — ensures original time appears in available slots"),
};

export async function calculateRoutingFormSlots(params: {
  routingFormId: string;
  response: Record<string, unknown>;
  start: string;
  end: string;
  timeZone?: string;
  duration?: number;
  format?: "range" | "time";
  bookingUidToReschedule?: string;
}) {
  try {
    const qp: Record<string, string | number | undefined> = {
      start: params.start,
      end: params.end,
    };
    if (params.timeZone !== undefined) qp.timeZone = params.timeZone;
    if (params.duration !== undefined) qp.duration = params.duration;
    if (params.format !== undefined) qp.format = params.format;
    if (params.bookingUidToReschedule !== undefined) qp.bookingUidToReschedule = params.bookingUidToReschedule;
    const formId = sanitizePathSegment(params.routingFormId);
    const data = await calApi(`routing-forms/${formId}/calculate-slots`, { method: "POST", body: params.response, params: qp });
    return ok(data);
  } catch (err) {
    return handleError("calculate_routing_form_slots", err);
  }
}
