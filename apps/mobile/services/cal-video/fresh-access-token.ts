/**
 * The token to send on a room join. Join goes to the room's own origin, not through the Cal.com API
 * client, so it never gets that client's refresh on a 401: cal.video treats an expired token as a
 * guest, with no error, and the owner would be turned away from their own room. A token that
 * can't be renewed joins as a guest, which is what the server would make of it anyway.
 */
export async function freshAccessToken<
  Tokens extends { accessToken: string; refreshToken?: string },
>({
  tokens,
  isExpired,
  refresh,
}: {
  tokens: Tokens | null;
  isExpired: (tokens: Tokens) => boolean;
  refresh: (refreshToken: string) => Promise<{ accessToken: string }>;
}): Promise<string | null> {
  if (!tokens) return null;
  if (!isExpired(tokens)) return tokens.accessToken;
  if (!tokens.refreshToken) return null;
  return refresh(tokens.refreshToken).then(
    (renewed) => renewed.accessToken,
    () => null
  );
}
