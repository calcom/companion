import { client } from "../generated/client.gen";
import { getApiUrl, getAuthToken } from "./config";
import { isDryRunMode, outputJson } from "./output";

/**
 * Sentinel error thrown to abort requests during --dry-run.
 * The error handler recognises this and exits cleanly.
 */
export class DryRunAbort extends Error {
  constructor() {
    super("dry-run");
    this.name = "DryRunAbort";
  }
}

let initialized = false;
let initializedWithoutAuth = false;

export async function initializeClient(): Promise<void> {
  if (initialized) return;

  const apiUrl = getApiUrl();

  client.setConfig({
    baseUrl: apiUrl,
    throwOnError: true,
  });

  client.interceptors.request.use(async (request) => {
    // Check dry-run BEFORE auth to avoid token refresh/validation
    if (isDryRunMode()) {
      let body: unknown;
      try {
        body = await request.clone().json();
      } catch {
        // GET requests may not have a JSON body
      }
      outputJson({
        dryRun: true,
        method: request.method,
        url: request.url,
        body: body ?? null,
      });
      throw new DryRunAbort();
    }

    const token = await getAuthToken();
    request.headers.set("Authorization", `Bearer ${token}`);
    request.headers.set("Content-Type", "application/json");

    return request;
  });

  initialized = true;
}

export async function initializeClientWithoutAuth(): Promise<void> {
  if (initializedWithoutAuth || initialized) return;

  const apiUrl = getApiUrl();

  client.setConfig({
    baseUrl: apiUrl,
    throwOnError: true,
  });

  client.interceptors.request.use(async (request) => {
    // Check dry-run first
    if (isDryRunMode()) {
      let body: unknown;
      try {
        body = await request.clone().json();
      } catch {
        // GET requests may not have a JSON body
      }
      outputJson({
        dryRun: true,
        method: request.method,
        url: request.url,
        body: body ?? null,
      });
      throw new DryRunAbort();
    }

    request.headers.set("Content-Type", "application/json");

    return request;
  });

  initializedWithoutAuth = true;
}

export { client };
