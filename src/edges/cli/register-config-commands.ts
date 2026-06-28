import { Command } from "commander";

import { emit } from "./helpers.js";

export function registerConfigCommands(program: Command): void {
  const config = program
    .command("config")
    .description("read and write Almanac settings");

  config
    .command("list")
    .description("show supported config keys")
    .option("--json", "emit structured JSON")
    .option("--show-origin", "show whether each value came from file or default")
    .action(async (opts: { json?: boolean; showOrigin?: boolean }) => {
      const { runConfigList } = await import("./commands/config.js");
      emit(await runConfigList({ ...opts, cwd: process.cwd() }));
    });

  config
    .command("get")
    .description("print one config value")
    .argument("<key>", "config key")
    .option("--json", "emit structured JSON")
    .option("--show-origin", "show whether the value came from file or default")
    .action(async (
      key: string,
      opts: { json?: boolean; showOrigin?: boolean },
    ) => {
      const { runConfigGet } = await import("./commands/config.js");
      emit(await runConfigGet({ key, ...opts, cwd: process.cwd() }));
    });

  config
    .command("set")
    .description("set one config value")
    .argument("<key>", "config key")
    .argument("<value>", "config value")
    .option("--project", "write .almanac/config.toml for this repo")
    .action(async (
      key: string,
      value: string,
      opts: { project?: boolean },
    ) => {
      const { runConfigSet } = await import("./commands/config.js");
      emit(await runConfigSet({
        key,
        value,
        project: opts.project,
        cwd: process.cwd(),
      }));
    });

  config
    .command("unset")
    .description("restore one config value to default")
    .argument("<key>", "config key")
    .option("--project", "remove from .almanac/config.toml for this repo")
    .action(async (key: string, opts: { project?: boolean }) => {
      const { runConfigUnset } = await import("./commands/config.js");
      emit(await runConfigUnset({
        key,
        project: opts.project,
        cwd: process.cwd(),
      }));
    });
}
