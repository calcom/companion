import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProcessExitError,
  mockConsoleError,
  mockProcessExit,
} from "../__tests__/helpers";
import {
  errorWithStringError,
  nestedValidationErrorBody,
  sdkErrorObject,
  simpleErrorBody,
  validationErrorBody,
} from "../__tests__/helpers/fixtures";
import { handleSdkError, withErrorHandling } from "./errors";

// Mock the output module to capture renderError calls
vi.mock("./output", () => ({
  renderError: vi.fn(),
}));

import { renderError } from "./output";

describe("errors", () => {
  let exitSpy: ReturnType<typeof mockProcessExit>;

  beforeEach(() => {
    exitSpy = mockProcessExit();
    mockConsoleError();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("handleSdkError", () => {
    it("handles Error with JSON body containing validation errors", () => {
      const error = new Error(JSON.stringify(validationErrorBody));

      handleSdkError(error);

      expect(renderError).toHaveBeenCalledWith(
        "email: email must be a valid email address"
      );
    });

    it("handles Error with JSON body containing nested validation errors", () => {
      const error = new Error(JSON.stringify(nestedValidationErrorBody));

      handleSdkError(error);

      expect(renderError).toHaveBeenCalledWith(
        "user.profile.name: name should not be empty"
      );
    });

    it("handles Error with JSON body containing simple message", () => {
      const error = new Error(JSON.stringify(simpleErrorBody));

      handleSdkError(error);

      expect(renderError).toHaveBeenCalledWith("Something went wrong");
    });

    it("handles Error with JSON body containing string error", () => {
      const error = new Error(JSON.stringify(errorWithStringError));

      handleSdkError(error);

      expect(renderError).toHaveBeenCalledWith("Not found");
    });

    it("handles SDK error object with body property", () => {
      const error = Object.assign(new Error("API Error"), {
        body: sdkErrorObject,
        status: 404,
      });

      handleSdkError(error);

      expect(renderError).toHaveBeenCalledWith(
        "API Error (404): Resource not found"
      );
    });

    it("handles SDK error object with status but no body", () => {
      const error = Object.assign(new Error("Not Found"), {
        status: 404,
      });

      handleSdkError(error);

      expect(renderError).toHaveBeenCalledWith("API Error (404): Not Found");
    });

    it("handles plain Error with non-JSON message", () => {
      const error = new Error("Connection failed");

      handleSdkError(error);

      expect(renderError).toHaveBeenCalledWith("Connection failed");
    });

    it("handles plain object error with error.message", () => {
      const error = {
        status: "error",
        error: {
          message: "Invalid input",
        },
      };

      handleSdkError(error);

      expect(renderError).toHaveBeenCalledWith("Invalid input");
    });

    it("handles plain object error with error.details.message", () => {
      const error = {
        status: "error",
        error: {
          details: {
            message: "Detailed error info",
          },
        },
      };

      handleSdkError(error);

      expect(renderError).toHaveBeenCalledWith("Detailed error info");
    });

    it("handles plain object error with top-level message", () => {
      const error = {
        message: "Top level message",
      };

      handleSdkError(error);

      expect(renderError).toHaveBeenCalledWith("Top level message");
    });

    it("handles string error", () => {
      handleSdkError("Simple string error");

      expect(renderError).toHaveBeenCalledWith("Simple string error");
    });

    it("handles null/undefined by converting to string", () => {
      handleSdkError(null);

      expect(renderError).toHaveBeenCalledWith("null");
    });
  });

  describe("withErrorHandling", () => {
    it("returns result on success", async () => {
      const result = await withErrorHandling(async () => "success");

      expect(result).toBe("success");
    });

    it("returns complex objects on success", async () => {
      const data = { id: 1, name: "test" };
      const result = await withErrorHandling(async () => data);

      expect(result).toEqual(data);
    });

    it("calls exit(1) on error", async () => {
      await expect(
        withErrorHandling(async () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow(ProcessExitError);

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(renderError).toHaveBeenCalledWith("Test error");
    });

    it("handles SDK errors in wrapped function", async () => {
      const sdkError = {
        status: "error",
        error: {
          message: "SDK error message",
        },
      };

      await expect(
        withErrorHandling(async () => {
          throw sdkError;
        })
      ).rejects.toThrow(ProcessExitError);

      expect(renderError).toHaveBeenCalledWith("SDK error message");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
