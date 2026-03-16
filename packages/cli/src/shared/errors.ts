import process from "node:process";
import { isGlobalJsonMode, renderError } from "./output";
import { DryRunAbort } from "./client";

interface ValidationConstraints {
  [key: string]: string;
}

interface ValidationError {
  property?: string;
  constraints?: ValidationConstraints;
  children?: ValidationError[];
}

interface ApiErrorDetails {
  message?: string;
  errors?: ValidationError[];
}

interface ApiErrorBody {
  status?: string;
  message?: string;
  error?:
    | string
    | {
        code?: string;
        message?: string;
        details?: string | ApiErrorDetails;
      };
}

function extractValidationMessages(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  for (const err of errors) {
    if (err.constraints) {
      const constraintValues = Object.values(err.constraints);
      for (const msg of constraintValues) {
        if (err.property) {
          messages.push(`${err.property}: ${msg}`);
        } else {
          messages.push(msg);
        }
      }
    }
    if (err.children && err.children.length > 0) {
      const childMessages = extractValidationMessages(err.children);
      for (const childMsg of childMessages) {
        if (err.property) {
          messages.push(`${err.property}.${childMsg}`);
        } else {
          messages.push(childMsg);
        }
      }
    }
  }
  return messages;
}

function formatApiErrorBody(body: ApiErrorBody): string {
  if (body.error && typeof body.error === "object") {
    const errorObj = body.error;

    if (errorObj.details && typeof errorObj.details === "object") {
      const details = errorObj.details;
      if (details.errors && Array.isArray(details.errors) && details.errors.length > 0) {
        const validationMessages = extractValidationMessages(details.errors);
        if (validationMessages.length > 0) {
          return validationMessages.join("; ");
        }
      }
    }

    if (typeof errorObj.message === "string" && errorObj.message.length > 0) {
      return errorObj.message;
    }

    if (typeof errorObj.details === "string" && errorObj.details.length > 0) {
      return errorObj.details;
    }

    if (typeof errorObj.code === "string" && errorObj.code.length > 0) {
      return errorObj.code;
    }
  }

  if (typeof body.error === "string" && body.error.length > 0) {
    return body.error;
  }

  if (typeof body.message === "string" && body.message.length > 0) {
    return body.message;
  }

  return JSON.stringify(body);
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;

    try {
      const parsed = JSON.parse(message) as ApiErrorBody;
      return formatApiErrorBody(parsed);
    } catch {}

    const sdkError = error as { body?: unknown; status?: number };
    if (sdkError.body && typeof sdkError.body === "object") {
      const status = sdkError.status ?? "unknown";
      return `API Error (${status}): ${formatApiErrorBody(sdkError.body as ApiErrorBody)}`;
    }

    if (sdkError.status) {
      return `API Error (${sdkError.status}): ${message}`;
    }

    return message;
  }

  if (error && typeof error === "object") {
    const sdkErr = error as {
      status?: string;
      error?: { code?: string; message?: string; details?: { message?: string } };
      message?: string;
    };

    if (sdkErr.error?.message) {
      return sdkErr.error.message;
    }
    if (sdkErr.error?.details?.message) {
      return sdkErr.error.details.message;
    }
    if (sdkErr.message) {
      return sdkErr.message;
    }
  }

  return String(error);
}

export function handleSdkError(error: unknown): void {
  if (error instanceof DryRunAbort) {
    return;
  }

  const message = extractErrorMessage(error);

  if (isGlobalJsonMode()) {
    console.error(JSON.stringify({ status: "error", error: { message } }));
    return;
  }

  renderError(message);
}

export async function withErrorHandling<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    handleSdkError(error);
    process.exit(1);
  }
}
