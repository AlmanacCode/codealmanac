import { Command } from "commander";

import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";
import {
  emit,
  readStdin,
  shouldUseStdoutColor,
} from "./helpers.js";

export function registerHealthCommand(program: Command): void {
  program
    .command("health")
    .description("report graph integrity problems")
    .option("--topic <name>", "scope to a topic + its descendants")
    .option("--stale <duration>", "stale threshold (default 90d)")
    .option("--stdin", "read page slugs from stdin (limit to these pages)")
    .option("--json", "emit structured JSON")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(
      async (opts: {
        topic?: string;
        stale?: string;
        stdin?: boolean;
        json?: boolean;
        wiki?: string;
      }) => {
        await autoRegisterIfNeeded(process.cwd());
        const { runHealth } = await import("./commands/health/index.js");
        const result = await runHealth({
          cwd: process.cwd(),
          topic: opts.topic,
          stale: opts.stale,
          stdin: opts.stdin,
          stdinInput: opts.stdin === true ? await readStdin() : undefined,
          json: opts.json,
          wiki: opts.wiki,
          color: shouldUseStdoutColor(),
        });
        emit(result);
      },
    );
}
