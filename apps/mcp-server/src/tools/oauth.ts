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

export const getOauthClientSchema = {
  clientId: z.string().describe("clientId"),
};

export async function getOauthClient(params: {
  clientId: string;
}) {
  try {
    const data = await calApi(`auth/oauth2/clients/${params.clientId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_oauth_client", err);
  }
}

export const exchangeOauthTokenSchema = {
  client_id: z.string().describe("The client identifier"),
  grant_type: z.enum(["authorization_code"]).describe("The grant type — must be 'authorization_code'"),
  code: z.string().describe("The authorization code received from the authorize endpoint"),
  redirect_uri: z.string().describe("The redirect URI used in the authorization request"),
  client_secret: z.string().describe("The client secret for confidential clients"),
};

export async function exchangeOauthToken(params: {
  client_id: string;
  grant_type: "authorization_code";
  code: string;
  redirect_uri: string;
  client_secret: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.client_id = params.client_id;
    body.grant_type = params.grant_type;
    body.code = params.code;
    body.redirect_uri = params.redirect_uri;
    body.client_secret = params.client_secret;
    const data = await calApi("auth/oauth2/token", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("exchange_oauth_token", err);
  }
}
