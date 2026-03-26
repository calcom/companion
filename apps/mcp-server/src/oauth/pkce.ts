import { randomBytes, createHash } from "node:crypto";

/**
 * Generate a cryptographically random code_verifier for PKCE.
 * RFC 7636 requires 43-128 characters from [A-Z a-z 0-9 - . _ ~].
 */
export function generateCodeVerifier(length = 64): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = randomBytes(length);
  let verifier = "";
  for (let i = 0; i < length; i++) {
    verifier += chars[bytes[i] % chars.length];
  }
  return verifier;
}

/**
 * Generate a code_challenge from a code_verifier using S256 method.
 * code_challenge = BASE64URL(SHA256(code_verifier))
 */
export function generateCodeChallenge(codeVerifier: string): string {
  const hash = createHash("sha256").update(codeVerifier).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generate a cryptographically random state parameter for CSRF protection.
 */
export function generateState(): string {
  return randomBytes(32).toString("hex");
}
