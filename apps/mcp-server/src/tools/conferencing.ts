import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const getConferencingAppsSchema = {};

export async function getConferencingApps() {
  try {
    const data = await calApi("conferencing");
    return ok(data);
  } catch (err) {
    return handleError("get_conferencing_apps", err);
  }
}
