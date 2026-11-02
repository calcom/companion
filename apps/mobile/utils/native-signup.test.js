import { describe, expect, test } from "@jest/globals";
import {
  getNativeSignupErrorField,
  getNativeSignupErrorMessage,
  isValidVerificationCode,
  normalizeNativeSignupAccount,
  validateNativeSignupAccount,
} from "@/utils/native-signup";

const valid = { email: "Person@Example.com ", username: " Person ", password: "long enough pw" };

describe("validateNativeSignupAccount", () => {
  test("accepts a complete account", () => {
    expect(validateNativeSignupAccount(valid)).toEqual({});
  });

  test("flags each field that cannot be sent", () => {
    expect(
      validateNativeSignupAccount({ email: "nope", username: "has space", password: "short" })
    ).toEqual({
      email: expect.any(String),
      username: expect.any(String),
      password: expect.any(String),
    });
  });

  test("normalizes email and username but never the password", () => {
    expect(normalizeNativeSignupAccount({ ...valid, password: " Pw " })).toEqual({
      email: "person@example.com",
      username: "person",
      password: " Pw ",
    });
  });
});

describe("verification code", () => {
  test("needs exactly six digits", () => {
    expect(isValidVerificationCode("123456")).toBe(true);
    expect(isValidVerificationCode("12345")).toBe(false);
    expect(isValidVerificationCode("12a456")).toBe(false);
  });
});

describe("server errors", () => {
  test("map to the field the person has to fix", () => {
    expect(getNativeSignupErrorField("user_already_exists")).toBe("email");
    expect(getNativeSignupErrorField("premium_username")).toBe("username");
    expect(getNativeSignupErrorField("password_too_weak")).toBe("password");
    expect(getNativeSignupErrorField("invalid_verification_code")).toBe("code");
    expect(getNativeSignupErrorField("rate_limited")).toBeNull();
  });

  test("offer the server's username suggestion", () => {
    expect(getNativeSignupErrorMessage("username_unavailable", "person1")).toContain('"person1"');
  });
});
