const ENTRY_REDIRECT_PARAMS = ["redirect", "callbackUrl"] as const;

/**
 * The OAuth authorize URL inside an auth URL. Sign-up and SSO entries start on another
 * Cal.com page and carry the authorize URL (with its `state` and `redirect_uri`) as a
 * same-origin `redirect` / `callbackUrl` parameter.
 */
export function getAuthorizeUrl(authUrl: string): URL {
  const url = new URL(authUrl);
  for (const param of ENTRY_REDIRECT_PARAMS) {
    const nested = url.searchParams.get(param);
    if (!nested) continue;
    const nestedUrl = new URL(nested, url.origin);
    if (nestedUrl.origin === url.origin && nestedUrl.searchParams.has("redirect_uri")) {
      return nestedUrl;
    }
  }
  return url;
}
