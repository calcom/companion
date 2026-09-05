import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const findHostSchema = {
  username: z
    .string()
    .min(1)
    .describe(
      "Handle of the host to find, e.g. 'bailey'. Searched inside the caller's organization first, then as a global public username."
    ),
};

export async function findHost(params: { username: string }) {
  try {
    const me = await calApi<{ data?: { organizationId?: number | null } }>("me");
    const orgId = me?.data?.organizationId ?? null;

    if (typeof orgId === "number") {
      const orgParams: Record<string, string | number | boolean | undefined> = {
        username: params.username,
        orgId,
      };
      const orgRes = await calApi<{ data?: unknown[] }>("event-types", {
        params: orgParams,
      });

      if (Array.isArray(orgRes.data) && orgRes.data.length > 0) {
        return ok({
          scope: "organization",
          organizationId: orgId,
          username: params.username,
          eventTypes: orgRes.data,
          note: "Host found in your organization. Use one of these eventTypeIds with get_availability and create_booking.",
        });
      }
    }

    const publicParams: Record<string, string | number | boolean | undefined> = {
      username: params.username,
    };
    const publicRes = await calApi<{ data?: unknown[] }>("event-types", {
      params: publicParams,
    });

    if (Array.isArray(publicRes.data) && publicRes.data.length > 0) {
      return ok({
        scope: "public",
        username: params.username,
        eventTypes: publicRes.data,
        note: "Host found outside your organization (global username). Use one of these eventTypeIds with get_availability and create_booking.",
      });
    }

    return ok({
      scope: "not_found",
      username: params.username,
      eventTypes: [],
      note: "No bookable host with this username was found in your organization or as a public username. Ask the user for the exact username or email.",
    });
  } catch (err) {
    return handleError("find_host", err);
  }
}
