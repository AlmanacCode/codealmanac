import { Command } from "commander";

import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";
import {
  emit,
  shouldUseStdoutColor,
} from "./helpers.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("list registered wikis")
    .option("--json", "emit structured JSON")
    .option(
      "--drop <name>",
      "remove a wiki from the registry (the only way entries are ever removed)",
    )
    .option("--verbose", "show descriptions and paths")
    .action(
      async (opts: { json?: boolean; drop?: string; verbose?: boolean }) => {
        if (opts.drop === undefined) {
          await autoRegisterIfNeeded(process.cwd());
        }
        const { listWikis } = await import("./commands/list.js");
        const result = await listWikis({
          ...opts,
          color: shouldUseStdoutColor(),
        });
        emit(result);
      },
    );
}
