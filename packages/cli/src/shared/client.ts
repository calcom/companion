import { client } from "../generated/client.gen";
import { getApiUrl, getAuthToken } from "./config";

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
    request.headers.set("Content-Type", "application/json");
    return request;
  });

  initializedWithoutAuth = true;
}

export { client };
