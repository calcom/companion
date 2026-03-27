import { randomBytes, createHash } from "node:crypto";

/**
 * Generate a cryptographically random code_verifier for PKCE (RFC 7636).
 * Returns a 43-character URL-safe base64 string (from 32 random bytes).
 */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Derive the S256 code_challenge from a code_verifier.
 * code_challenge = BASE64URL(SHA256(code_verifier))
 */
export function generateCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

/**
 * Verify that a code_verifier matches a code_challenge (S256 method).
 */
export function verifyCodeChallenge(codeVerifier: string, codeChallenge: string): boolean {
  return generateCodeChallenge(codeVerifier) === codeChallenge;
}

/**
 * Generate a cryptographically random state parameter.
 */
export function generateState(): string {
  return randomBytes(32).toString("base64url");
}
