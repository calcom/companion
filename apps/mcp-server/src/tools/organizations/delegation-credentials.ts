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

export const createOrgDelegationCredentialSchema = {
  orgId: z.number().int().describe("orgId"),
  workspacePlatformSlug: z.string(),
  domain: z.string(),
  serviceAccountKey: z.array(z.object({
    private_key: z.string(),
    client_email: z.string(),
    client_id: z.string(),
  })),
};

export async function createOrgDelegationCredential(params: {
  orgId: number;
  workspacePlatformSlug: string;
  domain: string;
  serviceAccountKey: { private_key: string; client_email: string; client_id: string }[];
}) {
  try {
    const body: Record<string, unknown> = {};
    body.workspacePlatformSlug = params.workspacePlatformSlug;
    body.domain = params.domain;
    body.serviceAccountKey = params.serviceAccountKey;
    const data = await calApi(`organizations/${params.orgId}/delegation-credentials`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_delegation_credential", err);
  }
}

export const updateOrgDelegationCredentialSchema = {
  orgId: z.number().int().describe("orgId"),
  credentialId: z.string().describe("credentialId"),
  enabled: z.boolean().optional(),
  serviceAccountKey: z.array(z.object({
    private_key: z.string(),
    client_email: z.string(),
    client_id: z.string(),
  })).optional(),
};

export async function updateOrgDelegationCredential(params: {
  orgId: number;
  credentialId: string;
  enabled?: boolean;
  serviceAccountKey?: { private_key: string; client_email: string; client_id: string }[];
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.enabled !== undefined) body.enabled = params.enabled;
    if (params.serviceAccountKey !== undefined) body.serviceAccountKey = params.serviceAccountKey;
    const data = await calApi(`organizations/${params.orgId}/delegation-credentials/${params.credentialId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_delegation_credential", err);
  }
}
