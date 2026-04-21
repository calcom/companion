/**
 * Cal.com data region (US vs. EU).
 *
 * Stores the user-selected region so OAuth (`app.cal.{com|eu}`) and API
 * (`api.cal.{com|eu}`) calls can be routed to the correct infrastructure.
 *
 * Region is persisted in general storage and cached in memory for synchronous
 * access. Listeners are notified when the region changes so dependent modules
 * (API client, OAuth service) can refresh their base URLs.
 */

import { Platform } from "react-native";

import { generalStorage, isChromeStorageAvailable } from "./storage";

export type CalRegion = "us" | "eu";

const REGION_STORAGE_KEY = "cal_region";
const DEFAULT_REGION: CalRegion = "us";

let currentRegion: CalRegion = DEFAULT_REGION;
const listeners = new Set<(region: CalRegion) => void>();

function isValidRegion(value: string | null): value is CalRegion {
  return value === "us" || value === "eu";
}

function readSync(): CalRegion | null {
  if (isChromeStorageAvailable()) {
    // chrome.storage is async; caller should await preloadRegion() on startup.
    return null;
  }
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    const raw = localStorage.getItem(REGION_STORAGE_KEY);
    return isValidRegion(raw) ? raw : null;
  }
  return null;
}

const initial = readSync();
if (initial) {
  currentRegion = initial;
}

/**
 * Preload the region from persistent storage. Call once on app startup before
 * any OAuth / API call is made. On web (localStorage) this is effectively a
 * no-op because the sync read above already populated the cache.
 */
export async function preloadRegion(): Promise<CalRegion> {
  try {
    const raw = await generalStorage.getItem(REGION_STORAGE_KEY);
    if (isValidRegion(raw) && raw !== currentRegion) {
      currentRegion = raw;
      notify();
    }
  } catch {
    // Fall back to in-memory default; not worth failing app startup over.
  }
  return currentRegion;
}

export function getRegion(): CalRegion {
  return currentRegion;
}

export async function setRegion(region: CalRegion): Promise<void> {
  if (region === currentRegion) return;
  currentRegion = region;
  notify();
  try {
    await generalStorage.setItem(REGION_STORAGE_KEY, region);
  } catch {
    // Persisting is best-effort; region stays in-memory for this session.
  }
}

/**
 * Remove the persisted region selection and reset the in-memory cache to the
 * default. Intended for logout so the next user (who may belong to a different
 * region) is prompted via the login-screen picker instead of silently inheriting
 * the previous session's region.
 *
 * Writes go through `generalStorage` to stay symmetric with `setRegion()` — on
 * web this happens to wrap `localStorage`, so clearing there is already covered.
 * We always `notify()` because the persisted value may have diverged from the
 * in-memory cache (e.g. called before `preloadRegion()` resolved).
 */
export async function clearRegion(): Promise<void> {
  currentRegion = DEFAULT_REGION;
  try {
    await generalStorage.removeItem(REGION_STORAGE_KEY);
  } catch {
    // Best-effort; the in-memory cache is already reset.
  }
  notify();
}

export function subscribeRegion(listener: (region: CalRegion) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener(currentRegion);
    } catch {
      // Ignore listener errors so one bad subscriber can't break others.
    }
  }
}

/** Fully-qualified origin of the Cal.com web app for the current region. */
export function getCalAppUrl(region: CalRegion = currentRegion): string {
  return region === "eu" ? "https://app.cal.eu" : "https://app.cal.com";
}

/** Fully-qualified origin of the Cal.com API for the current region. */
export function getCalApiUrl(region: CalRegion = currentRegion): string {
  return region === "eu" ? "https://api.cal.eu" : "https://api.cal.com";
}

/** Fully-qualified origin of the Cal.com marketing site for the current region. */
export function getCalWebUrl(region: CalRegion = currentRegion): string {
  return region === "eu" ? "https://cal.eu" : "https://cal.com";
}

/**
 * Returns the set of Cal.com app hostnames the app talks to across regions.
 * Useful for code (e.g. `appendStandaloneParam`) that needs to recognize any
 * Cal.com app URL regardless of the user's current region.
 */
export const CAL_APP_HOSTNAMES: ReadonlySet<string> = new Set(["app.cal.com", "app.cal.eu"]);
