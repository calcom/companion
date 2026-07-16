export const CAL_APP_URLS = {
  us: "https://app.cal.com",
  eu: "https://app.cal.eu",
} as const;

export const CAL_APP_HOSTNAMES: ReadonlySet<string> = new Set(
  Object.values(CAL_APP_URLS).map((url) => new URL(url).hostname)
);
