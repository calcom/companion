import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { CalApiError } from "../../utils/errors.js";

function handleError(
  tag: string,
  err: unknown
): { content: { type: "text"; text: string }[]; isError: true } {
  if (err instanceof CalApiError) {
    console.error(`[${tag}] ${err.status}: ${err.message}`);
    return {
      content: [{ type: "text", text: `Error ${err.status}: ${err.message}` }],
      isError: true,
    };
  }
  throw err;
}

function ok(data: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export const createManagedOrgSchema = {
  orgId: z.number().int().describe("orgId"),
  apiKeyDaysValid: z.number().describe("For how many days is managed organization api key valid. Defaults to 30 days.").optional(),
  apiKeyNeverExpires: z.boolean().describe("If true, organization api key never expires.").optional(),
  name: z.string().describe("Name of the organization"),
  slug: z.string().describe("Organization slug in kebab-case - if not provided will be generated automatically based on name.").optional(),
  metadata: z.record(z.unknown()).describe("You can store any additional data you want here. Metadata must have at most 50 keys, each key up to 40 characters. Values can be strings (up to 500 characters), numbers, or booleans.").optional(),
};

export async function createManagedOrg(params: {
  orgId: number;
  apiKeyDaysValid?: number;
  apiKeyNeverExpires?: boolean;
  name: string;
  slug?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.apiKeyDaysValid !== undefined) body.apiKeyDaysValid = params.apiKeyDaysValid;
    if (params.apiKeyNeverExpires !== undefined) body.apiKeyNeverExpires = params.apiKeyNeverExpires;
    body.name = params.name;
    if (params.slug !== undefined) body.slug = params.slug;
    if (params.metadata !== undefined) body.metadata = params.metadata;
    const data = await calApi(`organizations/${params.orgId}/organizations`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_managed_org", err);
  }
}

export const getManagedOrgsSchema = {
  orgId: z.number().int().describe("orgId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
  slug: z.string().describe("The slug of the managed organization").optional(),
  metadataKey: z.string().describe("The key of the metadata - it is case sensitive so provide exactly as stored. If you provide it then you must also provide metadataValue").optional(),
  metadataValue: z.string().describe("The value of the metadata - it is case sensitive so provide exactly as stored. If you provide it then you must also provide metadataKey").optional(),
};

export async function getManagedOrgs(params: {
  orgId: number;
  take?: number;
  skip?: number;
  slug?: string;
  metadataKey?: string;
  metadataValue?: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.slug !== undefined) qp.slug = params.slug;
    if (params.metadataKey !== undefined) qp.metadataKey = params.metadataKey;
    if (params.metadataValue !== undefined) qp.metadataValue = params.metadataValue;
    const data = await calApi(`organizations/${params.orgId}/organizations`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_managed_orgs", err);
  }
}

export const getManagedOrgSchema = {
  orgId: z.number().int().describe("orgId"),
  managedOrganizationId: z.number().int().describe("managedOrganizationId"),
};

export async function getManagedOrg(params: {
  orgId: number;
  managedOrganizationId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/organizations/${params.managedOrganizationId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_managed_org", err);
  }
}

export const updateManagedOrgSchema = {
  orgId: z.number().int().describe("orgId"),
  managedOrganizationId: z.number().int().describe("managedOrganizationId"),
  name: z.string().describe("Name of the organization").optional(),
  metadata: z.record(z.unknown()).describe("You can store any additional data you want here. Metadata must have at most 50 keys, each key up to 40 characters. Values can be strings (up to 500 characters), numbers, or booleans.").optional(),
};

export async function updateManagedOrg(params: {
  orgId: number;
  managedOrganizationId: number;
  name?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.metadata !== undefined) body.metadata = params.metadata;
    const data = await calApi(`organizations/${params.orgId}/organizations/${params.managedOrganizationId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_managed_org", err);
  }
}

export const deleteManagedOrgSchema = {
  orgId: z.number().int().describe("orgId"),
  managedOrganizationId: z.number().int().describe("managedOrganizationId"),
};

export async function deleteManagedOrg(params: {
  orgId: number;
  managedOrganizationId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/organizations/${params.managedOrganizationId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_managed_org", err);
  }
}
