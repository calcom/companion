import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "./encryption.js";

const originalEnv = process.env;
const TEST_KEY = "a".repeat(64); // 64 hex chars = 32 bytes

beforeEach(() => {
  process.env = { ...originalEnv };
  process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
  process.env = originalEnv;
});

describe("encrypt/decrypt", () => {
  it("round-trips a plaintext string", () => {
    const plaintext = "my-secret-access-token-12345";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    // Both should decrypt to the same value
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("handles unicode", () => {
    const plaintext = "token-with-unicode-\u00e9\u00e8\u00ea";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("throws when TOKEN_ENCRYPTION_KEY is missing", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow("TOKEN_ENCRYPTION_KEY must be a 64-character hex string");
  });

  it("throws when TOKEN_ENCRYPTION_KEY is wrong length", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "abcd";
    expect(() => encrypt("test")).toThrow("TOKEN_ENCRYPTION_KEY must be a 64-character hex string");
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("test");
    const tampered = `${encrypted.slice(0, -2)}xx`;
    expect(() => decrypt(tampered)).toThrow();
  });
});
