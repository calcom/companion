/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Uses the browser's built-in text encoding via textContent.
 */
export function escapeHtml(text: string): string {
  if (typeof text !== "string") return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

const SAFE_BOOKING_HOSTS = new Set(["cal.com", "www.cal.com", "cal.eu", "www.cal.eu"]);
const SAFE_OAUTH_APP_ORIGINS = new Set([
  "https://app.cal.com",
  "https://app.cal.eu",
  "https://cal.com",
  "https://cal.eu",
]);
const SAFE_OAUTH_API_ORIGINS = new Set(["https://api.cal.com", "https://api.cal.eu"]);

export interface BookingLinkSource {
  slug: string;
  users?: Array<{ username?: string }>;
  bookingUrl?: string;
}

export type UrlValidationResult = { ok: true } | { ok: false; reason: string };

function isHttpsUrlOnHost(rawUrl: string, allowedHosts: Set<string>): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && allowedHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function buildSafeBookingUrl(eventType: BookingLinkSource): string {
  const rawBookingUrl = eventType.bookingUrl?.trim();
  if (rawBookingUrl && isHttpsUrlOnHost(rawBookingUrl, SAFE_BOOKING_HOSTS)) {
    return new URL(rawBookingUrl).toString();
  }

  const username = eventType.users?.[0]?.username || "user";
  return `https://cal.com/${encodeURIComponent(username)}/${encodeURIComponent(eventType.slug)}`;
}

export function validateExtensionOAuthAuthorizeUrl(
  authUrl: string,
  expectedRedirectUrl?: string
): UrlValidationResult {
  let url: URL;
  try {
    url = new URL(authUrl);
  } catch {
    return { ok: false, reason: "Invalid OAuth authorize URL" };
  }

  if (url.protocol !== "https:" || !SAFE_OAUTH_APP_ORIGINS.has(url.origin)) {
    return { ok: false, reason: "OAuth authorize URL must use a Cal.com app origin" };
  }

  if (url.pathname !== "/auth/oauth2/authorize") {
    return { ok: false, reason: "OAuth authorize URL must use the Cal.com authorize path" };
  }

  const state = url.searchParams.get("state");
  if (!state) {
    return { ok: false, reason: "No state parameter in auth URL" };
  }

  const redirectUri = url.searchParams.get("redirect_uri");
  if (!redirectUri) {
    return { ok: false, reason: "redirect_uri not found in auth URL" };
  }

  if (expectedRedirectUrl) {
    const expected = expectedRedirectUrl.replace(/\/$/, "");
    if (!redirectUri.startsWith(expected)) {
      return { ok: false, reason: "redirect_uri does not match extension redirect URL" };
    }
  }

  return { ok: true };
}

export function validateExtensionOAuthTokenEndpoint(tokenEndpoint: string): UrlValidationResult {
  let url: URL;
  try {
    url = new URL(tokenEndpoint);
  } catch {
    return { ok: false, reason: "Invalid OAuth token endpoint" };
  }

  if (url.protocol !== "https:" || !SAFE_OAUTH_API_ORIGINS.has(url.origin)) {
    return { ok: false, reason: "OAuth token endpoint must use a Cal.com API origin" };
  }

  if (!url.pathname.endsWith("/oauth/token")) {
    return { ok: false, reason: "OAuth token endpoint must use the Cal.com token path" };
  }

  return { ok: true };
}
