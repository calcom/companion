import type { Command } from "commander";

interface SerializedOption {
  flags: string;
  description: string;
  defaultValue?: unknown;
}

interface SerializedCommand {
  name: string;
  description: string;
  options: SerializedOption[];
  subcommands: SerializedCommand[];
}

/**
 * Recursively serialize a Commander command tree into a plain object
 * suitable for JSON output.
 */
export function serializeCommand(cmd: Command): SerializedCommand {
  return {
    name: cmd.name(),
    description: cmd.description(),
    options: cmd.options.map((opt) => {
      const entry: SerializedOption = {
        flags: opt.flags,
        description: opt.description,
      };
      if (opt.defaultValue !== undefined) {
        entry.defaultValue = opt.defaultValue;
      }
      return entry;
    }),
    subcommands: cmd.commands.map((sub: Command) => serializeCommand(sub)),
  };
}

/**
 * Walk the command tree to find a nested command by path segments.
 * e.g. ["bookings", "list"] → program → bookings → list
 */
export function resolveCommandPath(root: Command, path: string[]): Command | undefined {
  let current: Command = root;
  for (const segment of path) {
    const child = current.commands.find((c: Command) => c.name() === segment);
    if (!child) return undefined;
    current = child;
  }
  return current;
}

/**
 * Register the `schema` introspection command on the program.
 * Usage:
 *   calcom schema              — dump entire CLI structure as JSON
 *   calcom schema bookings     — dump only the bookings subtree
 *   calcom schema bookings list — dump only the bookings list command
 */
export function registerSchemaCommand(program: Command): void {
  program
    .command("schema [path...]")
    .description("Dump CLI command structure as machine-readable JSON")
    .action((pathSegments: string[]) => {
      const target = pathSegments.length > 0 ? resolveCommandPath(program, pathSegments) : program;

      if (!target) {
        console.error(
          JSON.stringify({
            status: "error",
            error: { message: `Unknown command path: ${pathSegments.join(" ")}` },
          }),
        );
        process.exit(1);
      }

      console.log(JSON.stringify(serializeCommand(target), null, 2));
    });
}
