import { vi } from "vitest";

export class ProcessExitError extends Error {
  constructor(public code: number | undefined) {
    super(`process.exit(${code})`);
    this.name = "ProcessExitError";
  }
}

export function mockProcessExit() {
  return vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    throw new ProcessExitError(code);
  });
}

export function mockConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

export function mockConsoleLog() {
  return vi.spyOn(console, "log").mockImplementation(() => {});
}
