/**
 * One switch for everything kloq keeps in localStorage — the uncontrolled
 * event store, theme, scheme, density and zoom. Keys are `${prefix}-theme`,
 * `${prefix}:events:v2` and so on; the default prefix is `"kloq"`.
 *
 * Module-level on purpose: `setTheme()` and friends are plain functions a host
 * calls from anywhere, so the configuration has to be reachable without React.
 */
export interface StorageConfig {
  /** key prefix — namespace per user or per embed */
  prefix?: string;
  /** `false` keeps everything in memory */
  enabled?: boolean;
}

export type StorageSetting = false | string | StorageConfig | undefined;

let prefix = "kloq";
let enabled = true;

export function configureStorage(setting: StorageSetting): void {
  if (setting === undefined) {
    prefix = "kloq";
    enabled = true;
  } else if (setting === false) {
    enabled = false;
  } else if (typeof setting === "string") {
    prefix = setting || "kloq";
    enabled = true;
  } else {
    prefix = setting.prefix || "kloq";
    enabled = setting.enabled !== false;
  }
}

export const storageEnabled = (): boolean => enabled && typeof localStorage !== "undefined";

export const storagePrefix = (): string => prefix;

/** `kloq-theme`, `kloq-density` … */
export const storageKey = (name: string): string => `${prefix}-${name}`;

/** `kloq:events:v2` */
export const eventsStorageKey = (p: string = prefix): string => `${p}:events:v2`;
