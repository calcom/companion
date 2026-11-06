export interface NativeSignupAccount {
  email: string;
  username: string;
  password: string;
}

export type NativeSignupField = keyof NativeSignupAccount;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/** Turns what the person typed into what the signup API expects. */
export function normalizeNativeSignupAccount(account: NativeSignupAccount): NativeSignupAccount {
  return {
    email: account.email.trim().toLowerCase(),
    username: account.username.trim().toLowerCase(),
    password: account.password,
  };
}

/**
 * Cheap checks that save a round trip. The server stays the source of truth for
 * availability and password strength.
 */
export function validateNativeSignupAccount(
  account: NativeSignupAccount
): Partial<Record<NativeSignupField, string>> {
  const { email, username, password } = normalizeNativeSignupAccount(account);
  const errors: Partial<Record<NativeSignupField, string>> = {};

  if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";
  if (!username) {
    errors.username = "Choose a username.";
  } else if (!/^[a-z0-9-_.]+$/.test(username)) {
    errors.username = "Use only letters, numbers, dashes, dots and underscores.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return errors;
}

export function isValidVerificationCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

export class NativeSignupError extends Error {
  constructor(
    readonly code: string,
    readonly suggestion?: string
  ) {
    super(code);
    this.name = "NativeSignupError";
  }
}

/** The account was created but held for review, so there is nothing to sign in to yet. */
export class SignupUnderReviewError extends Error {
  constructor() {
    super("Your account is being reviewed. We'll email you once it's ready.");
    this.name = "SignupUnderReviewError";
  }
}

/** Which field a server error belongs to, so the form can show it in place. */
export function getNativeSignupErrorField(code: string): NativeSignupField | "code" | null {
  switch (code) {
    case "user_already_exists":
      return "email";
    case "username_unavailable":
    case "premium_username":
      return "username";
    case "password_too_short":
    case "password_too_weak":
      return "password";
    case "invalid_verification_code":
      return "code";
    default:
      return null;
  }
}

export function getNativeSignupErrorMessage(code: string, suggestion?: string): string {
  switch (code) {
    case "user_already_exists":
      return "An account with this email already exists. Sign in instead.";
    case "username_unavailable":
      return suggestion
        ? `That username is taken. How about "${suggestion}"?`
        : "That username is taken.";
    case "premium_username":
      return "That's a premium username. Choose another one.";
    case "password_too_short":
      return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    case "password_too_weak":
      return "That password is too easy to guess. Try a longer or less common one.";
    case "invalid_verification_code":
      return "That code is wrong or has expired.";
    case "rate_limited":
      return "Too many attempts. Wait a minute and try again.";
    case "signup_unavailable":
      return "Sign up isn't available in this region. Create your account on Cal.com instead.";
    default:
      return "Something went wrong. Please try again.";
  }
}
