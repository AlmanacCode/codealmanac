import { Command } from "commander";

import { emit, readStdin } from "../../cli/helpers.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";

export function registerMigrateCommands(program: Command): void {
  const migrate = program
    .command("migrate")
    .description("run deterministic Almanac migrations");

  migrate
    .command("legacy-sources")
    .description("convert legacy files/source frontmatter into structured sources")
    .option("--topic <name>", "scope to a topic + its descendants")
    .option("--stdin", "read page slugs from stdin (limit to these pages)")
    .option("--wiki <name>", "target a specific registered wiki")
    .option("--json", "emit structured JSON")
    .action(async (opts: {
      topic?: string;
      stdin?: boolean;
      wiki?: string;
      json?: boolean;
    }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runMigrateLegacySources } = await import("../../cli/commands/migrate.js");
      const result = await runMigrateLegacySources({
        cwd: process.cwd(),
        topic: opts.topic,
        stdin: opts.stdin,
        stdinInput: opts.stdin === true ? await readStdin() : undefined,
        wiki: opts.wiki,
        json: opts.json,
      });
      emit(result);
    });

  migrate
    .command("automation")
    .description("migrate legacy scheduled automation to sync")
    .option("--json", "emit structured JSON")
    .action(async (opts: { json?: boolean }) => {
      const { runMigrateAutomation } = await import("../../cli/commands/migrate.js");
      const result = await runMigrateAutomation({
        json: opts.json,
      });
      emit(result);
    });
}
