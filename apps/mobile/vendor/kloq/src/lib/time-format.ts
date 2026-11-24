/** Minute-of-day → clock label. */

export interface TimeFormatOptions {
  /** BCP 47 tag; omit for en-US */
  locale?: string;
  /** force a 12- or 24-hour clock; omit and the locale decides */
  hour12?: boolean;
}

const hour12Cache = new Map<string, boolean>();
function localeIsHour12(locale: string | undefined): boolean {
  const key = locale ?? "";
  const hit = hour12Cache.get(key);
  if (hit !== undefined) return hit;
  let is12 = true;
  try {
    is12 = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hour12 ?? false;
  } catch {
    is12 = true;
  }
  hour12Cache.set(key, is12);
  return is12;
}

/** A throwaway Date carrying `min` as a local wall-clock time. */
const atMinutes = (min: number) => {
  const d = new Date(2000, 0, 1);
  d.setMinutes(Math.round(min));
  return d;
};

/**
 * A minute-of-day as a clock label — `"9 AM"`, `"9:30 AM"`, or `"13:30"` on a 24-hour clock.
 * On a 12-hour clock `:00` is dropped; on 24-hour it never is. Minutes past 1440 wrap.
 */
export function formatMinutes(min: number, opts?: TimeFormatOptions): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  if (!opts || (opts.locale === undefined && opts.hour12 === undefined)) {
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`;
  }
  const use12 = opts.hour12 ?? localeIsHour12(opts.locale);
  const d = atMinutes(h * 60 + m);
  try {
    return d.toLocaleTimeString(
      opts.locale,
      use12
        ? m === 0
          ? { hour: "numeric", hour12: true }
          : { hour: "numeric", minute: "2-digit", hour12: true }
        : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    );
  } catch {
    return formatMinutes(min);
  }
}

/** `"9 AM – 10 AM"`. Same options, same defaults, as `formatMinutes`. */
export function formatRange(startMin: number, endMin: number, opts?: TimeFormatOptions): string {
  return `${formatMinutes(startMin, opts)} – ${formatMinutes(endMin, opts)}`;
}
