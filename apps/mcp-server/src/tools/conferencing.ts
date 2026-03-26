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

export const connectConferencingAppSchema = {
  app: z.string().describe("app"),
};

export async function connectConferencingApp(params: {
  app: string;
}) {
  try {
    const data = await calApi(`conferencing/${params.app}/connect`, { method: "POST", body: {} });
    return ok(data);
  } catch (err) {
    return handleError("connect_conferencing_app", err);
  }
}

export const getConferencingAuthUrlSchema = {
  app: z.string().describe("app"),
  returnTo: z.string(),
  onErrorReturnTo: z.string(),
};

export async function getConferencingAuthUrl(params: {
  app: string;
  returnTo: string;
  onErrorReturnTo: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    qp.returnTo = params.returnTo;
    qp.onErrorReturnTo = params.onErrorReturnTo;
    const data = await calApi(`conferencing/${params.app}/oauth/auth-url`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_conferencing_auth_url", err);
  }
}

export const getConferencingAppsSchema = {};

export async function getConferencingApps() {
  try {
    const data = await calApi("conferencing");
    return ok(data);
  } catch (err) {
    return handleError("get_conferencing_apps", err);
  }
}

export const setDefaultConferencingSchema = {
  app: z.string().describe("app"),
};

export async function setDefaultConferencing(params: {
  app: string;
}) {
  try {
    const data = await calApi(`conferencing/${params.app}/default`, { method: "POST", body: {} });
    return ok(data);
  } catch (err) {
    return handleError("set_default_conferencing", err);
  }
}

export const getDefaultConferencingSchema = {};

export async function getDefaultConferencing() {
  try {
    const data = await calApi("conferencing/default");
    return ok(data);
  } catch (err) {
    return handleError("get_default_conferencing", err);
  }
}

export const disconnectConferencingAppSchema = {
  app: z.string().describe("app"),
};

export async function disconnectConferencingApp(params: {
  app: string;
}) {
  try {
    const data = await calApi(`conferencing/${params.app}/disconnect`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("disconnect_conferencing_app", err);
  }
}
