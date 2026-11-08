import { TIMEZONES } from "@/constants/timezones";

export type TimezoneOption = {
  id: string;
  label: string;
  city: string;
  searchText: string;
};

const TIMEZONE_ALIASES: Record<string, string> = {
  "America/Argentina/Buenos_Aires": "America/Buenos_Aires",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Indiana/Indianapolis": "America/Indianapolis",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Nuuk": "America/Godthab",
  "America/Godthab": "America/Nuuk",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Kolkata": "Asia/Calcutta",
  "Asia/Ho_Chi_Minh": "Asia/Saigon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Kathmandu": "Asia/Katmandu",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Yangon": "Asia/Rangoon",
  "Asia/Rangoon": "Asia/Yangon",
  "Atlantic/Faroe": "Atlantic/Faeroe",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Etc/GMT": "UTC",
  "Etc/UTC": "UTC",
  "Europe/Kyiv": "Europe/Kiev",
  "Europe/Kiev": "Europe/Kyiv",
  UTC: "Etc/UTC Etc/GMT",
};

const TIMEZONE_IDS: readonly string[] = TIMEZONES.includes("UTC" as never)
  ? TIMEZONES
  : [...TIMEZONES, "UTC"];

export const TIMEZONE_OPTIONS: readonly TimezoneOption[] = TIMEZONE_IDS.map((id) => {
  const label = id.replace(/_/g, " ");
  const lowerLabel = label.toLowerCase();
  const city = lowerLabel.split("/").pop() ?? lowerLabel;
  const alias = TIMEZONE_ALIASES[id]?.toLowerCase().replace(/_/g, " ");

  return {
    id,
    label,
    city,
    searchText: alias ? `${lowerLabel} ${alias}` : lowerLabel,
  };
});

const TIMEZONE_BY_ID = new Map(TIMEZONE_OPTIONS.map((tz) => [tz.id, tz]));

export function resolveTimezoneId(timezone?: string | null): string | null {
  if (!timezone) return null;
  if (TIMEZONE_BY_ID.has(timezone)) return timezone;
  const alias = TIMEZONE_ALIASES[timezone];
  return alias && TIMEZONE_BY_ID.has(alias) ? alias : timezone;
}

export function getTimezoneLabel(timezone: string): string {
  const resolved = resolveTimezoneId(timezone) ?? timezone;
  return TIMEZONE_BY_ID.get(resolved)?.label ?? timezone.replace(/_/g, " ");
}

export function getDeviceTimezone(): string | null {
  try {
    return resolveTimezoneId(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return null;
  }
}

export function filterTimezones(
  query: string,
  selectedTimezone?: string | null,
  deviceTimezone?: string | null
): TimezoneOption[] {
  const normalized = query.trim().toLowerCase().replace(/_/g, " ");

  if (!normalized) {
    const pinned: TimezoneOption[] = [];
    for (const rawId of [selectedTimezone, deviceTimezone]) {
      const id = resolveTimezoneId(rawId);
      const option = id ? TIMEZONE_BY_ID.get(id) : undefined;
      if (option && !pinned.includes(option)) {
        pinned.push(option);
      }
    }

    if (pinned.length === 0) {
      return [...TIMEZONE_OPTIONS];
    }

    return [...pinned, ...TIMEZONE_OPTIONS.filter((tz) => !pinned.includes(tz))];
  }

  return TIMEZONE_OPTIONS.filter((tz) => tz.searchText.includes(normalized)).sort((a, b) => {
    const aStarts = a.city.startsWith(normalized);
    const bStarts = b.city.startsWith(normalized);

    if (aStarts !== bStarts) {
      return aStarts ? -1 : 1;
    }

    return a.id.localeCompare(b.id);
  });
}
