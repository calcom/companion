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

export const requestOrgTeamEmailVerificationSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  email: z.string().describe("Email to verify."),
};

export async function requestOrgTeamEmailVerification(params: {
  orgId: number;
  teamId: number;
  email: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.email = params.email;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/verified-resources/emails/verification-code/request`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("request_org_team_email_verification", err);
  }
}

export const requestOrgTeamPhoneVerificationSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  phone: z.string().describe("Phone number to verify."),
};

export async function requestOrgTeamPhoneVerification(params: {
  orgId: number;
  teamId: number;
  phone: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.phone = params.phone;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/verified-resources/phones/verification-code/request`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("request_org_team_phone_verification", err);
  }
}

export const verifyOrgTeamEmailSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  email: z.string().describe("Email to verify."),
  code: z.string().describe("verification code sent to the email to verify"),
};

export async function verifyOrgTeamEmail(params: {
  orgId: number;
  teamId: number;
  email: string;
  code: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.email = params.email;
    body.code = params.code;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/verified-resources/emails/verification-code/verify`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("verify_org_team_email", err);
  }
}

export const verifyOrgTeamPhoneSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  phone: z.string().describe("phone number to verify."),
  code: z.string().describe("verification code sent to the phone number to verify"),
};

export async function verifyOrgTeamPhone(params: {
  orgId: number;
  teamId: number;
  phone: string;
  code: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.phone = params.phone;
    body.code = params.code;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/verified-resources/phones/verification-code/verify`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("verify_org_team_phone", err);
  }
}

export const getOrgTeamVerifiedEmailsSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getOrgTeamVerifiedEmails(params: {
  orgId: number;
  teamId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/verified-resources/emails`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_verified_emails", err);
  }
}

export const getOrgTeamVerifiedPhonesSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getOrgTeamVerifiedPhones(params: {
  orgId: number;
  teamId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/verified-resources/phones`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_verified_phones", err);
  }
}

export const getOrgTeamVerifiedEmailSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  id: z.number().int().describe("id"),
};

export async function getOrgTeamVerifiedEmail(params: {
  orgId: number;
  teamId: number;
  id: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/verified-resources/emails/${params.id}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_verified_email", err);
  }
}

export const getOrgTeamVerifiedPhoneSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  id: z.number().int().describe("id"),
};

export async function getOrgTeamVerifiedPhone(params: {
  orgId: number;
  teamId: number;
  id: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/verified-resources/phones/${params.id}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_verified_phone", err);
  }
}
