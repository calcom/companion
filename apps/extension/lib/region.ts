/**
 * Cal.com data region helpers for the Chrome extension.
 *
 * Mirrors `apps/mobile/utils/region.ts` but reads from
 * `chrome.storage.local["cal_region"]` — the same key the background worker
 * writes via the `sync-oauth-tokens` handler
 * (`apps/extension/entrypoints/background/index.ts:26`).
 *
 * Region is cached synchronously in a module-level variable so content-script
 * callsites can build URLs without an `await`. The cache is initialized on
 * module import via the fire-and-forget `preloadRegion()` and kept in sync
 * thereafter by a `chrome.storage.onChanged` listener.
 *
 * NEVER inline literal `cal.com` / `cal.eu` hostnames elsewhere in
 * `apps/extension/**`. The CI grep `check:no-cal-hostnames` enforces this.
 */

export type CalRegion = "us" | "eu";

const REGION_STORAGE_KEY = "cal_region";
const DEFAULT_REGION: CalRegion = "us";

let currentRegion: CalRegion = DEFAULT_REGION;
let preloaded = false;

function isValidRegion(value: unknown): value is CalRegion {
  return value === "us" || value === "eu";
}

function isChromeStorageAvailable(): boolean {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.storage !== "undefined" &&
    typeof chrome.storage.local !== "undefined"
  );
}

/**
 * Load the persisted region from chrome.storage.local. Idempotent — subsequent
 * calls re-read storage but do not re-register listeners. Best-effort: on
 * storage failure the cache stays at its current value (default US for the
 * first call, last-known otherwise).
 */
export async function preloadRegion(): Promise<CalRegion> {
  if (!isChromeStorageAvailable()) {
    preloaded = true;
    return currentRegion;
  }
  try {
    const result = await chrome.storage.local.get([REGION_STORAGE_KEY]);
    if (isValidRegion(result[REGION_STORAGE_KEY])) {
      currentRegion = result[REGION_STORAGE_KEY];
    }
  } catch {
    // Best-effort; stay on default.
  }
  preloaded = true;
  return currentRegion;
}

if (
  typeof chrome !== "undefined" &&
  chrome.storage?.onChanged &&
  typeof chrome.storage.onChanged.addListener === "function"
) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes[REGION_STORAGE_KEY]) return;
    const next = changes[REGION_STORAGE_KEY].newValue;
    if (isValidRegion(next)) {
      currentRegion = next;
    } else if (next === undefined) {
      currentRegion = DEFAULT_REGION;
    }
  });
}

// Kick off the initial read on import. Fire-and-forget — the helpers below are
// safe to call before this resolves (they fall back to the default).
preloadRegion();

export function getRegion(): CalRegion {
  return currentRegion;
}

export function isRegionPreloaded(): boolean {
  return preloaded;
}

/**
 * `https://app.cal.{com|eu}` — Cal.com web app origin for the current region.
 *
 * Note: the very first synchronous call after extension load may return the
 * US default before `preloadRegion()` resolves. In practice this is benign:
 * content scripts only construct URLs in user-event handlers, by which time
 * the async preload has completed.
 */
export function getCalAppUrl(region: CalRegion = currentRegion): string {
  return region === "eu" ? "https://app.cal.eu" : "https://app.cal.com";
}

/**
 * `https://api.cal.{com|eu}` — Cal.com API origin for the current region.
 * Same first-call caveat as `getCalAppUrl()`.
 */
export function getCalApiUrl(region: CalRegion = currentRegion): string {
  return region === "eu" ? "https://api.cal.eu" : "https://api.cal.com";
}

/**
 * `https://cal.{com|eu}` — Cal.com booking-page origin for the current region.
 * Same first-call caveat as `getCalAppUrl()`.
 */
export function getCalWebUrl(region: CalRegion = currentRegion): string {
  return region === "eu" ? "https://cal.eu" : "https://cal.com";
}

/**
 * Cal.com Framer marketing landing for the "open extension" deep link. Stays
 * global — the Framer-hosted marketing site does not have an EU mirror.
 * Same precedent as `getCalSupportUrl()` / `getCalHelpUrl()` in mobile's
 * region module.
 */
export function getCalMarketingAppUrl(): string {
  return "https://cal.com/app?openExtension=true";
}

/**
 * Hostnames the extension recognizes as Cal.com booking surfaces across both
 * regions. Use for regex / `text.includes(...)` host detection. Do NOT use to
 * build outbound URLs (use the getters above).
 */
export const CAL_WEB_HOSTNAMES: ReadonlyArray<string> = [
  "cal.com",
  "cal.eu",
  "app.cal.com",
  "app.cal.eu",
];
