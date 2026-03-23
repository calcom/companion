#!/usr/bin/env npx ts-node
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const TEMP_DIR = "/tmp/calcom-mcp-gen";
const OPENAPI_PATH = resolve(__dirname, "../../../docs/api-reference/v2/openapi.json");
const OUTPUT_PATH = resolve(__dirname, "../src/core/generated.ts");

rmSync(TEMP_DIR, { recursive: true, force: true });
mkdirSync(TEMP_DIR, { recursive: true });
execSync(`npx openapi-mcp-generator -i "${OPENAPI_PATH}" -o "${TEMP_DIR}" --force`, { stdio: "inherit" });

const content = readFileSync(`${TEMP_DIR}/src/index.ts`, "utf-8");
const marker = "const toolDefinitionMap: Map<string, McpToolDefinition> = new Map([";
const start = content.indexOf(marker);
if (start === -1) throw new Error("Could not find toolDefinitionMap");

let depth = 0, end = start + marker.length;
for (let i = end; i < content.length; i++) {
  if (content[i] === "[") depth++;
  if (content[i] === "]" && --depth === -1) { end = i + 1; break; }
}

let entries = content.slice(start + marker.length, end - 2);
entries = entries.replace(/"required":\s*\[([^\]]+)\]/g, (match, arr) => {
  try {
    const filtered = (JSON.parse(`[${arr}]`) as string[]).filter(s => s !== "Authorization");
    return filtered.length ? `"required":${JSON.stringify(filtered)}` : "";
  } catch { return match; }
});
entries = entries.replace(/"Authorization":\s*\{[^}]+\},?\s*/g, "");
entries = entries.replace(/\{"name":"Authorization","in":"header"\},?\s*/g, "");
entries = entries.replace(/,(\s*[\]}])/g, "$1");

writeFileSync(OUTPUT_PATH, `/**
 * Generated from OpenAPI spec - DO NOT EDIT
 * Regenerate: bun run generate
 */

import type { McpToolDefinition } from "./types.js";

export type { JsonObject, McpToolDefinition } from "./types.js";
export { SERVER_NAME, SERVER_VERSION, API_BASE_URL } from "./types.js";
export { executeApiTool } from "./executor.js";

export const toolDefinitionMap: Map<string, McpToolDefinition> = new Map([
${entries}
]);
`);

rmSync(TEMP_DIR, { recursive: true, force: true });
console.log(`Extracted ${(entries.match(/\["[A-Za-z]+Controller_/g) || []).length} tools to ${OUTPUT_PATH}`);
