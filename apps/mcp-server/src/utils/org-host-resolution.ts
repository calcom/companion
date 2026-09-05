import { calApi } from "./api-client.js";

export type OrgHostResolution = { eventTypeId: number; organizationId: number } | null;

/** Org-first host lookup: if the caller belongs to an organization and `username` matches an org-profile username with an event type of slug `eventTypeSlug`, returns that event type id. Returns null (caller falls through to global username) otherwise. */
export async function resolveOrgHostEventType(
  username: string,
  eventTypeSlug: string,
): Promise<OrgHostResolution> {
  try {
    const me = await calApi<{ data?: { organizationId?: number | null } }>("me");
    const organizationId = me?.data?.organizationId ?? null;
    if (typeof organizationId !== "number") return null;

    const res = await calApi<{ data?: Array<{ id?: number; slug?: string }> }>("event-types", {
      params: { username, orgId: organizationId },
    });
    const eventType = res.data?.find(
      (entry) => entry.slug === eventTypeSlug && typeof entry.id === "number",
    );

    return eventType?.id !== undefined ? { eventTypeId: eventType.id, organizationId } : null;
  } catch {
    return null;
  }
}
