/**
 * Where an OAuth authorization flow starts. Every entry ends on the same
 * `/auth/oauth2/authorize` URL, so the flow always returns an authorization code:
 * - `signin`: the authorize page itself (Cal.com's login card when signed out).
 * - `signup`: Cal.com's web signup, which continues to authorize once the account exists.
 * - `google` / `microsoft`: straight to that provider, which signs in or creates the account.
 */
export type AuthorizationEntry = "signin" | "signup" | "google" | "microsoft";

export function buildAuthorizationEntryUrl(
  authorizeUrl: string,
  entry: AuthorizationEntry
): string {
  if (entry === "signin") return authorizeUrl;

  // Cal.com only follows same-origin redirects, so the entry lives on the authorize URL's origin.
  const { origin } = new URL(authorizeUrl);
  if (entry === "signup") {
    return `${origin}/signup?${new URLSearchParams({ redirect: authorizeUrl }).toString()}`;
  }
  return `${origin}/auth/sso/${entry}?${new URLSearchParams({ callbackUrl: authorizeUrl }).toString()}`;
}
