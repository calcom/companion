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

export const getStripeConnectUrlSchema = {};

export async function getStripeConnectUrl() {
  try {
    const data = await calApi("stripe/connect");
    return ok(data);
  } catch (err) {
    return handleError("get_stripe_connect_url", err);
  }
}

export const saveStripeCredentialsSchema = {
  state: z.string(),
  code: z.string(),
};

export async function saveStripeCredentials(params: {
  state: string;
  code: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    qp.state = params.state;
    qp.code = params.code;
    const data = await calApi("stripe/save", { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("save_stripe_credentials", err);
  }
}

export const checkStripeConnectionSchema = {};

export async function checkStripeConnection() {
  try {
    const data = await calApi("stripe/check");
    return ok(data);
  } catch (err) {
    return handleError("check_stripe_connection", err);
  }
}
