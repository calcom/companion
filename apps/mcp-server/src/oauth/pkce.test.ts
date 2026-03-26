import { describe, it, expect } from "vitest";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "./pkce.js";
import { createHash } from "node:crypto";

describe("generateCodeVerifier", () => {
  it("generates a string of the requested length", () => {
    const verifier = generateCodeVerifier(64);
    expect(verifier).toHaveLength(64);
  });

  it("defaults to 64 characters", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toHaveLength(64);
  });

  it("only contains RFC 7636 unreserved characters", () => {
    const verifier = generateCodeVerifier(128);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("generates unique values on each call", () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe("generateCodeChallenge", () => {
  it("produces a valid base64url-encoded SHA256 hash", () => {
    const verifier = "test-verifier-string";
    const challenge = generateCodeChallenge(verifier);

    // Manually compute expected value
    const expected = createHash("sha256")
      .update(verifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(challenge).toBe(expected);
  });

  it("does not contain +, /, or = characters", () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it("is deterministic for the same input", () => {
    const verifier = "fixed-verifier";
    const a = generateCodeChallenge(verifier);
    const b = generateCodeChallenge(verifier);
    expect(a).toBe(b);
  });

  it("produces different outputs for different inputs", () => {
    const a = generateCodeChallenge("verifier-a");
    const b = generateCodeChallenge("verifier-b");
    expect(a).not.toBe(b);
  });
});

describe("generateState", () => {
  it("generates a 64-character hex string", () => {
    const state = generateState();
    expect(state).toHaveLength(64);
    expect(state).toMatch(/^[0-9a-f]+$/);
  });

  it("generates unique values on each call", () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});
