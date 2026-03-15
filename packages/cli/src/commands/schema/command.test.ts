import { describe, it, expect } from "vitest";
import { Command } from "commander";
import { serializeCommand, resolveCommandPath, registerSchemaCommand } from "./command";

function buildTestProgram(): Command {
  const program = new Command();
  program.name("calcom").description("Test CLI");

  const sub = program.command("bookings").description("Manage bookings");
  sub
    .command("list")
    .description("List all bookings")
    .option("--status <status>", "Filter by status")
    .option("--json", "Output as JSON")
    .action(() => {});
  sub
    .command("get <id>")
    .description("Get a booking by ID")
    .option("--json", "Output as JSON")
    .action(() => {});

  registerSchemaCommand(program);
  return program;
}

describe("serializeCommand", () => {
  it("serializes a root command with subcommands", () => {
    const program = buildTestProgram();
    const schema = serializeCommand(program);
    expect(schema.name).toBe("calcom");
    expect(schema.description).toBe("Test CLI");
    expect(schema.subcommands).toBeDefined();
    expect(schema.subcommands?.length).toBeGreaterThan(0);
  });

  it("excludes the schema command from output", () => {
    const program = buildTestProgram();
    const schema = serializeCommand(program);
    const schemaCmd = schema.subcommands?.find((s) => s.name === "schema");
    expect(schemaCmd).toBeUndefined();
  });

  it("serializes nested subcommands", () => {
    const program = buildTestProgram();
    const schema = serializeCommand(program);
    const bookings = schema.subcommands?.find((s) => s.name === "bookings");
    expect(bookings).toBeDefined();
    expect(bookings?.subcommands).toHaveLength(2);
    expect(bookings?.subcommands?.[0].name).toBe("list");
    expect(bookings?.subcommands?.[1].name).toBe("get");
  });

  it("includes option flags and descriptions", () => {
    const program = buildTestProgram();
    const schema = serializeCommand(program);
    const listCmd = schema.subcommands
      ?.find((s) => s.name === "bookings")
      ?.subcommands?.find((s) => s.name === "list");
    expect(listCmd).toBeDefined();
    const statusOpt = listCmd?.options.find((o) => o.flags.includes("--status"));
    expect(statusOpt).toBeDefined();
    expect(statusOpt?.description).toBe("Filter by status");
    expect(statusOpt?.required).toBe(true);
  });

  it("omits subcommands key when there are none", () => {
    const program = buildTestProgram();
    const schema = serializeCommand(program);
    const listCmd = schema.subcommands
      ?.find((s) => s.name === "bookings")
      ?.subcommands?.find((s) => s.name === "list");
    expect(listCmd).toBeDefined();
    expect(listCmd?.subcommands).toBeUndefined();
  });
});

describe("resolveCommandPath", () => {
  it("returns root when path is empty", () => {
    const program = buildTestProgram();
    const result = resolveCommandPath(program, []);
    expect(result).toBe(program);
  });

  it("resolves a single-level path", () => {
    const program = buildTestProgram();
    const result = resolveCommandPath(program, ["bookings"]);
    expect(result).not.toBeNull();
    expect(result?.name()).toBe("bookings");
  });

  it("resolves a nested path", () => {
    const program = buildTestProgram();
    const result = resolveCommandPath(program, ["bookings", "list"]);
    expect(result).not.toBeNull();
    expect(result?.name()).toBe("list");
  });

  it("returns null for unknown command", () => {
    const program = buildTestProgram();
    const result = resolveCommandPath(program, ["nonexistent"]);
    expect(result).toBeNull();
  });

  it("returns null for unknown nested command", () => {
    const program = buildTestProgram();
    const result = resolveCommandPath(program, ["bookings", "nonexistent"]);
    expect(result).toBeNull();
  });
});
