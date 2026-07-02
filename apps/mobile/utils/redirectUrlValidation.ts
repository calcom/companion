export interface RedirectUrlValidationResult {
  valid: boolean;
  error?: string;
}

export function validateExternalRedirectUrl(value: string): RedirectUrlValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: true };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Redirect URL must be a valid URL." };
  }

  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    return { valid: true };
  }

  return { valid: false, error: "Redirect URL must use HTTP or HTTPS." };
}
