import { type OutputOptions, renderSuccess } from "../../shared/output";
import type { ApiKey } from "./types";

export function renderApiKeyRefreshed(data: ApiKey | undefined, { json }: OutputOptions = {}): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (!data?.apiKey) {
    console.log("No API key data returned.");
    return;
  }

  renderSuccess("API key refreshed successfully!");
  console.log(`\nNew API Key: ${data.apiKey}`);
  console.log("\nSave this key now - it won't be shown again.");
}
