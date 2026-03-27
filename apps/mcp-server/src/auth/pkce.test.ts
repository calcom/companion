import { describe, it, expect } from "vitest";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  verifyCodeChallenge,
  generateState,
} from "./pkce.js";

describe("generateCodeVerifier", () => {
  it("returns a 43-character base64url string", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toHaveLength(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique values", () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe("generateCodeChallenge", () => {
  it("returns a base64url-encoded SHA256 hash", () => {
    const verifier = "test-verifier-12345";
    const challenge = generateCodeChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge.length).toBeGreaterThan(0);
  });

  it("produces consistent output for same input", () => {
    const verifier = "consistent-verifier";
    expect(generateCodeChallenge(verifier)).toBe(generateCodeChallenge(verifier));
  });
});

describe("verifyCodeChallenge", () => {
  it("returns true for matching verifier and challenge", () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    expect(verifyCodeChallenge(verifier, challenge)).toBe(true);
  });

  it("returns false for mismatched verifier", () => {
    const challenge = generateCodeChallenge("correct-verifier");
    expect(verifyCodeChallenge("wrong-verifier", challenge)).toBe(false);
  });
});

describe("generateState", () => {
  it("returns a base64url string", () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(state.length).toBeGreaterThan(0);
  });

  it("generates unique values", () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});
