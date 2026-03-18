import { describe, it, expect } from "vitest";
import { Command } from "commander";
import { serializeCommand, resolveCommandPath, registerSchemaCommand } from "./command";

function buildTestProgram(): Command {
  const program = new Command();
  program.name("calcom").description("Test CLI");

  const bookings = program.command("bookings").description("Manage bookings");
  bookings
    .command("list")
    .description("List bookings")
    .option("--json", "Output as JSON");
  bookings.command("get").description("Get a booking");

  program.command("me").description("Show current user");

  return program;
}

describe("serializeCommand", () => {
  it("serializes the root command", () => {
    const program = buildTestProgram();
    const result = serializeCommand(program);

    expect(result.name).toBe("calcom");
    expect(result.description).toBe("Test CLI");
    expect(result.subcommands.length).toBe(2); // bookings, me
  });

  it("serializes nested subcommands", () => {
    const program = buildTestProgram();
    const result = serializeCommand(program);

    const bookings = result.subcommands.find((c) => c.name === "bookings");
    expect(bookings).toBeDefined();
    expect(bookings?.subcommands.length).toBeGreaterThanOrEqual(2);

    const list = bookings?.subcommands.find((c) => c.name === "list");
    expect(list).toBeDefined();
    expect(list?.description).toBe("List bookings");
  });

  it("serializes options with flags and description", () => {
    const program = buildTestProgram();
    const result = serializeCommand(program);

    const bookings = result.subcommands.find((c) => c.name === "bookings");
    const list = bookings?.subcommands.find((c) => c.name === "list");
    const jsonOpt = list?.options.find((o) => o.flags.includes("--json"));
    expect(jsonOpt).toBeDefined();
    expect(jsonOpt?.description).toBe("Output as JSON");
  });
});

describe("resolveCommandPath", () => {
  it("resolves a direct child", () => {
    const program = buildTestProgram();
    const result = resolveCommandPath(program, ["bookings"]);
    expect(result?.name()).toBe("bookings");
  });

  it("resolves a nested path", () => {
    const program = buildTestProgram();
    const result = resolveCommandPath(program, ["bookings", "list"]);
    expect(result?.name()).toBe("list");
  });

  it("returns undefined for unknown path", () => {
    const program = buildTestProgram();
    const result = resolveCommandPath(program, ["nonexistent"]);
    expect(result).toBeUndefined();
  });

  it("returns undefined for partially invalid path", () => {
    const program = buildTestProgram();
    const result = resolveCommandPath(program, ["bookings", "nonexistent"]);
    expect(result).toBeUndefined();
  });

  it("returns root for empty path", () => {
    const program = buildTestProgram();
    const result = resolveCommandPath(program, []);
    expect(result?.name()).toBe("calcom");
  });
});

describe("registerSchemaCommand", () => {
  it("registers a schema command on the program", () => {
    const program = buildTestProgram();
    registerSchemaCommand(program);
    const schemaCmd = program.commands.find((c) => c.name() === "schema");
    expect(schemaCmd).toBeDefined();
    expect(schemaCmd?.description()).toBe("Dump CLI command structure as machine-readable JSON");
  });
});
