/** Long enough for a healthy refresh, short enough that Join doesn't sit spinning on a slow one. */
const REFRESH_WAIT_MS = 5_000;

interface AuthState {
  accessToken?: string;
  refreshToken?: string;
}

/**
 * The token to send on a room join. Join goes to the room's own origin, not through the Cal.com API
 * client, so it never gets that client's refresh on a 401: cal.video treats an expired token as a
 * guest, with no error, and the owner would be turned away from their own room.
 *
 * Whenever a refresh can't help, the current token still goes out. It is usually still valid, since
 * `isExpired` fires early, and the server treats a dead one exactly like no token.
 *
 * The tokens come from memory, read after the storage await: refresh tokens are single use, and
 * memory is what a concurrent refresh updates first. Storage is only asked for the expiry.
 */
export async function freshAccessToken<Stored>({
  readStoredTokens,
  currentAuth,
  isExpired,
  refresh,
}: {
  readStoredTokens: () => Promise<string | null>;
  currentAuth: () => AuthState;
  isExpired: (stored: Stored) => boolean;
  refresh: (refreshToken: string) => Promise<{ accessToken: string }>;
}): Promise<string | null> {
  const stored = await readStoredTokens();
  const { accessToken, refreshToken } = currentAuth();
  if (!accessToken) return null;
  if (!stored || !refreshToken || !isExpired(JSON.parse(stored) as Stored)) return accessToken;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const renewed = await Promise.race([
    refresh(refreshToken).then(
      (tokens) => tokens.accessToken,
      () => null
    ),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), REFRESH_WAIT_MS);
    }),
  ]);
  clearTimeout(timer);
  // Read again: a logout during the refresh must not send the old session's token.
  return renewed ?? currentAuth().accessToken ?? null;
}
