import type { Command } from "commander";
import { outputJson } from "../../shared/output";

interface OptionSchema {
  flags: string;
  description: string;
  required: boolean;
  defaultValue?: unknown;
}

interface CommandSchema {
  name: string;
  description: string;
  options: OptionSchema[];
  subcommands?: CommandSchema[];
}

export function serializeCommand(cmd: Command): CommandSchema {
  const options: OptionSchema[] = cmd.options.map((opt) => ({
    flags: opt.flags,
    description: opt.description,
    required: opt.required,
    ...(opt.defaultValue !== undefined ? { defaultValue: opt.defaultValue } : {}),
  }));

  const subcommands = cmd.commands
    .filter((sub: Command) => sub.name() !== "schema")
    .map((sub: Command) => serializeCommand(sub));

  return {
    name: cmd.name(),
    description: cmd.description(),
    options,
    ...(subcommands.length > 0 ? { subcommands } : {}),
  };
}

export function resolveCommandPath(root: Command, commandPath: string[]): Command | null {
  let target: Command = root;
  for (const segment of commandPath) {
    const child = target.commands.find((c: Command) => c.name() === segment);
    if (!child) return null;
    target = child;
  }
  return target;
}

export function registerSchemaCommand(program: Command): void {
  program
    .command("schema [command...]")
    .description("Dump CLI command structure as machine-readable JSON (agent introspection)")
    .action((commandPath: string[]) => {
      const target = resolveCommandPath(program, commandPath);
      if (!target) {
        const failed = commandPath[commandPath.length - 1] ?? "unknown";
        console.error(
          JSON.stringify({
            status: "error",
            error: { message: `Unknown command: ${failed}` },
          })
        );
        process.exit(1);
        return;
      }

      outputJson(serializeCommand(target));
    });
}
