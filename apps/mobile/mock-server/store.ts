/**
 * In-memory state of the mock backend: the seed data plus OAuth codes and tokens. Mutations
 * (cancel a booking, edit a link, ...) change it until the server restarts or `reset()` runs.
 */
import { createSeed, type SeedData, type SeedOptions } from "./seed.ts";

/** Same lifetimes as production (packages/features/oauth/services/OAuthService.ts). */
export const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const AUTHORIZATION_CODE_TTL_SECONDS = 10 * 60;

export interface AuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  expiresAt: number;
}

export interface TokenRecord {
  token: string;
  clientId: string;
  userId: number;
  expiresAt: number;
}

export interface StoreOptions extends SeedOptions {
  /** Overrides the access token lifetime, e.g. a few seconds to exercise refresh. */
  accessTokenTtlSeconds?: number;
  /** Clock for token expiry; tests pass a fake one. */
  clock?: () => number;
}

export class MockStore {
  data: SeedData;
  readonly codes = new Map<string, AuthorizationCode>();
  readonly accessTokens = new Map<string, TokenRecord>();
  readonly refreshTokens = new Map<string, TokenRecord>();
  /** Requests to routes the mock doesn't implement, so gaps are easy to find. */
  readonly unhandled: { method: string; path: string; at: string }[] = [];
  readonly accessTokenTtlSeconds: number;
  readonly clock: () => number;
  private readonly seedOptions: SeedOptions;
  private counter = 0;

  constructor(options: StoreOptions = {}) {
    const { accessTokenTtlSeconds, clock, ...seedOptions } = options;
    this.seedOptions = seedOptions;
    this.data = createSeed(seedOptions);
    this.accessTokenTtlSeconds = accessTokenTtlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;
    this.clock = clock ?? Date.now;
  }

  /** Rebuild the seed around the current time (or `now`), keeping issued tokens valid. */
  reset(now?: Date): void {
    this.data = createSeed({ ...this.seedOptions, now: now ?? new Date(this.clock()) });
    this.unhandled.length = 0;
  }

  /** A unique, URL-safe token with a readable prefix. */
  newToken(prefix: string): string {
    this.counter += 1;
    const random = Array.from(crypto.getRandomValues(new Uint8Array(18)), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    return `${prefix}_${this.counter.toString(36)}${random}`;
  }

  nextId(items: { [key: string]: unknown }[], key = "id"): number {
    return items.reduce((max, item) => Math.max(max, Number(item[key]) || 0), 0) + 1;
  }

  issueTokens(clientId: string, userId: number) {
    const now = this.clock();
    const access: TokenRecord = {
      token: this.newToken("mock_at"),
      clientId,
      userId,
      expiresAt: now + this.accessTokenTtlSeconds * 1000,
    };
    const refresh: TokenRecord = {
      token: this.newToken("mock_rt"),
      clientId,
      userId,
      expiresAt: now + REFRESH_TOKEN_TTL_SECONDS * 1000,
    };
    this.accessTokens.set(access.token, access);
    this.refreshTokens.set(refresh.token, refresh);
    return { access, refresh };
  }

  /** The user behind a valid, unexpired access token, or null. */
  userForAccessToken(token: string): number | null {
    const record = this.accessTokens.get(token);
    if (!record || record.expiresAt <= this.clock()) return null;
    return record.userId;
  }

  /** Expire every access token now, to exercise the app's refresh path. */
  expireAccessTokens(): number {
    const now = this.clock();
    for (const record of this.accessTokens.values()) record.expiresAt = now - 1;
    return this.accessTokens.size;
  }
}
