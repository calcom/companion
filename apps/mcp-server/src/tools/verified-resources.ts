import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { CalApiError } from "../utils/errors.js";

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

export const requestEmailVerificationSchema = {
  email: z.string().describe("Email to verify."),
};

export async function requestEmailVerification(params: {
  email: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.email = params.email;
    const data = await calApi("verified-resources/emails/verification-code/request", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("request_email_verification", err);
  }
}

export const requestPhoneVerificationSchema = {
  phone: z.string().describe("Phone number to verify."),
};

export async function requestPhoneVerification(params: {
  phone: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.phone = params.phone;
    const data = await calApi("verified-resources/phones/verification-code/request", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("request_phone_verification", err);
  }
}

export const verifyEmailSchema = {
  email: z.string().describe("Email to verify."),
  code: z.string().describe("verification code sent to the email to verify"),
};

export async function verifyEmail(params: {
  email: string;
  code: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.email = params.email;
    body.code = params.code;
    const data = await calApi("verified-resources/emails/verification-code/verify", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("verify_email", err);
  }
}

export const verifyPhoneSchema = {
  phone: z.string().describe("phone number to verify."),
  code: z.string().describe("verification code sent to the phone number to verify"),
};

export async function verifyPhone(params: {
  phone: string;
  code: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.phone = params.phone;
    body.code = params.code;
    const data = await calApi("verified-resources/phones/verification-code/verify", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("verify_phone", err);
  }
}

export const getVerifiedEmailsSchema = {
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getVerifiedEmails(params: {
  take?: number;
  skip?: number;
} = {}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi("verified-resources/emails", { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_verified_emails", err);
  }
}

export const getVerifiedPhonesSchema = {
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getVerifiedPhones(params: {
  take?: number;
  skip?: number;
} = {}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi("verified-resources/phones", { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_verified_phones", err);
  }
}

export const getVerifiedEmailSchema = {
  id: z.number().int().describe("id"),
};

export async function getVerifiedEmail(params: {
  id: number;
}) {
  try {
    const data = await calApi(`verified-resources/emails/${params.id}`);
    return ok(data);
  } catch (err) {
    return handleError("get_verified_email", err);
  }
}

export const getVerifiedPhoneSchema = {
  id: z.number().int().describe("id"),
};

export async function getVerifiedPhone(params: {
  id: number;
}) {
  try {
    const data = await calApi(`verified-resources/phones/${params.id}`);
    return ok(data);
  } catch (err) {
    return handleError("get_verified_phone", err);
  }
}
